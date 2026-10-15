<script setup>
// 评分预测页专属弹窗，同时供原生榜单的单用户分析入口调用。
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { translate as t } from '../../../../../i18n/index.js';
import { appSettings } from '../../../../../settings.js';
import { predictionState as state } from '../../../../../features/contest/rating-prediction/state.js';
import {
  runPredictionAnalysis,
  cancelPredictionAnalysis,
  getPredictionAnalysisBounds,
  getPredictionAnalysisCurve,
} from '../../../../../features/contest/rating-prediction/index.js';
import {
  normalizeCurve,
  estimateRating,
  estimateRank,
} from '../../../../../features/contest/rating-prediction/algorithm/curve.js';
import {
  RATING_RANKS,
  rankForRating,
} from '../../../../../features/contest/rating-prediction/algorithm/ranks.js';
import {
  getRatingBgColor,
  getRatingBorderColor,
  getRatingTagStyle,
} from '../../../../../features/ratings/rules.js';
import DialogTransition from '../../../../components/transitions/DialogTransition/DialogTransition.vue';
import ExpandTransition from '../../../../components/transitions/ExpandTransition/ExpandTransition.vue';
import analyzeIcon from '../../../../../assets/icons/prediction/analyze.svg?raw';
import {
  predictionNumberColor,
  snapshotTime,
} from '../../../../../features/contest/rating-prediction/standings/presentation.js';
import {
  normalizeAvatarUrl,
  DEFAULT_AVATAR_URL,
} from '../../../../../features/user/avatars/data.js';
import { appStorage } from '../../../../../storage/gm.js';
import { AVATAR_CACHE_KEY } from '../../../../../storage/keys.js';
import { backdropClose } from '../../../../../utils/backdrop.js';
// 名次滑杆的刻度数：名次按对数换算成 0 到这个数之间的位置。
const SLIDER_STEPS = 1000;
const dialog = ref(null),
  handle = ref(''),
  avatar = ref('');
// 可达范围：评级与名次各自的最小、最大值。
const bounds = ref(null);
// 「名次 → 赛后评级」的取样曲线，以及之后每次精确计算得到的点。
const curve = ref(null),
  extra = ref([]);
// 结果区显示的内容。driver 是用户动的那一头（current 表示当前榜单），exact 为 false 表示另一头还只是估算。
const view = ref(null);
// 两根滑杆的位置（数值）和右侧输入框里的文字。
const ratingValue = ref(null),
  rankValue = ref(null),
  ratingText = ref(''),
  rankText = ref('');
// 滑块在轨道上的显示位置。拖动时紧跟数值；点快捷目标、输入数值、结果返回这类「跳过去」的变化，
// 用一小段动画滑过去，不闪现。动画途中目标再变，就从当前位置接着滑。
const SLIDER_GLIDE = 320;
function sliderMotion() {
  const shown = ref(null);
  let frame = 0,
    goal = null;
  function move(to, animate) {
    if (animate && frame && to === goal) return;
    cancelAnimationFrame(frame);
    frame = 0;
    goal = to;
    const from = shown.value;
    if (
      !animate ||
      from == null ||
      to == null ||
      from === to ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      shown.value = to;
      return;
    }
    // 起点取第一帧自己的时间戳：页面忙时帧的时间戳会比当前时间早，相减得负数，滑块会先朝反方向冲出去。
    let start = null;
    const step = (now) => {
      start ??= now;
      const progress = Math.min(1, Math.max(0, (now - start) / SLIDER_GLIDE));
      shown.value = progress < 1 ? from + (to - from) * (1 - (1 - progress) ** 3) : to;
      frame = progress < 1 ? requestAnimationFrame(step) : 0;
    };
    frame = requestAnimationFrame(step);
  }
  return { shown, move };
}
// 评级滑块的位置就是评级本身；名次滑块的位置是对数换算后的刻度，在刻度上补间，滑动才是匀速的。
const { shown: ratingShown, move: moveRating } = sliderMotion();
const { shown: rankShown, move: moveRank } = sliderMotion();
let previousFocus = null;
// 最近一次提交计算的目标，回车与失焦先后触发时不重复计算。
let committed = '';
let loadToken = 0;
const participant = computed(() =>
  state.snapshot?.participants.find((p) => p.handle === handle.value),
);
// 榜单快照的抓取时间与时区，时区在小签里排成上标小字。
const snapshotTaken = computed(() => snapshotTime(state.snapshot?.fetchedAt));
// 这个人的新号修正（参赛不满六场的账号才有，查到之后才出现，见 algorithm/newcomer.js）。
// 有它的时候，面板里的评级一律是显示评级，赛前评级和当前结果都取修正后的。
const newcomer = computed(() =>
  state.newcomer && state.newcomer.handle === handle.value ? state.newcomer : null,
);
// 标签收起的过渡期间还要显示原来的文字，所以另记一份最后一次的内容。
const newcomerShown = ref(null);
watch(
  newcomer,
  (next) => {
    if (next) newcomerShown.value = next;
  },
  { immediate: true },
);
// 这个人是计分队伍的成员时（见 features/contest/rating-prediction/index.js 的 teamMember）：
// 名次和涨跌是全队共用的，评级显示他自己的。
const member = computed(() =>
  state.member && state.member.handle === handle.value ? state.member : null,
);
// 标签收起的过渡期间还要显示原来的文字，另记一份最后一次的内容。
const memberShown = ref(null);
watch(
  member,
  (next) => {
    if (next) memberShown.value = next;
  },
  { immediate: true },
);
// 赛前评级。
const before = computed(() =>
  member.value
    ? member.value.before
    : newcomer.value
      ? newcomer.value.before
      : (participant.value?.rating ?? null),
);
// 当前榜单上这位选手的名次与赛后评级，是滑杆的起点，也是两根轴上「当前」小旗的位置。
const current = computed(() => {
  if (member.value) return member.value.current;
  if (newcomer.value) return newcomer.value.current;
  // 这里的赛前评级是模型里的，加的也要是模型算出的涨跌（首场新号在榜单上显示的补过分，见 withFirstBonus）。
  const result = state.results?.[handle.value];
  const delta = result?.modelDelta ?? result?.delta;
  if (!result || before.value == null || !Number.isInteger(result.rank) || !Number.isFinite(delta))
    return null;
  return { rank: result.rank, rating: before.value + delta };
});
// 只有取样曲线到位后才估算；零散的几个精确点不足以插值。
const points = computed(() =>
  curve.value ? normalizeCurve([...curve.value, ...extra.value]) : [],
);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
// 评级在轴上的位置（百分比），左低右高。
function ratingPos(rating) {
  const range = bounds.value;
  if (!range || range.ratingMax === range.ratingMin) return 50;
  return clamp(((rating - range.ratingMin) / (range.ratingMax - range.ratingMin)) * 100, 0, 100);
}
// 名次轴取对数，并且左右反过来：往右拖总是「更好」，与评级轴方向一致。
const rankSpan = computed(() => Math.log(Math.max(bounds.value?.rankMax ?? 1, 1)));
function rankPos(rank) {
  if (!rankSpan.value) return 50;
  return clamp((1 - Math.log(Math.max(rank, 1)) / rankSpan.value) * 100, 0, 100);
}
const rankToSlider = (rank) => Math.round((rankPos(rank) / 100) * SLIDER_STEPS);
const sliderToRank = (value) =>
  clamp(
    Math.round(Math.exp((1 - value / SLIDER_STEPS) * rankSpan.value)),
    1,
    bounds.value?.rankMax ?? 1,
  );
