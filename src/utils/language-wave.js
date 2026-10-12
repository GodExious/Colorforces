/*
 * 换语言时界面的过渡：逐项波浪。
 *
 * 以「项」为单位：菜单的一行设置、一个页签、一条说明、卡片的标题栏、名单里的一个人、弹窗的一个步骤……
 * 文字变了的项，旧内容先整体淡出，新内容再在原处淡入；同一个界面里从上到下一项接一项，像一道波浪。
 * 没变的项不动。项变高变宽时，它的框带着过渡变到新大小，下面的东西由排版带着平滑挪过去。
 *
 * 做法：换语言之前，把每一项原样复制一份（旧内容的照片）。换完之后，文字变了的项先把新内容藏起来（全透明），
 * 把照片贴在自己里面的原处；轮到它时照片淡出、新内容淡入。照片没有底色，新内容也只是改透明度，
 * 所以这一项后面不管是纯色、渐变、磨砂还是被遮罩压暗，都不会多出一块颜色；项自己的底色和边框从头到尾不动。
 *
 * 哪些算界面、哪些算项，都是照着页面结构自己认的，各个页面不用单独标：
 * - 界面：菜单、数据分析面板这些在根元素上标了 data-cf-language-surface 的，以及所有弹窗的卡片。各界面同时起波，互不等待。
 * - 项：直接带着文字的元素，取它所在的设置行、图表的标题栏（或标了 data-cf-language-unit 的元素）；都不是时取它的上一层。
 *   上一层太大（里面有很多段文字，比如一整张列表）时就取这个元素自己。一项套着另一项时，只算外面的那一项。
 * - 图表里的文字（在 svg 里）由图表自己过渡，代码块、输入框也不算。
 * - 有的内容换语言时是整段重新生成的（帮助说明的正文是拼好的一整段 HTML），原来的元素换完就不在页面上了。
 *   这时按它原来在界面里的位置（第几层的第几个）找到顶替它的新元素，在新元素上接着做过渡。
 * - 点开的浮层（标了 data-cf-language-keep，比如图表标题栏里的年份小表）要一直完整地盖在别的东西上面，
 *   所以装着它的元素不能整个当一项，见 unitsOf。
 */

const SURFACES = '[data-cf-language-surface], .cf-aurora-card';
const UNITS = '[data-cf-language-unit], .cf-setting-item, .cf-analytics-card-head';
// 上一轮过渡留下、还没拿掉的照片也不算。
const SKIPPED =
  'svg, canvas, pre, code, textarea, select, script, style, [data-cf-language-skip], .cf-language-ghost';
const KEPT = '[data-cf-language-keep]';
// 表格的行没法在里面贴照片（格子的宽度对不上），所以表格里以格子为项。
const TABLE_PARTS = new Set(['TR', 'TBODY', 'THEAD', 'TFOOT', 'TABLE']);
// 上一层里的文字超过这么多段，就不拿上一层当项了。
const CROWD = 8;
const GHOST_CLASS = 'cf-language-ghost';

// 各段的时长（毫秒）：旧内容淡出、新内容淡入、大小和位置的过渡。
const OUT = 80;
const IN = 190;
const MOVE = 300;
// 相邻两项相隔多久；一个界面里从第一项到最后一项最多相隔多久。项多了，间隔自动变短，整道波浪不会拖长。
const STEP = 24;
const SPAN = 220;
const EASE = 'cubic-bezier(.22,1,.36,1)';

// 一个界面里 count 项各自晚多久开始（毫秒），按从上到下的顺序。
export function waveDelays(count, step = STEP, span = SPAN) {
  const gap = count > 1 ? Math.min(step, span / (count - 1)) : 0;
  return Array.from({ length: Math.max(0, count) }, (_, index) => index * gap);
}

/*
 * 一项的大小过渡什么时候开始、用多久、怎么走。delay 是这一项在波浪里轮到的时间。
 * 平常：轮到它时开始，固定的时长，缓动开头很快、后面慢慢停——变化只有几个像素、一行字时这样最利落。
 * 高度变得多的（超过 LONG，一行多；比如弹窗底部的整段说明，中文和英文差两三行）不能这样走：
 * 这种缓动头两帧就走完七八成，三十多像素看上去就是一下子跳过去的，弹窗又是上下居中的，上下两条边一起跳。
 * 所以换成起步和收尾都平的缓动，时间也跟着距离加长，到上限为止。
 * 变高的还要提前：从波浪一开始就动，不等轮到它——等轮到它才开始的话，新的文字已经淡进来了，框还没撑开，
 * 字的下半截被裁着；提前之后框先撑开、字再进来，至少持续到轮到它之后 LEAD 毫秒。
 * 变矮的照旧等轮到它（旧的文字淡掉之后）再收。宽度的变化不算：按钮、标签变宽变窄本来就该利落。
 */
