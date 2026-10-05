import { appSettings } from '../../../../settings.js';
import { translate as t } from '../../../../i18n/index.js';
import { applyRatingStyle } from '../../../ratings/cells/style.js';
import { rankForRating, rankProgress } from '../algorithm/ranks.js';
import { getRatingTagStyle, getRatingBgColor } from '../../../ratings/rules.js';
import upIcon from '../../../../assets/icons/prediction/rank-up.svg?raw';
import downIcon from '../../../../assets/icons/prediction/rank-down.svg?raw';
import steadyIcon from '../../../../assets/icons/prediction/rank-steady.svg?raw';
import { utcOffsetLabel } from '../../../../utils/time.js';
const icons = { up: upIcon, down: downIcon, same: steadyIcon };

// 榜单快照的抓取时间：text 是按界面语言格式化的本地时间，zone 是本机时区。
// 两者分开给出，界面把时区排成原站比赛时间旁边那种上标小字。
export function snapshotTime(fetchedAt) {
  const date = new Date(fetchedAt);
  if (Number.isNaN(date.getTime())) return { text: '', zone: '' };
  return {
    text: date.toLocaleString(appSettings.general.lang === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    zone: utcOffsetLabel(-date.getTimezoneOffset()),
  };
}

// 浅色分析面板按评分档位着色，实心块模式取色块色而非白色反字。
export function predictionNumberColor(value, delta = false) {
  if (!Number.isFinite(value) && value !== Infinity) return undefined;
  if (delta) return value > 0 ? '#008000' : '#808080';
  if (!appSettings.contest.prediction.followRatingStyle || !appSettings.ratings.enabled)
    return rankForRating(value).color;
  return appSettings.ratings.style === 'tag'
    ? getRatingTagStyle(value).text
    : getRatingBgColor(value);
}

// 缺值是可见的 N/A，不沿用难度分组件的空值收起语义。
function plainValue(cell, value) {
  delete cell.dataset.cfRatingMode;
  delete cell.dataset.cfRatingEmpty;
  delete cell.dataset.rating;
  cell.style.removeProperty('background-color');
  let span = cell.querySelector('.cf-prediction-number');
  if (!span) {
    span = document.createElement('span');
    span.className = 'cf-prediction-number';
    cell.replaceChildren(span);
  }
  if (span.textContent !== value) span.textContent = value;
  span.classList.toggle('cf-prediction-unavailable', value === 'N/A');
}

// 表现分按评级着色；涨跌分始终绿色上涨、灰色下降，底板共用现有评分样式。
export function renderScore(cell, key, value) {
  const styled = appSettings.contest.prediction.followRatingStyle && appSettings.ratings.enabled;
  cell.classList.toggle(
    'cf-prediction-legendary',
    !styled &&
      key === 'performance' &&
      Number.isFinite(value) &&
      rankForRating(value).legendary === true,
  );
  if (!Number.isFinite(value) && value !== Infinity) {
    plainValue(cell, 'N/A');
    return;
  }
  const delta = key === 'delta';
  applyRatingStyle(cell, delta ? (value > 0 ? 1300 : 1000) : value, {
    value,
    prefix: delta && value > 0 ? '+' : '',
    enabled: styled,
    preserveBackground: true,
    textColor: delta
      ? value > 0
        ? '#008000'
        : '#808080'
      : styled
        ? undefined
        : rankForRating(value).color,
  });
  cell.style.setProperty(
    '--cf-rating-selected-color',
    delta ? (value > 0 ? '#008000' : '#808080') : rankForRating(value).color,
  );
}

// 图标资源仅来自本项目，方向不依赖平台是否支持特殊 Unicode 字符。
export function setRankIcon(element, direction) {
  if (element.dataset.direction === direction) return;
  element.dataset.direction = direction;
  element.innerHTML = icons[direction];
}

// 档位缩写保留 CF 经典色，完整解释统一放在单元格。
function rankLabel(rank) {
  const span = document.createElement('span');
  span.className = 'cf-prediction-tier';
  span.textContent = rank.abbr;
  span.style.color = rank.color;
  span.classList.toggle('cf-prediction-tier-legendary', Boolean(rank.legendary));
  return span;
}

const rankCellsToMeasure = new Set();
let rankMeasureFrame = 0;
// 紧凑标签的底板要贴着内容，宽度只能量出来。整张榜单的格子攒到同一帧里先全部读、再全部写，
// 避免逐格读写造成反复重排。
function measureRankContent(cell) {
  rankCellsToMeasure.add(cell);
  if (rankMeasureFrame) return;
  rankMeasureFrame = requestAnimationFrame(() => {
    rankMeasureFrame = 0;
    const widths = [...rankCellsToMeasure].map((item) => [
      item,
      item.querySelector('.cf-prediction-rank-change')?.offsetWidth,
    ]);
    rankCellsToMeasure.clear();
    for (const [item, width] of widths)
      if (width) item.style.setProperty('--cf-rank-content', width + 'px');
  });
}

// 历史包含 P → P 之类的持平；实时显示到下一评级档位所需的增分。
export function renderRankProgress(cell, record, result, phase) {
  const progress = rankProgress(record, result?.delta, phase);
  // 以实际分数作渐变端点；分数持平时两端同色，照样有底色。只有缺值时保留原站斑马纹。
  const before = progress?.final ? progress.before : record?.rating;
  const after = progress?.final
    ? progress.after
    : Number.isFinite(result?.delta)
      ? before + result.delta
      : null;
  // 底色与表现分、涨跌分一致：只有「沿用难度分样式」开启时才有，并跟随难度分的三种样式。
  const styled = appSettings.contest.prediction.followRatingStyle && appSettings.ratings.enabled;
  const gradient = styled && progress && Number.isFinite(before) && Number.isFinite(after);
  const tag = appSettings.ratings.style === 'tag';
  // 标签且不铺满时底板收成内容四周的小标签，否则铺满整个单元格。
  const compact = tag && appSettings.ratings.tagFillCell === false;
  // 显隐与形状分开记：关闭底色时底板在原来的形状上淡出，不会边淡出边变形。
  cell.dataset.cfRankMode = gradient ? 'tinted' : 'plain';
  cell.dataset.cfRankShape = compact ? 'compact' : 'full';
  // 没有底色时不清掉颜色，让底板带着原来的颜色淡出。
  if (gradient) {
    const wash = (color, share) => `color-mix(in srgb, ${color} ${share}%, transparent)`;
    const fill = (rating) =>
      compact
        ? getRatingTagStyle(rating).bg
        : tag
          ? wash(getRatingTagStyle(rating).bg, 75)
          : wash(getRatingBgColor(rating), 24);
    // 铺满时边框与底色同色，等于没有边框；紧凑标签才用标签的描边色。
    const edge = (rating) => (compact ? getRatingTagStyle(rating).border : fill(rating));
    cell.style.setProperty('--cf-rank-from', fill(before));
    cell.style.setProperty('--cf-rank-to', fill(after));
    cell.style.setProperty('--cf-rank-border-from', edge(before));
    cell.style.setProperty('--cf-rank-border-to', edge(after));
  }
  measureRankContent(cell);
  // 提示里带计评级名次，名次变了也要重画。
  const ratedRank = Number.isInteger(result?.rank) ? result.rank : null;
  const signature = JSON.stringify([progress, appSettings.general.lang, ratedRank]);
  if (cell.dataset.rankSignature === signature) return;
  cell.dataset.rankSignature = signature;
  cell.removeAttribute('data-tooltip-variant');
  if (!progress) {
    plainValue(cell, 'N/A');
    cell.dataset.tooltip = t('predictionNotApplicable');
    return;
  }
  const { current, next, direction, final, needed } = progress;
  const content = document.createElement('span');
  content.className = 'cf-prediction-rank-change';
  const icon = document.createElement('span');
  icon.className = 'cf-prediction-rank-arrow';
  setRankIcon(icon, direction);
  icon.style.color = next.color;
  if (final) {
    content.append(rankLabel(current), icon, rankLabel(next));
    const key =
      direction === 'up'
        ? 'predictionRankUp'
        : direction === 'down'
          ? 'predictionRankDown'
          : 'predictionRankSame';
    cell.dataset.tooltip = [
      `${current.name} → ${next.name}`,
      `${progress.before} → ${progress.after}` + (ratedRank === null ? '' : ` (#${ratedRank})`),
      t(key),
    ].join('\n');
    cell.dataset.tooltipVariant = 'prediction-rank';
  } else if (needed !== null) {
    const amount = document.createElement('span');
    amount.className = 'cf-prediction-rank-needed';
    amount.textContent = '+' + needed;
    content.append(amount, icon, rankLabel(next));
    cell.dataset.tooltip = t('predictionNextRank', needed, next.name);
  } else {
    content.append(rankLabel(next), icon, rankLabel(next));
    cell.dataset.tooltip = t('predictionTopRank');
  }
  cell.replaceChildren(content);
}