// 色带和滑块的颜色。平常用评级档位的经典颜色（色带调淡，不抢数字的风头）。
// 「沿用难度分样式」开着时，和榜单上的预测各列、弹窗里的数字一样跟难度分的样式走：
// 标签样式——色带用标签的描边色（标签的底色太浅，铺在八像素高的色带上看不出来），滑块用标签的文字色；
// 色块样式——色带用色块的底色，滑块用色块的边线色。
// 难度分的配色里每一档颜色都不同，所以这时 2300、2600、3000 这几条经典配色里看不出来的分界也分得开。
const soft = (color) => `color-mix(in srgb, ${color} 58%, #fff)`;
const following = computed(
  () => appSettings.contest.prediction.followRatingStyle && appSettings.ratings.enabled,
);
const tagged = computed(() => appSettings.ratings.style === 'tag');
// 现在用的是哪一套配色。它一变，色带整条换成新的：新的一条盖在旧的上面淡入（渐变色本身没法过渡）。
const palette = computed(() => (!following.value ? 'classic' : tagged.value ? 'tag' : 'block'));
const tierColor = (rating) =>
  !following.value
    ? soft(rankForRating(rating).color)
    : tagged.value
      ? getRatingTagStyle(rating).border
      : getRatingBgColor(rating);
const ringColor = (rating) =>
  !following.value
    ? rankForRating(rating).color
    : tagged.value
      ? getRatingTagStyle(rating).text
      : getRatingBorderColor(rating);
// 可达范围里的档位分界。最高可达分正好等于分界时也算：拿到第 1 名就进了这一档，轴上要有它的颜色。
//（下限正好等于分界时不用算：整个范围从头就在这一档里。）
const tierCuts = computed(() => {
  const range = bounds.value;
  if (!range) return [];
  return RATING_RANKS.map((rank) => rank.low).filter(
    (low) => low > range.ratingMin && low <= range.ratingMax,
  );
});
// 把分界位置和各段颜色拼成硬切换的渐变。
function bandStyle(marks, colors) {
  return `linear-gradient(90deg, ${colors
    .map((color, index) => `${color} ${marks[index]}% ${marks[index + 1]}%`)
    .join(', ')})`;
}
// 两端的档位至少画这么宽（占整根轴的百分之几，约六个像素）。评级轴和名次轴的色带都用。
// 位置是按分数算的：最高可达分只比分界高一两分时，最后一档只有一两个像素宽，正好等于分界时宽度是零，
// 都看不出「再往上是另一档」。所以把最靠两端的分界往里挪到至少留出这么宽；
// 只挪色带的分界，滑块、刻度和数值的换算都不变。
const END_BAND = 1.6;
function roomyMarks(marks) {
  if (marks.length < 3) return marks;
  const spaced = [...marks];
  const last = spaced.length - 1;
  // 先让出最低一档，再让出最高一档；中间的分界不越过被挪动的那一个，挤在一起时最高一档优先。
  spaced[1] = Math.max(spaced[1], END_BAND);
  for (let at = 2; at < last; at++) spaced[at] = Math.max(spaced[at], spaced[at - 1]);
  spaced[last - 1] = Math.min(spaced[last - 1], 100 - END_BAND);
  for (let at = last - 2; at > 0; at--) spaced[at] = Math.min(spaced[at], spaced[at + 1]);
  return spaced;
}
/*
 * 画面上的一条色带。target 是它应有的样子（{ marks, colors }）；分界位置变了就滑过去，不跳变：
 * 可达范围换了（比如查到是新号、按实际评级重算）、名次轴从粗估换成取样曲线、新增了精确点，都会让分界挪位置。
 * 第一次出现、段数变了或用户关闭了动效时直接到位。
 */