const LONG = 24;
const LONG_BASE = 360;
const LONG_RATE = 2.5;
const LONG_LIMIT = 620;
const LONG_EASE = 'cubic-bezier(.4,0,.2,1)';
const LEAD = 200;
export function moveTiming(heightChange, delay = 0) {
  const extra = Math.abs(heightChange) - LONG;
  if (!(extra > 0)) return { delay, duration: MOVE, easing: EASE };
  const duration = Math.round(Math.min(LONG_LIMIT, LONG_BASE + extra * LONG_RATE));
  return heightChange > 0
    ? { delay: 0, duration: Math.max(duration, delay + LEAD), easing: LONG_EASE }
    : { delay, duration, easing: LONG_EASE };
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// 元素自己直接带着文字（不算里面的元素带的）。
function textual(element) {
  for (const node of element.childNodes) if (node.nodeType === 3 && node.data.trim()) return true;
  return false;
}
// 看得见：在显示、没被藏起来，并且落在窗口里。
function shown(element) {
  const visible = element.checkVisibility
    ? element.checkVisibility({
        opacityProperty: true,
        visibilityProperty: true,
        checkOpacity: true,
        checkVisibilityCSS: true,
      })
    : element.getClientRects().length > 0;
  if (!visible) return false;
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < innerHeight &&
    rect.left < innerWidth
  );
}

// 一个界面里的各项。
function unitsOf(surface) {
  const crowds = new Map();
  const crowded = (parent) => {
    if (!crowds.has(parent)) {
      let count = 0;
      for (const node of parent.querySelectorAll('*')) if (textual(node) && ++count > CROWD) break;
      crowds.set(parent, count > CROWD);
    }
    return crowds.get(parent);
  };
  const found = new Set();
  for (const element of surface.querySelectorAll('*')) {
    if (!textual(element) || element.closest(SKIPPED)) continue;
    // 套在这个界面里的另一个界面（比如菜单里的贡献者名单）各算各的。
    if (element.closest(SURFACES) !== surface) continue;
    let unit = element.closest(UNITS);
    // 装着浮层的元素不整个当一项：一项过渡时，它里面的东西要先变透明再变回来，浮层跟着变透明，
    // 后面的图表就透了出来；透明度一变，浮层的层级也只在这一小块里算数，会被后面的图表盖住。
    // 改成里面的文字各算各的，浮层自己不动，只有它里面换了字的那一格过渡。
    if (unit?.querySelector(KEPT)) unit = null;
    if (!unit || unit === surface || !surface.contains(unit)) {
      const parent = element.parentElement;
      const usable =
        parent &&
        parent !== surface &&
        !TABLE_PARTS.has(parent.tagName) &&
        !crowded(parent) &&
        !parent.querySelector(KEPT);
      unit = usable ? parent : element;
    }
    found.add(unit);
  }
  const list = [...found];
  return list.filter((unit) => !list.some((other) => other !== unit && other.contains(unit)));
}

// 一项在界面里的位置：从界面往下，每一层是第几个子元素。
function pathOf(unit, surface) {
  const path = [];
  for (let node = unit; node !== surface; node = node.parentElement)
    path.unshift(Array.prototype.indexOf.call(node.parentElement.children, node));
  return path;
}
// 换完语言之后这一项是哪个元素。一般还是原来那个；原来那个已经不在页面上时（整段重新生成了），
// 按原来的位置找顶替它的元素，标签和样式类都对得上才认。找不到就不做过渡。
function successor(shot) {
  if (shot.unit.isConnected) return shot.unit;
  let node = shot.surface;
  for (const index of shot.path) node = node?.children[index];
  const same =
    node?.isConnected &&
    node.tagName === shot.unit.tagName &&
    node.className === shot.unit.className;
  return same ? node : null;
}