const bandFrames = new Set();
function glidingBand(target) {
  const shown = ref(null);
  let frame = 0;
  watch(
    target,
    (to) => {
      cancelAnimationFrame(frame);
      bandFrames.delete(frame);
      const from = shown.value;
      if (
        !to ||
        !from ||
        from.marks.length !== to.marks.length ||
        from.marks.every((mark, index) => Math.abs(mark - to.marks[index]) < 0.05) ||
        matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        shown.value = to;
        return;
      }
      // 起点同样取第一帧的时间戳，原因见上面滑块的补间。
      let start = null;
      const step = (now) => {
        bandFrames.delete(frame);
        start ??= now;
        const progress = Math.min(1, Math.max(0, (now - start) / SLIDER_GLIDE));
        const eased = 1 - (1 - progress) ** 3;
        shown.value =
          progress < 1
            ? {
                colors: to.colors,
                marks: from.marks.map((mark, index) => mark + (to.marks[index] - mark) * eased),
              }
            : to;
        if (progress < 1) bandFrames.add((frame = requestAnimationFrame(step)));
      };
      bandFrames.add((frame = requestAnimationFrame(step)));
    },
    { immediate: true },
  );
  return computed(() =>
    shown.value ? bandStyle(shown.value.marks, shown.value.colors) : undefined,
  );
}
// 评级轴色带：档位分界处切换颜色。
const ratingBand = glidingBand(
  computed(() => {
    const range = bounds.value;
    if (!range) return null;
    const edges = [range.ratingMin, ...tierCuts.value, range.ratingMax];
    return { marks: roomyMarks(edges.map(ratingPos)), colors: edges.slice(0, -1).map(tierColor) };
  }),
);
// 取样曲线要算几十个名次，比可达范围晚到几帧。它到之前，先用已知的三个点
//（第一名、当前名次、最后一名）粗估各档位的分界，让名次轴和评级轴同时上色。
const bandPoints = computed(() => {
  if (points.value.length) return points.value;
  const range = bounds.value;
  if (!range) return [];
  return normalizeCurve([
    { rank: range.rankMin, rating: range.ratingMax },
    ...(current.value ? [current.value] : []),
    { rank: range.rankMax, rating: range.ratingMin },
  ]);
});
// 名次轴色带应有的样子：按「排到这个名次，赛后落在哪个档位」着色，分界位置由曲线估算。
const rankBandTarget = computed(() => {
  const range = bounds.value;
  if (!range || !bandPoints.value.length) return null;
  const marks = [0];
  const colors = [tierColor(range.ratingMin)];
  for (const cut of tierCuts.value) {
    // 能拿到这个档位的最差名次。
    const rank = estimateRank(bandPoints.value, cut);
    if (rank == null) continue;
    // 分界画在这个名次和下一个名次的正中间，而不是画在这个名次自己的位置上：
    // 这样每个名次都落在它那一档的颜色里面。画在名次自己的位置上的话，只有第 1 名才到的档位
    // 要从轴的最右端开始，宽度是零，根本看不见。靠后的名次挨得很密，挪这半格看不出差别。
    marks.push((rankPos(rank) + rankPos(rank + 1)) / 2);
    colors.push(tierColor(cut));
  }
  marks.push(100);
  // 两端和评级轴一样至少留出一小截。名次轴是对数的，靠后的名次挤在最左边：
  // 只有最后一两名才会掉进的那一档，按位置算只有万分之几宽，不挪就看不见。
  return { marks: roomyMarks(marks), colors };
});
// 画面上的名次轴色带，分界位置变了同样滑过去。
const rankBand = glidingBand(rankBandTarget);
// 刻度太密时数字会叠在一起：按给定的先后挑选，离已选刻度太近的跳过。
function spread(candidates, gap) {
  const kept = [];
  for (const candidate of candidates)
    if (kept.every((tick) => Math.abs(tick.at - candidate.at) >= gap)) kept.push(candidate);
  return kept;
}
// 评级轴刻度以档位分界为主，两端的数值离分界够远时才标。
const ratingTicks = computed(() => {
  const range = bounds.value;
  if (!range) return [];
  return spread(
    [...tierCuts.value, range.ratingMin, range.ratingMax].map((value) => ({
      label: value,
      at: ratingPos(value),
    })),
    8,
  );
});
// 名次轴刻度：两端加上中间的 10 的整数次幂。
const rankTicks = computed(() => {
  const range = bounds.value;
  if (!range) return [];
  const values = [range.rankMax, 1];
  for (let power = 10; power < range.rankMax; power *= 10) values.push(power);
  return spread(
    [...new Set(values)].map((value) => ({ label: value, at: rankPos(value) })),
    8,
  );
});
// 评级轴上的两面小旗：赛前评级和当前榜单的赛后评级。
const ratingFlags = computed(() => {
  const range = bounds.value;
  if (!range) return [];
  const flags = [];
  if (current.value)
    flags.push({
      key: 'current',
      label: t('predictionFlagCurrent'),
      at: ratingPos(current.value.rating),
    });
  if (before.value != null && before.value >= range.ratingMin && before.value <= range.ratingMax)
    flags.push({ key: 'before', label: t('predictionFlagBefore'), at: ratingPos(before.value) });
  return apart(flags);
});
// 两面小旗离得近时文字会叠在一起，要错开。能只挪一面就只挪一面：左边那面的文字摆到它旗杆的左侧，
// 右边那面照旧居中——右边那面常常立在轴的最右端（当前第 1 名、当前就是最高分），文字再往右摆就伸到轴外面去了。
// 两根旗杆几乎贴在一起时，只挪一面还是会叠，才两面各摆一侧。
const FLAGS_NEAR = 14;
const FLAGS_TOUCHING = 6;
function apart(flags) {
  if (flags.length !== 2) return flags;
  const gap = Math.abs(flags[0].at - flags[1].at);
  if (gap >= FLAGS_NEAR) return flags;
  const [left, right] = flags[0].at <= flags[1].at ? flags : [flags[1], flags[0]];
  left.side = 'left';
  if (gap < FLAGS_TOUCHING) right.side = 'right';
  return flags;
}
// 名次轴上的两面小旗：当前榜单的名次，和刚好不掉分的名次（赛前评级在评级轴上对应的那个名次）。
// 后一个是按取样曲线估出来的，曲线到位后才有；怎么排都掉分或者都不掉分时不标。
const rankFlags = computed(() => {
  const range = bounds.value;
  if (!range) return [];
  const flags = [];
  if (current.value)
    flags.push({
      key: 'current',
      label: t('predictionFlagCurrent'),
      at: rankPos(current.value.rank),
    });
  if (before.value != null && before.value >= range.ratingMin && before.value <= range.ratingMax) {
    const keep = estimateRank(points.value, before.value);
    if (keep != null)
      flags.push({ key: 'keep', label: t('predictionFlagKeep'), at: rankPos(keep) });
  }
  return apart(flags);
});
// 常用目标：一点就算，不用自己找位置。
const shortcuts = computed(() => {
  const range = bounds.value;
  const list = [];
  if (!range) return list;
  if (current.value) list.push({ key: 'current', label: t('predictionQuickCurrent') });
  if (before.value == null) return list;
  if (before.value >= range.ratingMin && before.value <= range.ratingMax)
    list.push({ key: 'keep', label: t('predictionQuickKeep'), rating: before.value });
  const next = RATING_RANKS.find((rank) => rank.low > before.value);
  if (next && next.low <= range.ratingMax)
    list.push({
      key: 'promote',
      label: t('predictionQuickPromote', next.name),
      rating: next.low,
    });
  return list;
});
// 滑块描边跟随当前显示的赛后评级所在的档位。
const thumbColor = computed(() => {
  const rating = view.value?.rating ?? before.value;
  return rating == null ? undefined : ringColor(rating);
});
const ratingTextColor = computed(() => {
  const value = Number(ratingText.value);
  return ratingText.value.trim() && Number.isFinite(value)
    ? predictionNumberColor(value)
    : undefined;
});
const delta = computed(() =>
  view.value?.rating == null || before.value == null ? null : view.value.rating - before.value,
);
// 输入变化立即作废旧分析，避免旧值误显示为新目标结果。
// 没有在算也没有结果时不必取消：取消会终止计算线程，下次又得重新启动。
function invalidate() {
  committed = '';
  if (state.computing || state.analysisResult || state.analysisError) cancelPredictionAnalysis();
}
// 把滑杆和输入框摆到给定数值上；skip 指明哪个输入框正在被用户编辑，不去改写它的文字。
// glide 为真时滑块滑过去，否则直接到位。
function place({ rating, rank }, skip, glide = false) {
  const range = bounds.value;
  if (rating != null) {
    ratingValue.value = range ? clamp(rating, range.ratingMin, range.ratingMax) : rating;
    if (skip !== 'rating') ratingText.value = String(rating);
    moveRating(ratingValue.value, glide);
  }
  if (rank != null) {
    rankValue.value = range ? clamp(rank, range.rankMin, range.rankMax) : rank;
    if (skip !== 'rank') rankText.value = String(rank);
    moveRank(rankToSlider(rankValue.value), glide);
  }
}
// 回到当前榜单的实际结果，这是已知的精确值，不需要计算。
// 刚打开弹窗时滑块还没有位置，会直接到位；之后再回来才是滑过去。
function showCurrent() {
  invalidate();
  const now = current.value;
  view.value = now ? { driver: 'current', rank: now.rank, rating: now.rating, exact: true } : null;
  if (now) place(now, undefined, true);
}
// 拖动或输入的过程中：动的那一头取输入值，另一头用取样曲线估算，等松手后再精确计算。
// source 是数值的来源：drag 是拖滑杆，滑块紧跟手；text 是在输入框里输入；jump 是快捷目标和方向键。
function slide(driver, value, source = 'drag') {
  invalidate();
  const next =
    driver === 'rating'
      ? { rating: value, rank: estimateRank(points.value, value) }
      : { rank: value, rating: estimateRating(points.value, value) };
  view.value = { driver, ...next, exact: false };
  place(next, source === 'text' ? driver : undefined, source !== 'drag');
}
// 松手、回车或失焦后才真正重算全场，不在每次移动时计算。
function commit(driver, value) {
  if (!bounds.value) return;
  committed = `${driver}:${value}`;
  runPredictionAnalysis(driver, value);
}
// 某一头的输入框文字、滑杆数值和可选范围。
const textOf = (driver) => (driver === 'rating' ? ratingText : rankText);
const valueOf = (driver) => (driver === 'rating' ? ratingValue : rankValue).value;
function limits(driver) {
  const range = bounds.value;
  return driver === 'rating' ? [range.ratingMin, range.ratingMax] : [range.rankMin, range.rankMax];
}
// 只留下数字；可选范围含负数时，开头允许一个负号。字母、空格、小数点等一律去掉。
function digitsOnly(driver, raw) {
  const sign = limits(driver)[0] < 0 && raw.replace(/[^\d-]/g, '').startsWith('-') ? '-' : '';
  return sign + raw.replace(/\D/g, '');
}
// 读出输入框里的整数；空着或只有一个负号时返回 null。
function parse(driver) {
  const raw = textOf(driver).value;
  return /^-?\d+$/.test(raw) ? Number(raw) : null;
}
// 输入过程中先去掉非数字字符。数值落在可选范围内就当作拖动处理；
// 范围外的先不截断（否则要输入 1500，刚打出 1 就被改成最低值），只标记当前结果已不对应输入。
function typeTarget(driver, event) {
  // 输入法组字途中不动文字，组字结束时会再触发一次。
  if (!bounds.value || event.isComposing) return;
  const field = event.target;
  const clean = digitsOnly(driver, field.value);
  const stripped = clean !== field.value;
  if (stripped) {
    // 光标留在原处：数一数光标前面还剩几个字符。
    const caret = digitsOnly(driver, field.value.slice(0, field.selectionStart)).length;
    field.value = clean;
    field.setSelectionRange(caret, caret);
  }
  textOf(driver).value = clean;
  const value = parse(driver);
  // 敲进来的字符被整个去掉、数值没变时，保持现有结果。
  if (stripped && value != null && value === valueOf(driver)) return;
  const [min, max] = limits(driver);
  if (value != null && value >= min && value <= max) {
    slide(driver, value, 'text');
    return;
  }
  invalidate();
  if (view.value) view.value = { ...view.value, exact: false };
}
// 回车或失焦时提交输入框里的目标。
function commitText(driver) {
  if (!bounds.value) return;
  const text = textOf(driver);
  const typed = parse(driver);
  // 清空后离开，视为放弃输入，恢复成滑杆上的数值。
  if (typed == null) {
    const fallback = valueOf(driver);
    text.value = fallback == null ? '' : String(fallback);
    return;
  }
  // 低于最低值或高于最高值的输入截到最近的一端，并把截断后的数值写回输入框。
  const [min, max] = limits(driver);
  const value = clamp(typed, min, max);
  text.value = String(value);
  if (committed === `${driver}:${value}` && (state.computing || state.analysisResult)) return;
  slide(driver, value, 'text');
  commit(driver, value);
}
// 上下方向键让输入框里的数加一或减一，到可选范围的两端为止。
// 按住连续变化时只估算，松开后才精确计算，与拖动滑杆一致。
let nudged = false;
function nudge(driver, step) {
  if (!bounds.value) return;
  const base = parse(driver) ?? valueOf(driver);
  if (base == null) return;
  const [min, max] = limits(driver);
  const value = clamp(base + step, min, max);
  // 已经在端点上，再按不动。
  if (String(value) === textOf(driver).value) return;
  nudged = true;
  slide(driver, value, 'jump');
}
// 松开方向键或离开输入框时，把方向键调出来的数值提交计算。
function settle(driver) {
  if (!nudged) return;
  nudged = false;
  commitText(driver);
}
function pickShortcut(item) {
  if (item.rating == null) {
    showCurrent();
    return;
  }
  slide('rating', item.rating, 'jump');
  commit('rating', item.rating);
}
// 记下可达范围。范围到位前滑杆位置无从换算，到位后按当前数值重新摆放。
function applyBounds({ rankMin, rankMax, ratingMin, ratingMax }) {
  const old = bounds.value;
  if (
    old &&
    old.rankMin === rankMin &&
    old.rankMax === rankMax &&
    old.ratingMin === ratingMin &&
    old.ratingMax === ratingMax
  )
    return;
  bounds.value = { rankMin, rankMax, ratingMin, ratingMax };
  // 原来就有范围、只是换了一个（按新号重算、榜单刷新）时，滑块滑到新位置；第一次到位时直接摆好。
  if (view.value) place(view.value, undefined, Boolean(old));
}
// 读取可达范围和取样曲线。范围只算首尾两个名次，先到；曲线要取几十个点，后到，
// 到了之后名次轴才有档位色带，拖动时另一头才有估算值。
function load(reset) {
  const requested = handle.value;
  const token = ++loadToken;
  if (reset) {
    bounds.value = null;
    curve.value = null;
    extra.value = [];
  }
  const fresh = () => token === loadToken && state.openHandle === requested;
  const fail = (error) => {
    if (!fresh() || bounds.value || error?.name === 'AbortError') return;
    state.analysisError = String(error?.message).startsWith('prediction')
      ? error.message
      : 'predictionComputeError';
  };
  getPredictionAnalysisBounds(requested)
    .then((next) => {
      if (fresh() && next) applyBounds(next);
    })
    .catch(fail);
  getPredictionAnalysisCurve(requested)
    .then((next) => {
      if (!fresh() || !next) return;
      applyBounds(next);
      // 模型变了，旧模型下算出的精确点不能再混进新曲线。
      if (curve.value !== next.points) extra.value = [];
      curve.value = next.points;
    })
    .catch(fail);
}
// 精确结果回来：动的那一头保持用户给的数值，另一头跟着结果走。
watch(
  () => state.analysisResult,
  (result) => {
    if (!result || !state.openHandle || !Number.isInteger(result.rank)) return;
    const driver = result.mode === 'rank' ? 'rank' : 'rating';
    view.value = { driver, rank: result.rank, rating: result.rating, exact: true };
    place(driver === 'rating' ? { rank: result.rank } : { rating: result.rating }, undefined, true);
    extra.value = [...extra.value, { rank: result.rank, rating: result.rating }];
  },
);
// 查到是新号（或者不再是了）：评级的算法换了，回到当前结果，范围和曲线重新算。
// 原来的范围先留着，新的算好了再换过去——先清空的话，刻度、小旗、快捷按钮会一下子全没了又冒出来，弹窗也跟着变高变矮。
watch(
  () => newcomer.value?.played,
  (now, was) => {
    if (!state.openHandle || now === was) return;
    showCurrent();
    load(false);
  },
);
// 榜单刷新后，仍停在「当前榜单」时跟着新结果走；用户已经拖到别处时不打扰。
watch(current, () => {
  if (state.openHandle && (!view.value || view.value.driver === 'current')) showCurrent();
});
// 快照更新后重新读取范围与曲线；模型没变时直接取缓存，界面不会有变化。
watch(
  () => state.snapshot,
  () => {
    if (state.openHandle) load(false);
  },
);
// 打开时锁定用户，从当前榜单的结果开始；关闭动画保留最后一帧内容。
watch(
  () => state.openHandle,
  async (opened) => {
    if (opened) {
      previousFocus = document.activeElement;
      handle.value = opened;
      view.value = null;
      ratingValue.value = rankValue.value = null;
      ratingText.value = rankText.value = '';
      moveRating(null, false);
      moveRank(null, false);
      // 先摆好当前结果再读取范围：前者会取消进行中的计算，顺序反了会把刚发出的请求一并取消。
      showCurrent();
      load(true);
      await nextTick();
      dialog.value?.focus();
    } else previousFocus?.isConnected && previousFocus.focus();
  },
);
// 优先复用页面头像，缺失时读取缓存；打开弹窗不增加头像请求。
watch([handle, () => appSettings.user.avatar.enabled], ([name, enabled]) => {
  avatar.value = '';
  if (!enabled || !name) return;
  const link = [...document.querySelectorAll('td.contestant-cell a[href]')].find((link) => {
    try {
      return (
        decodeURIComponent(
          new URL(link.href).pathname.split('/profile/')[1] || '',
        ).toLowerCase() === name.toLowerCase() && link.querySelector('img')
      );
    } catch {
      return false;
    }
  });
  const image = link?.querySelector('img');
  const cache = image ? null : appStorage.getJSON(AVATAR_CACHE_KEY, {});
  const cached =
    cache && Object.entries(cache).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
  avatar.value = normalizeAvatarUrl(
    image?.currentSrc || image?.src || cached?.url || DEFAULT_AVATAR_URL,
  );
});
// 关闭与取消统一清理计算，保留全场普通预测。
function close() {
  loadToken++;
  cancelPredictionAnalysis(true);
}
// 点遮罩关闭；在输入框里拖选文字、拖到弹窗外才松开不算。
const backdrop = backdropClose(close);
// 弹窗中保持键盘焦点，Escape 不影响其他设置。
function keyboard(event) {
  if (!state.openHandle || event.defaultPrevented) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    close();
  }
  if (event.key !== 'Tab') return;
  const items = [
    ...dialog.value.querySelectorAll(
      'button:not(:disabled),input:not(:disabled),select:not(:disabled)',
    ),
  ];
  if (!dialog.value.contains(document.activeElement) || document.activeElement === dialog.value) {
    event.preventDefault();
    (event.shiftKey ? items.at(-1) : items[0])?.focus();
    return;
  }
  if (event.shiftKey && document.activeElement === items[0]) {
    event.preventDefault();
    items.at(-1)?.focus();
  } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
    event.preventDefault();
    items[0]?.focus();
  }
}
onMounted(() => document.addEventListener('keydown', keyboard, true));
onBeforeUnmount(() => {
  bandFrames.forEach(cancelAnimationFrame);
  document.removeEventListener('keydown', keyboard, true);
});
</script>
<template>
  <Teleport to="body">
    <DialogTransition>
      <div
        v-if="state.openHandle"
        class="cf-prediction-overlay"
        v-on="backdrop"
        @keydown="keyboard"
      >
        <section
          ref="dialog"
          class="cf-prediction-dialog"
          data-cf-language-surface
          role="dialog"
          aria-modal="true"
          aria-labelledby="cf-prediction-title"
          tabindex="-1"
        >
          <header>
            <div class="cf-analysis-heading">
              <span class="cf-analysis-emblem"
                ><img
                  v-if="avatar"
                  :src="avatar"
                  :alt="handle"
                  @error="avatar = avatar === DEFAULT_AVATAR_URL ? '' : DEFAULT_AVATAR_URL" /><span
                  v-else
                  v-html="analyzeIcon"
                ></span
              ></span>
              <div>
                <small>{{ t('predictionAnalyze') }}</small>
                <h3
                  id="cf-prediction-title"
                  :style="{
                    color:
                      predictionNumberColor(member ? member.before : participant?.rating) ||
                      '#34435f',
                  }"
                >
                  {{ handle }}
                </h3>
              </div>
            </div>
            <button
              type="button"
              class="cf-analysis-close"
              :aria-label="t(`predictionClose`)"
              @click="close"
            >
              ×
            </button>
          </header>
          <div class="cf-analysis-content">
            <div class="cf-analysis-context">
              <span class="cf-analysis-contest">{{ state.snapshot?.name }}</span>
              <span class="cf-analysis-meta">
                <span
                  >{{ t('predictionModelRating') }}
                  <strong :style="{ color: predictionNumberColor(before) }">{{
                    before
                  }}</strong></span
                >
                <span
                  >{{ t('predictionDataTime') }} {{ snapshotTaken.text
                  }}<sup v-if="snapshotTaken.zone" class="cf-analysis-zone">{{
                    snapshotTaken.zone
                  }}</sup></span
                >
              </span>
              <!-- 新号修正的标签：另起一行，放在两枚常规标签下面；只有新号才有，出现和消失时这一行展开、收起。 -->
              <ExpandTransition :show="Boolean(newcomer)">
                <span v-if="newcomerShown" class="cf-analysis-newcomer">
                  <span :data-tooltip="t('predictionNewcomerTip')" data-tooltip-variant="lines"
                    >{{ t('predictionNewcomer', newcomerShown.played + 1) }}
                    <strong>{{ t('predictionNewcomerBonus', newcomerShown.bonus) }}</strong></span
                  >
                </span>
              </ExpandTransition>
              <!-- 队伍成员的标签：说明这场按队伍计分、推演用的是队伍评级。样子和新号的那一枚相同。 -->
              <ExpandTransition :show="Boolean(member)">
                <span v-if="memberShown" class="cf-analysis-newcomer">
                  <span :data-tooltip="t('predictionTeamMemberTip')" data-tooltip-variant="lines"
                    >{{ t('predictionTeamMember', memberShown.size) }}
                    <strong>{{ t('predictionTeamRating', memberShown.teamRating) }}</strong></span
                  >
                </span>
              </ExpandTransition>
            </div>
            <div class="cf-analysis-result" aria-live="polite" :aria-busy="state.computing">
              <span v-if="state.analysisError" class="cf-analysis-state cf-analysis-error">{{
                t(state.analysisError)
              }}</span>
              <span v-else-if="!view" class="cf-analysis-state">{{
                t('predictionInputHint')
              }}</span>
              <div v-else class="cf-analysis-outcome">
                <div class="cf-analysis-hero">
                  <small>{{
                    t(
                      view.driver === 'current'
                        ? 'predictionCurrentRank'
                        : view.driver === 'rank'
                          ? 'predictionTargetRankInput'
                          : 'predictionEstimateRank',
                    )
                  }}</small>
                  <strong
                    ><span
                      :class="{ 'cf-analysis-estimate': !view.exact && view.driver !== 'rank' }"
                      >{{
                        view.rank == null
                          ? '…'
                          : (view.exact || view.driver === 'rank' ? '#' : '≈#') + view.rank
                      }}</span
                    ><i v-if="bounds?.rankMax"> / {{ bounds.rankMax }}</i></strong
                  >
                </div>
                <div class="cf-analysis-journey">
                  <small>{{ t('predictionRatingChange') }}</small>
                  <div
                    class="cf-analysis-ratings"
                    :class="{ 'cf-analysis-estimate': !view.exact && view.driver !== 'rating' }"
                  >
                    <span :style="{ color: predictionNumberColor(before) }">{{ before }}</span>
                    <svg viewBox="0 0 24 12" aria-hidden="true">
                      <path d="M1 6h20m-5-4.5L21.5 6 16 10.5" />
                    </svg>
                    <strong :style="{ color: predictionNumberColor(view.rating) }">{{
                      view.rating == null
                        ? '…'
                        : (view.exact || view.driver === 'rating' ? '' : '≈') + view.rating
                    }}</strong>
                    <em
                      v-if="delta != null"
                      class="cf-analysis-delta"
                      :data-sign="delta > 0 ? 'up' : delta < 0 ? 'down' : 'same'"
                      >{{ delta > 0 ? '+' : '' }}{{ delta }}</em
                    >
                  </div>
                  <span
                    class="cf-analysis-track"
                    :style="{
                      background: `linear-gradient(90deg, ${predictionNumberColor(before)}, ${predictionNumberColor(view.rating ?? before)})`,
                    }"
                  ></span>
                </div>
                <span v-if="state.computing" class="cf-analysis-status"
                  ><i
                    class="cf-analysis-spinner"
                    role="img"
                    :aria-label="t('predictionComputing')"
                  ></i
                ></span>
                <span v-else-if="!view.exact" class="cf-analysis-status">{{
                  t('predictionEstimateHint')
                }}</span>
              </div>
            </div>
            <div class="cf-analysis-axis">
              <div class="cf-analysis-axis-head">
                <label for="cf-analysis-rating-input">{{ t('predictionTargetRatingInput') }}</label>
                <input
                  id="cf-analysis-rating-input"
                  v-model="ratingText"
                  inputmode="numeric"
                  autocomplete="off"
                  :disabled="!bounds"
                  :style="{ color: ratingTextColor }"
                  @input="typeTarget('rating', $event)"
                  @change="commitText('rating')"
                  @blur="settle('rating')"
                  @keydown.enter.prevent="commitText('rating')"
                  @keydown.up.prevent="nudge('rating', 1)"
                  @keydown.down.prevent="nudge('rating', -1)"
                  @keyup.up="settle('rating')"
                  @keyup.down="settle('rating')"
                />
              </div>
              <div class="cf-analysis-rail">
                <span class="cf-analysis-band"
                  ><Transition name="cf-analysis-paint"
                    ><span
                      :key="palette"
                      class="cf-analysis-paint"
                      :style="{ background: ratingBand }"
                    ></span></Transition
                ></span>
                <TransitionGroup
                  tag="div"
                  name="cf-analysis-mark"
                  class="cf-analysis-marks"
                  aria-hidden="true"
                >
                  <span
                    v-for="tick in ratingTicks"
                    :key="'tick-' + tick.label"
                    class="cf-analysis-tick"
                    :style="{ left: tick.at + '%' }"
                    >{{ tick.label }}</span
                  >
                  <span
                    v-for="flag in ratingFlags"
                    :key="'flag-' + flag.key"
                    class="cf-analysis-flag"
                    :data-side="flag.side"
                    :style="{ left: flag.at + '%' }"
                    ><span>{{ flag.label }}</span></span
                  >
                </TransitionGroup>
                <input
                  type="range"
                  step="1"
                  :min="bounds?.ratingMin"
                  :max="bounds?.ratingMax"
                  :value="ratingShown ?? bounds?.ratingMin"
                  :disabled="!bounds"
                  :aria-label="t('predictionTargetRatingInput')"
                  :style="{ '--cf-analysis-thumb': thumbColor }"
                  @input="slide('rating', Number($event.target.value))"
                  @change="commit('rating', Number($event.target.value))"
                />
              </div>
            </div>
            <div class="cf-analysis-axis">
              <div class="cf-analysis-axis-head">
                <label for="cf-analysis-rank-input">{{ t('predictionTargetRankInput') }}</label>
                <input
                  id="cf-analysis-rank-input"
                  v-model="rankText"
                  inputmode="numeric"
                  autocomplete="off"
                  :disabled="!bounds"
                  @input="typeTarget('rank', $event)"
                  @change="commitText('rank')"
                  @blur="settle('rank')"
                  @keydown.enter.prevent="commitText('rank')"
                  @keydown.up.prevent="nudge('rank', 1)"
                  @keydown.down.prevent="nudge('rank', -1)"
                  @keyup.up="settle('rank')"
                  @keyup.down="settle('rank')"
                />
              </div>
              <div class="cf-analysis-rail">
                <span class="cf-analysis-band"
                  ><Transition name="cf-analysis-paint"
                    ><span
                      :key="palette"
                      class="cf-analysis-paint"
                      :style="{ background: rankBand }"
                    ></span></Transition
                ></span>
                <TransitionGroup
                  tag="div"
                  name="cf-analysis-mark"
                  class="cf-analysis-marks"
                  aria-hidden="true"
                >
                  <span
                    v-for="tick in rankTicks"
                    :key="'tick-' + tick.label"
                    class="cf-analysis-tick"
                    :style="{ left: tick.at + '%' }"
                    >{{ tick.label }}</span
                  >
                  <span
                    v-for="flag in rankFlags"
                    :key="'flag-' + flag.key"
                    class="cf-analysis-flag"
                    :data-side="flag.side"
                    :style="{ left: flag.at + '%' }"
                    ><span>{{ flag.label }}</span></span
                  >
                </TransitionGroup>
                <input
                  type="range"
                  min="0"
                  :max="SLIDER_STEPS"
                  step="1"
                  :value="rankShown ?? 0"
                  :disabled="!bounds || bounds.rankMax <= 1"
                  :aria-label="t('predictionTargetRankInput')"
                  :aria-valuetext="rankValue == null ? undefined : '#' + rankValue"
                  :style="{ '--cf-analysis-thumb': thumbColor }"
                  @input="slide('rank', sliderToRank(Number($event.target.value)))"
                  @change="commit('rank', sliderToRank(Number($event.target.value)))"
                />
              </div>
            </div>
            <div class="cf-analysis-shortcuts">
              <button
                v-for="item in shortcuts"
                :key="item.key"
                type="button"
                @click="pickShortcut(item)"
              >
                {{ item.label }}
              </button>
            </div>
            <div class="cf-analysis-notes">
              <p class="cf-analysis-notes-title">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.6" />
                  <path d="M8 7.4v3.8" />
                  <circle class="cf-analysis-note-dot" cx="8" cy="5" r="0.9" />
                </svg>
                <span>{{ t('predictionTips') }}</span>
              </p>
              <p class="cf-analysis-tip">{{ t('predictionScenarioHint') }}</p>
              <p class="cf-analysis-tip">{{ t('predictionBiasHint') }}</p>
              <p
                v-for="warning in state.snapshot?.warnings"
                :key="warning"
                class="cf-analysis-note cf-analysis-warning"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M8 2.4 14.2 13.1H1.8Z" />
                  <path d="M8 6.6v3" />
                  <circle class="cf-analysis-note-dot" cx="8" cy="11.4" r="0.85" />
                </svg>
                <span>{{ t(warning) }}</span>
              </p>
            </div>
          </div>
        </section>
      </div>
    </DialogTransition>
  </Teleport>