// 换语言之前：记下各个界面里看得见的项的样子。
function capture() {
  const shots = [];
  for (const surface of document.querySelectorAll(SURFACES)) {
    if (surface.closest(`.${GHOST_CLASS}`) || !shown(surface)) continue;
    // 界面自己原来的大小：换完之后它的高度要是有没管住的变化，靠这个做过渡，见 start。
    const frame = surface.getBoundingClientRect();
    for (const unit of unitsOf(surface)) {
      if (!shown(unit)) continue;
      shots.push({
        surface,
        frame,
        unit,
        path: pathOf(unit, surface),
        text: unit.textContent,
        rect: unit.getBoundingClientRect(),
        ghost: unit.cloneNode(true),
      });
    }
  }
  return shots;
}

// 把复制出来的旧内容收拾成一张照片：不响应操作、不带底色和边框（见样式里的 cf-language-ghost）。
// 只去掉会和原来的元素撞上的几个属性（id、表单控件的 name、标签的 for）。别的属性都留着，
// 尤其是 data- 开头的：组件里带作用域的样式就是靠 data-v-xxx 认元素的，去掉之后照片里的图标、头像
// 没了尺寸，会按原图的大小显示出来。
function prepareGhost(ghost) {
  for (const node of [ghost, ...ghost.querySelectorAll('[id], [for], [name]')])
    for (const name of ['id', 'for', 'name']) node.removeAttribute(name);
  ghost.classList.add(GHOST_CLASS);
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  // 这一项本身若是半透明的，照片在它里面已经跟着变淡了，自己不能再淡一次。
  ghost.style.opacity = '1';
}

const sizeFrame = (rect, width, height) => ({
  ...(width
    ? { width: `${rect.width}px`, minWidth: `${rect.width}px`, maxWidth: `${rect.width}px` }
    : {}),
  ...(height
    ? { height: `${rect.height}px`, minHeight: `${rect.height}px`, maxHeight: `${rect.height}px` }
    : {}),
  boxSizing: 'border-box',
  overflow: 'clip',
});