</template>
<style scoped>
.cf-prediction-overlay {
  /* 独立分析视图固定使用柔彩，不继承当前设置页的色系。 */
  --cf-menu-accent: #91a2d6;
  --cf-card-surface: #f8f9ff;
  --cf-control-surface: #f0f2f9;
  --cf-surface-border: #dce1ee;
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  display: grid;
  place-items: center;
  padding: 18px;
  background: #27344833;
  backdrop-filter: blur(3px);
  box-sizing: border-box;
}
.cf-prediction-dialog {
  width: min(480px, 100%);
  max-height: 86vh;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid #ffffffd9;
  border-radius: 20px;
  color: #48546b;
  background:
    radial-gradient(ellipse at 0% 0%, #e0e6ffad, transparent 65%),
    radial-gradient(ellipse at 100% 20%, #f8e3edb0, transparent 60%),
    radial-gradient(ellipse at 70% 100%, #dff2eeb3, transparent 65%), var(--cf-gray-50);
  box-shadow:
    0 22px 75px #26345330,
    inset 0 1px 0 #fff;
  font:
    13px/1.6 Arial,
    sans-serif;
}
/* 打开时焦点先落在弹窗本身，不需要描边。 */
.cf-prediction-dialog:focus {
  outline: none;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 22px 14px;
}
.cf-analysis-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.cf-analysis-emblem {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  height: 44px;
  border: 1px solid #ffffffdc;
  border-radius: 14px;
  background: linear-gradient(135deg, #dce7f9b3, #eee4f5b3);
  box-shadow:
    0 4px 12px -4px #5a6c9a40,
    inset 0 1px 0 #ffffffcc;
  color: #7385ac;
}
.cf-analysis-emblem :deep(svg) {
  width: 25px;
  height: 25px;
}
/*
 * 头像不一定是正方形。高度不能写成百分比：外框的行高是自动的，百分比高度不生效，
 * 竖长的头像会按原比例撑出框外。这里按宽度定成正方形，多出的部分居中裁掉。
 */
.cf-analysis-emblem img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: inherit;
}
.cf-analysis-emblem > span {
  display: flex;
}
header small {
  display: block;
  color: #7684a0;
  font-size: var(--cf-font-size-xs);
  letter-spacing: 0.06em;
  line-height: 1.3;
}
header h3 {
  margin: 1px 0 0;
  font-size: calc(20px * var(--cf-font-scale));
  font-weight: var(--cf-font-weight-bold);
  line-height: 1.25;
  color: #34435f;
  word-break: break-word;
}
.cf-analysis-close {
  display: grid;
  place-items: center;
  flex: none;
  align-self: flex-start;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  color: #7c8aa3;
  font:
    21px/1 Arial,
    sans-serif;
  cursor: pointer;
  transition:
    background-color var(--cf-duration-fast) ease,
    border-color var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease;
}
.cf-analysis-close:hover {
  border-color: #ffffffd9;
  background: #ffffff99;
  color: #3d4c68;
}
.cf-analysis-close:focus-visible {
  outline: 2px solid #9badd8;
  outline-offset: 1px;
}
.cf-analysis-content {
  padding: 0 22px 22px;
  transition:
    opacity var(--cf-duration-base) ease,
    transform var(--cf-duration-base) var(--cf-ease-out);
}
.cf-analysis-context {
  margin: 0 0 16px;
  color: #68778a;
  font-size: var(--cf-font-size-base);
}
.cf-analysis-contest {
  display: block;
  color: #4a5a74;
  font-size: var(--cf-font-size-lg);
  font-weight: var(--cf-font-weight-semibold);
  margin-bottom: 9px;
}
/* 赛前评级与快照时间各自成一枚小签：实底色加描边，在幻彩背景上也能一眼看出是标签。 */
.cf-analysis-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: var(--cf-font-size-xs);
}
.cf-analysis-meta > span {
  padding: 3px 10px;
  border: 1px solid #b7c4e4;
  border-radius: 999px;
  background: #e2e8f8;
  color: #46557a;
  font-weight: var(--cf-font-weight-medium);
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}
.cf-analysis-meta strong {
  margin-left: 2px;
  color: #33415f;
  font-weight: var(--cf-font-weight-bold);
}
/* 新号修正的小签：和上面两枚一个形状，暖色，另起一行。 */
.cf-analysis-newcomer {
  display: flex;
  padding-top: 6px;
  font-size: var(--cf-font-size-xs);
}
.cf-analysis-newcomer > span {
  padding: 3px 10px;
  border: 1px solid #e6c58f;
  border-radius: 999px;
  background: #fbf0d9;
  color: #7a5a1e;
  font-weight: var(--cf-font-weight-medium);
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}
.cf-analysis-newcomer strong {
  margin-left: 2px;
  color: #8a5a00;
  font-weight: var(--cf-font-weight-bold);
}
/* 时区：与原站比赛时间旁的标注一样，排成上标小字；行高为 0，不撑高小签。 */
.cf-analysis-zone {
  margin-left: 1px;
  vertical-align: super;
  font-size: calc(9px * var(--cf-font-scale));
  line-height: 0;
}
/* 结果区：固定高度，出错提示与结果之间切换时弹窗不会跳动。 */
.cf-analysis-result {
  position: relative;
  height: 96px;
  min-height: 96px;
  padding: 14px 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border: 1px solid #ffffffd4;
  border-radius: 16px;
  background: linear-gradient(120deg, #e9eefcc7, #f1eaf8b3 55%, #e6f4efc7);
  box-shadow:
    0 6px 18px -10px #4f5f8a59,
    inset 0 1px 0 #ffffffd9;
  overflow: hidden;
}
/* 文字状态（无数据、出错）居中显示。 */
.cf-analysis-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 6px;
  color: #6c7b93;
  text-align: center;
}
.cf-analysis-state.cf-analysis-error {
  color: #a0623f;
}
/* 右上角的小状态：计算中是转圈，拖动或输入途中是「还只是估算值」的提示。 */
.cf-analysis-status {
  position: absolute;
  top: 10px;
  right: 14px;
  display: flex;
  align-items: center;
  color: #8591a6;
  font-size: var(--cf-font-size-xs);
  line-height: 1.4;
}
.cf-analysis-spinner {
  flex: none;
  width: 12px;
  height: 12px;
  border: 2px solid #9badd84d;
  border-top-color: #8b9ddd;
  border-radius: 50%;
  animation: cf-analysis-spin 0.8s linear infinite;
}
@keyframes cf-analysis-spin {
  to {
    transform: rotate(360deg);
  }
}
/*
 * 结果分左右两栏：左边是名次（最大的数字），
 * 右边是评级从赛前到赛后的变化，带涨跌分和一条按档位着色的渐变线。
 */
.cf-analysis-outcome {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.3fr);
  align-items: center;
}
.cf-analysis-hero {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding-right: 16px;
}
.cf-analysis-journey {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  padding-left: 16px;
  border-left: 1px solid #c7d2e6a6;
}
.cf-analysis-result small {
  overflow: hidden;
  color: #7684a0;
  font-size: var(--cf-font-size-xs);
  line-height: 1.4;
  letter-spacing: 0.03em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cf-analysis-hero strong {
  color: #36466b;
  font-size: calc(30px * var(--cf-font-scale));
  font-weight: var(--cf-font-weight-bold);
  line-height: 1.15;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
/* 名次后面的总人数：小一号、浅一级，交代「在多少人里」。 */
.cf-analysis-hero strong i {
  margin-left: 2px;
  color: #8f9bb2;
  font-size: var(--cf-font-size-base);
  font-style: normal;
  font-weight: var(--cf-font-weight-medium);
  letter-spacing: 0;
}
.cf-analysis-ratings {
  display: flex;
  align-items: baseline;
  gap: 7px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.cf-analysis-ratings span {
  font-size: calc(15px * var(--cf-font-scale));
  font-weight: var(--cf-font-weight-semibold);
  opacity: 0.82;
}
.cf-analysis-ratings svg {
  align-self: center;
  flex: none;
  width: 22px;
  height: 11px;
  fill: none;
  stroke: #9aa6bd;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.cf-analysis-ratings strong {
  font-size: calc(22px * var(--cf-font-scale));
  font-weight: var(--cf-font-weight-bold);
  line-height: 1.2;
}
/* 还只是估算的那一头调淡，精确结果回来后恢复。 */
.cf-analysis-hero strong > span,
.cf-analysis-ratings strong,
.cf-analysis-delta {
  transition: opacity var(--cf-duration-fast) ease;
}
.cf-analysis-hero .cf-analysis-estimate,
.cf-analysis-ratings.cf-analysis-estimate strong,
.cf-analysis-ratings.cf-analysis-estimate .cf-analysis-delta {
  opacity: 0.5;
}
.cf-analysis-delta {
  align-self: center;
  margin-left: auto;
  padding: 2px 9px;
  border-radius: 999px;
  background: #e9edf3;
  color: #6b7686;
  font-size: var(--cf-font-size-base);
  font-style: normal;
  font-weight: var(--cf-font-weight-bold);
  line-height: 1.5;
}
.cf-analysis-delta[data-sign='up'] {
  background: #dff5e6;
  color: #1b8a48;
}
.cf-analysis-track {
  display: block;
  height: 4px;
  margin-top: 3px;
  border-radius: var(--cf-radius-xs);
  opacity: 0.85;
}
/* 两根轴：上面一行是名称和可直接输入的数值，下面是带色带、刻度和小旗的滑杆。 */
.cf-analysis-axis {
  margin-top: 16px;
}
.cf-analysis-axis-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}
.cf-analysis-axis-head label {
  color: #51607b;
  font-weight: var(--cf-font-weight-semibold);
}
.cf-analysis-axis-head input {
  box-sizing: border-box;
  width: 96px;
  height: 32px;
  border: 1px solid #c9d3e6;
  border-radius: var(--cf-radius-lg);
  padding: 0 10px;
  background: #fbfcffd1;
  box-shadow: inset 0 1px 2px #5a6a8f12;
  color: #425674;
  font: inherit;
  font-size: calc(15px * var(--cf-font-scale));
  font-weight: var(--cf-font-weight-semibold);
  font-variant-numeric: tabular-nums;
  text-align: right;
  transition:
    border-color var(--cf-duration-fast) ease,
    box-shadow var(--cf-duration-fast) ease,
    background-color var(--cf-duration-fast) ease;
}
.cf-analysis-axis-head input:focus {
  border-color: #9badd8;
  background: var(--cf-white-surface);
  box-shadow: 0 0 0 3px #9badd838;
  outline: none;
}
.cf-analysis-axis-head input:disabled {
  opacity: 0.6;
}
/* 滑块直径 18px：色带、刻度与小旗都向内收 9px，才与滑块圆心的行程对齐。 */
.cf-analysis-rail {
  position: relative;
  height: 54px;
}
.cf-analysis-band {
  position: absolute;
  left: 9px;
  right: 9px;
  top: 22px;
  height: 8px;
  border-radius: var(--cf-radius-xs);
  background: #d7deec;
  /* 里面的色带换配色时两条叠着过渡，叠放的先后只在这一小块里算。 */
  overflow: hidden;
  isolation: isolate;
}
/* 色带上沿的一道内阴影，盖在颜色上面。 */
.cf-analysis-band::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
  box-shadow: inset 0 1px 2px #2634531f;
  pointer-events: none;
}
/* 色带的颜色。配色换了（难度分的显示样式切换、「沿用难度分样式」开关）时，新的一条盖在旧的上面淡入，
   旧的等它淡完再撤掉。 */
.cf-analysis-paint {
  position: absolute;
  inset: 0;
}
.cf-analysis-paint-enter-active {
  z-index: 1;
  transition: opacity var(--cf-duration-moderate) ease;
}
.cf-analysis-paint-enter-from {
  opacity: 0;
}
.cf-analysis-paint-leave-active {
  transition: opacity var(--cf-duration-moderate) ease;
}
.cf-analysis-marks {
  position: absolute;
  left: 9px;
  right: 9px;
  top: 0;
  bottom: 0;
  pointer-events: none;
}
.cf-analysis-tick {
  position: absolute;
  top: 36px;
  transform: translateX(-50%);
  color: #7684a0;
  font-size: var(--cf-font-size-xs);
  line-height: 1.3;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  /* 范围换了：还在的刻度滑到新位置，换掉的淡出、新来的淡入。 */
  transition:
    left var(--cf-duration-moderate) ease,
    opacity var(--cf-duration-base) ease;
}
.cf-analysis-mark-enter-from,
.cf-analysis-mark-leave-to {
  opacity: 0;
}
.cf-analysis-tick::before {
  content: '';
  display: block;
  width: 1px;
  height: 5px;
  margin: 0 auto 1px;
  background: #a9b3c6;
}
/* 小旗：一根细杆立在对应位置上，文字默认居中，两面旗挨得近时分到两侧。 */
.cf-analysis-flag {
  position: absolute;
  top: 0;
  width: 0;
  color: #51607b;
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-semibold);
  line-height: 1.3;
  white-space: nowrap;
  /* 小旗出现、消失时淡入淡出（名次轴上「不掉分」那一面要等曲线算完才有）；位置变了滑过去，文字换边时也滑过去。 */
  transition:
    left var(--cf-duration-moderate) ease,
    opacity var(--cf-duration-base) ease;
}
.cf-analysis-flag > span {
  position: absolute;
  top: 0;
  left: 0;
  transform: translateX(-50%);
  transition: transform var(--cf-duration-moderate) ease;
}
.cf-analysis-flag[data-side='left'] > span {
  transform: translateX(calc(-100% - 3px));
}
.cf-analysis-flag[data-side='right'] > span {
  transform: translateX(3px);
}
.cf-analysis-flag::after {
  content: '';
  position: absolute;
  left: -0.5px;
  top: 15px;
  width: 1px;
  height: 16px;
  background: #51607b99;
}
.cf-analysis-rail input[type='range'] {
  position: absolute;
  left: 0;
  top: 15px;
  width: 100%;
  height: 22px;
  margin: 0;
  padding: 0;
  background: transparent;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}
/* 滑块描边的颜色是从这个变量来的；登记成颜色类型，它才能带着过渡变（换配色、拖过档位分界时）。 */
@property --cf-analysis-thumb {
  syntax: '<color>';
  inherits: true;
  initial-value: #8f9fd8;
}
.cf-analysis-rail input[type='range'] {
  transition: --cf-analysis-thumb var(--cf-duration-base) ease;
}
.cf-analysis-rail input[type='range']:focus {
  outline: none;
}
.cf-analysis-rail input[type='range']:disabled {
  cursor: default;
  opacity: 0.6;
}
.cf-analysis-rail input[type='range']::-webkit-slider-runnable-track {
  height: 22px;
  background: transparent;
}
.cf-analysis-rail input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  box-sizing: border-box;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  border: 3px solid var(--cf-analysis-thumb, #8f9fd8);
  border-radius: 50%;
  background: var(--cf-white-surface);
  box-shadow: 0 2px 6px #26345340;
}
.cf-analysis-rail input[type='range']:focus-visible::-webkit-slider-thumb {
  box-shadow:
    0 2px 6px #26345340,
    0 0 0 4px #9badd859;
}
.cf-analysis-rail input[type='range']::-moz-range-track {
  height: 22px;
  background: transparent;
}
.cf-analysis-rail input[type='range']::-moz-range-thumb {
  box-sizing: border-box;
  width: 18px;
  height: 18px;
  border: 3px solid var(--cf-analysis-thumb, #8f9fd8);
  border-radius: 50%;
  background: var(--cf-white-surface);
  box-shadow: 0 2px 6px #26345340;
}
.cf-analysis-rail input[type='range']:focus-visible::-moz-range-thumb {
  box-shadow:
    0 2px 6px #26345340,
    0 0 0 4px #9badd859;
}
/* 常用目标：一排小胶囊按钮。 */
@keyframes cf-analysis-shortcut-in {
  from {
    opacity: 0;
  }
}
/* 这一行的位置一直留着：按钮要等可达范围算出来才有，不留的话它们一出现弹窗就高出一截。 */
.cf-analysis-shortcuts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 28px;
  margin-top: 12px;
}
.cf-analysis-shortcuts button {
  animation: cf-analysis-shortcut-in 200ms ease;
  padding: 4px 11px;
  border: 1px solid #c9d3e6;
  border-radius: 999px;
  background: #ffffffa6;
  color: #51607b;
  font: inherit;
  font-size: var(--cf-font-size-base);
  line-height: 1.5;
  cursor: pointer;
  transition:
    border-color var(--cf-duration-fast) ease,
    background-color var(--cf-duration-fast) ease;
}
.cf-analysis-shortcuts button:hover {
  border-color: #9badd8;
  background: var(--cf-white-surface);
}
.cf-analysis-shortcuts button:focus-visible {
  outline: 2px solid #9badd8;
  outline-offset: 1px;
}
/*
 * 底部提示：一块半透明面板，上面是带图标的「提示」小标题，下面逐条列出固定说明。
 * 快照带有提醒（如评级抓取偏晚）时，接在最后，用琥珀色和三角图标区分。
 */
.cf-analysis-notes {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px solid #ffffffc9;
  border-radius: var(--cf-radius-xl);
  background: #ffffff66;
}
.cf-analysis-notes-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: #5a6a8c;
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-semibold);
  letter-spacing: 0.06em;
  line-height: 1.6;
}
/* 每条提示前面一个小圆点，文字与标题里的字对齐。 */
.cf-analysis-tip {
  position: relative;
  margin: 0;
  padding-left: 20px;
  color: #6b7a90;
  font-size: var(--cf-font-size-xs);
  line-height: 1.6;
}
.cf-analysis-tip::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 0.65em;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #8a9bd0;
}
.cf-analysis-note {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  gap: 6px;
  margin: 2px 0 0;
  padding-top: 7px;
  border-top: 1px solid #dbe2f0a6;
  color: #6b7a90;
  font-size: var(--cf-font-size-xs);
  line-height: 1.6;
}
.cf-analysis-notes-title svg,
.cf-analysis-note svg {
  flex: none;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: #8a9bd0;
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.cf-analysis-note svg {
  margin-top: 2px;
}
.cf-analysis-note-dot {
  fill: #8a9bd0;
  stroke: none;
}
.cf-analysis-warning {
  color: #8e6843;
}
.cf-analysis-warning svg {
  stroke: #d39a3d;
}
.cf-analysis-warning .cf-analysis-note-dot {
  fill: #d39a3d;
}
@media (max-width: 520px) {
  .cf-analysis-content {
    padding: 12px 15px;
  }
  .cf-analysis-result {
    height: auto;
  }
  .cf-analysis-outcome {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .cf-analysis-hero {
    padding-right: 0;
  }
  .cf-analysis-journey {
    padding: 10px 0 0;
    border-top: 1px solid #c7d2e6a6;
    border-left: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cf-analysis-content,
  .cf-analysis-hero strong > span,
  .cf-analysis-ratings strong,
  .cf-analysis-delta,
  .cf-analysis-axis-head input,
  .cf-analysis-shortcuts button,
  .cf-analysis-rail input[type='range'],
  .cf-analysis-paint-enter-active,
  .cf-analysis-paint-leave-active,
  .cf-analysis-tick,
  .cf-analysis-flag,
  .cf-analysis-flag > span {
    transition: none;
  }
  .cf-analysis-spinner,
  .cf-analysis-shortcuts button {
    animation: none;
  }
}
</style>