// 换完语言之后：文字变了的项开始过渡。返回这一轮的动画和收尾的办法。
function start(shots) {
  const live = shots
    .map((shot) => ({ ...shot, unit: successor(shot) }))
    .filter((shot) => shot.unit && shot.unit.textContent !== shot.text);
  const animations = [];
  const undo = [];
  // 各项晚多久开始：各界面各排各的，按原来的位置从上到下、从左到右。
  const delays = new Map();
  for (const surface of new Set(live.map((shot) => shot.surface))) {
    const own = live
      .filter((shot) => shot.surface === surface)
      .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
    waveDelays(own.length).forEach((delay, index) => delays.set(own[index], delay));
  }
  // 各个界面换完之后本来的高度，趁还没把各项按住的时候量。
  const surfaces = new Map();
  for (const shot of live)
    if (!surfaces.has(shot.surface) && shot.surface.isConnected)
      surfaces.set(shot.surface, {
        before: shot.frame.height,
        after: shot.surface.getBoundingClientRect().height,
      });
  // 大小：各项先停在旧大小上，轮到它时再过渡到新大小。
  const natural = new Map(live.map((shot) => [shot, shot.unit.getBoundingClientRect()]));
  // 各个界面里，最晚的那一项的大小过渡到什么时候结束。
  const settled = new Map();
  for (const shot of live) {
    const next = natural.get(shot);
    const width = Math.abs(shot.rect.width - next.width) > 0.5;
    const height = Math.abs(shot.rect.height - next.height) > 0.5;
    if (!width && !height) continue;
    // 宽窄变了、换之前和换之后里面都只有一行字的项（按钮、标签、「收起」这样的链接），过渡期间不许折行。
    // 不然新文字比旧的长时，它被按在旧的宽度上，字折成两行、把这一项撑高一截，等宽度到位又缩回去，
    // 周围的东西就跟着上下跳一下。里面并排放着几样东西、放不下会换行的也一样
    //（更新日志里版本号后面的「最新」标签，会被挤到第二行一瞬间），所以并排的也不许换行。
    // 判断的是「前后都只有一行」，不是「高度一点没变」：中文和英文的行高常常差一两个像素
    //（更新提示里「不再自动检测更新」那一行就是），按高度没变来判会漏掉。
    const style = getComputedStyle(shot.unit);
    const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    const chrome =
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom) +
      parseFloat(style.borderTopWidth) +
      parseFloat(style.borderBottomWidth);
    const single = (rect) => rect.height - chrome <= line * 1.6;
    const oneLine =
      width && single(shot.rect) && single(next)
        ? { whiteSpace: 'nowrap', flexWrap: 'nowrap' }
        : {};
    const frame = (rect) => ({ ...sizeFrame(rect, width, height), ...oneLine });
    const timing = moveTiming(next.height - shot.rect.height, delays.get(shot));
    settled.set(
      shot.surface,
      Math.max(settled.get(shot.surface) ?? 0, timing.delay + timing.duration),
    );
    animations.push(
      shot.unit.animate([frame(shot.rect), frame(next)], { ...timing, fill: 'both' }),
    );
  }
  // 界面整体的高度：各项都按住了，界面的高度应当还是换之前的。要是不是，说明里面有没被管住的变化
  //（不在窗口里的项、认不出来的内容），界面会一下子变高或变矮。这时让界面自己的高度也带着过渡走，
  // 从换之前走到换之后，时长盖住里面各项的大小过渡。各项都管住了的界面不受影响。
  for (const [surface, { before, after }] of surfaces) {
    const held = surface.getBoundingClientRect().height;
    if (Math.abs(held - before) <= 1 || Math.abs(after - before) <= 1) continue;
    const frame = (height) => ({
      height: `${height}px`,
      minHeight: `${height}px`,
      maxHeight: `${height}px`,
      boxSizing: 'border-box',
      overflow: 'clip',
    });
    animations.push(
      surface.animate([frame(before), frame(after)], {
        duration: Math.max(settled.get(surface) ?? 0, moveTiming(after - before).duration),
        easing: moveTiming(after - before).easing,
        fill: 'both',
      }),
    );
  }
  // 位置：在各项还停在旧大小上的这一刻量。大小变化带来的挪动由排版完成，这里只补其余的部分。
  for (const shot of live) {
    const now = shot.unit.getBoundingClientRect();
    const x = shot.rect.left - now.left;
    const y = shot.rect.top - now.top;
    if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) continue;
    animations.push(
      shot.unit.animate([{ translate: `${x}px ${y}px` }, { translate: '0px 0px' }], {
        duration: MOVE,
        easing: EASE,
      }),
    );
  }
  // 内容：新内容先藏着，旧内容的照片贴在原处；轮到这一项时照片淡出，接着新内容淡入。
  for (const shot of live) {
    const { unit, ghost } = shot;
    const delay = delays.get(shot);
    const style = getComputedStyle(unit);
    const color = style.color;
    const children = [...unit.children];
    // 这一项自己直接带着文字时，文字没法单独改透明度，改成让文字的颜色从透明过渡回来。
    const loose = textual(unit);
    prepareGhost(ghost);
    if (loose) ghost.style.color = color;
    if (style.position === 'static') {
      const position = unit.style.position;
      unit.style.position = 'relative';
      undo.push(() => (unit.style.position = position));
    }
    unit.appendChild(ghost);
    undo.push(() => ghost.remove());
    animations.push(
      ghost.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: OUT,
        delay,
        easing: 'ease-in',
        fill: 'both',
      }),
    );
    const enter = { duration: IN, delay: delay + OUT, easing: 'ease-out', fill: 'backwards' };
    // 只写起点：终点是它本来的样子（有的内容本来就是半透明的）。
    for (const child of children)
      animations.push(child.animate([{ opacity: 0, offset: 0 }], enter));
    if (loose) animations.push(unit.animate([{ color: 'transparent', offset: 0 }], enter));
  }
  let cleared = false;
  return {
    done: Promise.allSettled(animations.map((animation) => animation.finished)),
    clear() {
      if (cleared) return;
      cleared = true;
      animations.forEach((animation) => animation.cancel());
      undo.forEach((step) => step());
    },
  };
}

let current = null;
// 立刻结束正在播的这一轮：界面直接到位。切页、关菜单时用。
export function finishLanguageWave() {
  current?.clear();
  current = null;
}

// 带着过渡换语言。apply 做真正的切换，并返回一个在界面更新完之后兑现的 Promise。
// 上一轮还没播完时直接结束它，从现在的画面开始新的一轮。
export async function runLanguageWave(apply) {
  finishLanguageWave();
  if (reducedMotion()) {
    await apply();
    return;
  }
  const shots = capture();
  await apply();
  const run = start(shots);
  current = run;
  await run.done;
  if (current === run) finishLanguageWave();
}
