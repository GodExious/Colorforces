import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { init, use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent } from 'echarts/components';
import { LabelLayout } from 'echarts/features';
import { SVGRenderer } from 'echarts/renderers';

// LabelLayout 必须在这里显式登记：柱子上的数字随数值变化滚动（valueAnimation）是由它驱动的。
// 图表库的 core 入口本来会自己登记它，但那是一句「只有副作用」的代码，打包时被当作无用代码剔除了，
// 结果打包后的脚本里没有它：图表照常显示，柱子也有过渡，唯独数字直接跳到新值。
// 在 Node 里直接引入图表库时不经过打包，这个问题不会出现，所以要以打包产物为准来核对。
use([BarChart, GridComponent, LabelLayout, SVGRenderer]);

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/*
 * 悬停提示不用图表库自带的那个：它用位移变换跟着鼠标走，浏览器把它单独合成，
 * 移动中和停在半个像素上时文字都会发虚，在缩放不是整数倍的屏幕上尤其明显，看起来时清时糊。
 * 这里自己放一个提示：固定在被悬停的那根柱子旁边、不跟着鼠标走，
 * 位置用 left / top 对齐到屏幕的物理像素，所以文字始终是清楚的。
 *
 * tip.hit(x, y, chart) 判断鼠标落在哪根柱子的悬停范围里（x、y 是图表内的像素坐标），
 *   返回 { seriesIndex, dataIndex, value, ... }，不在任何一根的范围里返回 null。
 *   系列数量会变的图表（见 useChart 的 replaced）要用 seriesId 代替 seriesIndex：
 *   增减系列之后，图表库里各个系列的序号不一定还和配置里的顺序一致，按序号会找错。
 *   还可以带上 emphasis（如 { seriesIndex: [0, 1], dataIndex }），指定要一起强调的图形。
 *   范围由各图表自己定：从柱子的数字标注起、连同柱子本身和两者之间的空隙，是连成一片的；
 *   所以这里不靠图表库「鼠标压在图形上」的事件，那样在数字和柱子之间会断开。
 * tip.content(params) 返回一段文字，或者 { lead, text, background, border, leadColor, items }：
 *   lead 是开头加粗的一小段（可以单独着色），text 是后面的说明，background / border 是面板的底色和边线色。
 *   items 可选，是标题行下面逐条列出的内容（比如某一天通过的题）：[{ label, text, value, color, href, muted }]，
 *   label 和 value 用 color 着色；有 href 的整行是一个链接；muted 的一行整体用灰色、不加粗。
 *   有 href 的行再给 action 为真时，画成一眼看得出能点的样子（链接色、下划线、行尾一个箭头）；
 *   同时是 muted 的行保持灰色，只加下划线和箭头。
 *   text 也可以是一个数组，把一段文字分成几截各自着色：其中的字符串原样写出，
 *   { text, color } 是加粗并着色的一截（比如按档位着色的评级）。
 *   其中也可以夹一行小标题 { heading }，把后面的几行归成一组。
 *   params 是 hit 返回的东西。
 * tip.pinnable 为真表示提示里有能点的东西（链接）。平时提示仍然只是跟着悬停走，不接收鼠标，也不挡下面的图形；
 *   点一下被悬停的图形，提示就固定在原处，鼠标可以移进去点里面的链接。
 *   再点一下那个图形，或者鼠标进了提示之后又移出去，就恢复成跟着悬停走。
 *   固定着的时候点别的图形，提示换到那个图形上并固定；点图表的空白处或图表以外的地方也会恢复。
 * tip.horizontal 为真表示横向柱状图：提示放在柱子末端的上方；否则放在柱顶数字的上方。
 * tip.point(params, chart) 可选，用于不是柱状图的图表：返回提示要对准的位置（图表内的像素坐标）。
 * tip.gap 可选：提示的底边离对准的位置多少像素；不给时按柱状图的间距。
 * tip.label(x, y, chart) 可选，用于图形以外的文字（比如被省略的名称）：鼠标不在任何图形的悬停范围里时用它判断，
 *   返回 { key, text, point }，key 用来分辨是不是同一处文字，point 是提示要对准的位置（图表内的像素坐标）；
 *   不需要提示时返回 null。
 *
 * 提示的面板只有一个，一直留着，换内容时只改它的文字和颜色。
 * 这样从一根柱子移到相邻的另一根时，面板是滑过去的，底色和边线色也是渐变过去的，而不是换一个新的突然出现。
 */
// 一项图形属于哪个系列：给了 seriesId 的按 id 找，否则按序号。
const seriesOf = (item) =>
  item.seriesId != null ? { seriesId: item.seriesId } : { seriesIndex: item.seriesIndex };

function createTip(
  host,
  {
    content,
    horizontal = false,
    point: pointOf = null,
    gap: fixedGap = null,
    pinnable = false,
    onLeave = null,
  },
) {
  const tip = document.createElement('div');
  tip.className = 'cf-analytics-chart-tip';
  if (pinnable) {
    tip.classList.add('is-pinnable');
    tip.addEventListener('mouseleave', onLeave);
  }
  const panel = document.createElement('div');
  panel.className = 'cf-analytics-tip';
  // 标题行（开头加粗的一段和后面的说明）单独包一层，列表在它下面另起一块。
  // 不能让三者并排在同一个会换行的弹性容器里靠宽度把列表挤到下一行：列表够宽时反而会和标题行排成一排。
  const head = document.createElement('div');
  head.className = 'cf-analytics-tip-head';
  const lead = document.createElement('strong');
  const text = document.createElement('span');
  const list = document.createElement('ul');
  head.append(lead, text);
  panel.append(head, list);
  tip.appendChild(panel);
  host.appendChild(tip);

  // 逐条列出的内容。文字一律按纯文本写入，题目名称里即使有尖括号也只是文字。
  function fillList(items = []) {
    const piece = (tag, value, color) => {
      const node = document.createElement(tag);
      node.textContent = value ?? '';
      if (color) node.style.color = color;
      return node;
    };
    // 中间一栏的文字：整段一种样子，或者分成几截各自着色。
    const body = (value) => {
      if (!Array.isArray(value)) return piece('span', value);
      const node = document.createElement('span');
      node.append(
        ...value.map((part) =>
          typeof part === 'string' ? part : piece('em', part.text, part.color),
        ),
      );
      return node;
    };
    const rows = items.map((item) => {
      if (item.heading) {
        const row = piece('li', item.heading);
        row.className = 'is-heading';
        return row;
      }
      const row = document.createElement('li');
      if (item.muted) row.classList.add('is-muted');
      if (item.action && item.href) row.classList.add('is-action');
      const cells = [
        piece('b', item.label, item.color),
        body(item.text),
        piece('i', item.value, item.color),
      ];
      if (!item.href) {
        row.append(...cells);
        return row;
      }
      const link = document.createElement('a');
      link.href = item.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.append(...cells);
      row.append(link);
      return row;
    });
    list.replaceChildren(...rows);
    list.hidden = !rows.length;
    list.scrollTop = 0;
  }

  // 把内容放进提示，并让提示的底边中点对准 point 上方 gap 像素处。
  function place(element, result, point, gap) {
    if (!result || !point) return hide();
    const info = typeof result === 'string' ? { text: result } : result;
    lead.textContent = info.lead || '';
    lead.hidden = !info.lead;
    lead.style.color = info.leadColor || '';
    text.textContent = info.text || '';
    fillList(info.items);
    panel.style.background = info.background || '';
    panel.style.borderColor = info.border || '';
    // 已经显示着（从相邻的柱子移过来）就滑到新位置；刚出现时直接放到位，不从上一次的位置滑过来。
    tip.classList.toggle('is-gliding', tip.classList.contains('is-visible'));
    const frame = host.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    // 量的是面板自身的大小：它不受滑动过程影响，内容一改就是新的尺寸。
    const size = panel.getBoundingClientRect();
    const left = Math.min(
      Math.max(box.left + point[0] - size.width / 2, frame.left + 4),
      frame.right - size.width - 4,
    );
    const top = box.top + point[1] - gap - size.height;
    // 对齐到物理像素，再换算成相对外框的位置。
    const ratio = window.devicePixelRatio || 1;
    const snap = (value) => Math.round(value * ratio) / ratio;
    tip.style.left = `${snap(left) - frame.left}px`;
    tip.style.top = `${snap(top) - frame.top}px`;
    tip.classList.add('is-visible');
  }
  // 柱子或它的数字被悬停。
  function show(chart, element, params) {
    // 柱子末端在图表里的位置：竖向柱是柱顶的中点，横向柱是右端的中点。别的图表自己给出位置。
    const point = pointOf
      ? pointOf(params, chart)
      : chart.convertToPixel(
          seriesOf(params),
          horizontal ? [params.value, params.dataIndex] : [params.dataIndex, params.value],
        );
    // 竖向柱的上方还有一行数字，提示再往上让开它。
    place(element, content(params), point, fixedGap ?? (horizontal ? 12 : 24));
  }
  // 图形以外的文字（被省略的名称）被悬停。
  function showLabel(element, target) {
    place(element, target.text, target.point, 12);
  }
  function hide() {
    tip.classList.remove('is-visible');
  }
  // 固定或放开提示：固定着的时候它才接收鼠标。
  function setPinned(pinned) {
    tip.classList.toggle('is-pinned', pinned);
  }
  return {
    show,
    showLabel,
    hide,
    setPinned,
    contains: (node) => tip.contains(node),
    remove: () => tip.remove(),
  };
}

// 管理一张图表：容器有了尺寸才创建，尺寸变化时跟着重排，配置变化时更新，卸载时销毁。
// option 是返回图表配置的函数，接收容器当前的宽度；它读到的响应式数据变化时图表自动更新。
// replaced 列出数量会变的部件（如随列数增减的坐标系与系列），更新时多出来的会被移除；这些部件要带 id。
// tip 是悬停提示的设置，见 createTip；提示放进图表所在的卡片里，卡片是定位元素。
// events 是要监听的图表事件：{ 事件名: 处理函数(事件参数, 图表) }，比如范围选择变了的 datazoom。
export function useChart(option, { replaced = [], tip = null, events = {} } = {}) {
  const element = ref(null);
  const width = ref(0);
  // 宽度未知时不生成配置；宽度或配置依赖的数据变化时重新生成。
  const built = computed(() => (width.value ? option(width.value) : null));
  let chart;
  let observer;
  let hint;
  // 当前被悬停的柱子，以及正显示着提示的那处文字（见 tip.label；没有时为 null）。
  let active = null;
  let labelShown = null;

  // 提示是否被点击固定住了（见 createTip 的 tip.pinnable）。固定着的时候，强调和提示都不跟着鼠标换。
  let pinned = false;
  function setPinned(value) {
    pinned = value;
    hint.setPinned(value);
  }

  // 放下当前被悬停的柱子：取消强调，收起提示。
  // keepTip 为真时不收提示：鼠标直接移到了相邻的柱子上，提示要留着滑过去。
  function leave(keepTip = false) {
    if (!active) return;
    chart.dispatchAction({ type: 'downplay', ...active.emphasis });
    active = null;
    if (labelShown === null && keepTip !== true) hint.hide();
  }
  // 鼠标停到了另一处文字上，或者离开了文字：把文字的提示换过去或收起。
  function trackLabel(target) {
    const key = target?.key ?? null;
    if (key === labelShown) return;
    labelShown = key;
    if (target) hint.showLabel(element.value, target);
    else if (!active) hint.hide();
  }
  // 鼠标离开了图表。提示固定着的时候不动它。
  function depart() {
    element.value?.classList.remove('is-pointing');
    trackLabel(null);
    if (!pinned) leave();
  }
  const sameItem = (a, b) =>
    Boolean(a && b) &&
    a.seriesId === b.seriesId &&
    a.seriesIndex === b.seriesIndex &&
    a.dataIndex === b.dataIndex;
  // 鼠标在图表上移动：算出它落在哪根柱子的范围里，换了一根就把强调和提示换过去。
  function track(event) {
    const next = tip.hit(event.offsetX, event.offsetY, chart);
    // 悬停着能点的图形时换成手型光标。
    if (tip.pinnable) element.value.classList.toggle('is-pointing', Boolean(next));
    // 不在任何图形上时，看是不是停在一处要提示的文字上。
    if (tip.label) trackLabel(next ? null : tip.label(event.offsetX, event.offsetY, chart));
    if (pinned || sameItem(next, active)) return;
    leave(Boolean(next));
    if (!next) return;
    // 强调的对象默认就是被悬停的这一项；一栏里并排几根柱子时，hit 可以用 emphasis 指定把它们一起强调。
    const own = { ...seriesOf(next), dataIndex: next.dataIndex };
    active = { ...own, emphasis: next.emphasis || own };
    chart.dispatchAction({ type: 'highlight', ...active.emphasis });
    hint.show(chart, element.value, next);
  }

  // 点击图表：点在某个图形的悬停范围里就把提示固定在它上面；点的正是固定着的那个，或者点在空白处，就放开。
  function press(event) {
    const next = tip.hit(event.offsetX, event.offsetY, chart);
    const again = pinned && sameItem(next, active);
    setPinned(false);
    // 放开后按鼠标现在的位置重新判断：仍在原来的图形上就继续显示它的提示，在空白处就收起。
    track(event);
    if (next && !again) setPinned(true);
  }
  // 鼠标从固定着的提示里移了出去：放开。移回图表上时由接下来的鼠标移动重新判断，否则收起。
  function leaveTip(event) {
    if (!pinned) return;
    setPinned(false);
    if (!element.value.contains(event.relatedTarget)) leave();
  }
  // 固定着的时候点了图表和提示以外的地方：放开并收起。
  function pressOutside(event) {
    if (!pinned || element.value.contains(event.target) || hint.contains(event.target)) return;
    setPinned(false);
    leave();
  }

  function create() {
    chart = init(element.value, null, { renderer: 'svg' });
    for (const [name, handler] of Object.entries(events))
      chart.on(name, (params) => handler(params, chart));
    if (!tip) return;
    // 提示按卡片定位。图表不一定直接放在卡片里（外面可能还包着收放过渡的容器），所以往上找到卡片；
    // 拿图表的上一层当卡片的话，那一层不是定位元素，提示会按卡片的左上角摆，位置就偏了。
    const card = element.value.closest('.cf-analytics-card') || element.value.parentElement;
    hint = createTip(card, { ...tip, onLeave: leaveTip });
    const surface = chart.getZr();
    surface.on('mousemove', track);
    surface.on('globalout', depart);
    if (tip.pinnable) {
      surface.on('click', press);
      document.addEventListener('pointerdown', pressOutside);
    }
    chart.on('mouseout', (params) => {
      // 有的图形（如热力图的格子）自己也响应鼠标：鼠标一离开图形，图表库就取消它的强调。
      // 但鼠标可能还在这一项的悬停范围里（比如落在两个格子之间的缝隙上），这时把强调补回去。
      // 图表库是在这个事件之后才取消强调的，所以等它做完再补。
      const item = active;
      const sameSeries =
        item &&
        (item.seriesId != null
          ? params.seriesId === item.seriesId
          : params.seriesIndex === item.seriesIndex);
      if (params.componentType !== 'series' || !sameSeries || params.dataIndex !== item.dataIndex)
        return;
      setTimeout(() => {
        if (active === item) chart?.dispatchAction({ type: 'highlight', ...item.emphasis });
      });
    });
  }

  /*
   * 整张图换成另一段时间的内容时（比如热力图切换年份），新旧两张图像翻页一样横向滑动，
   * 而不是让各个图形各自挪到新位置。
   * 在数据变化之前调用 slide：direction 为 1 表示新内容从右边滑进来、旧内容向左滑出，-1 相反。
   * keep 是左侧不跟着滑动的宽度（比如热力图左边的星期标注），滑动的内容从它下面穿过。
   * 做法：先把当前的画面原样复制一份留在原地，等图表不带过渡地换成新内容后，
   * 复制的那份滑出去，图表自己从另一侧滑进来。
   */
  let slideTo = 0;
  let leftovers = [];
  function clearSlide() {
    for (const node of leftovers) node.remove();
    leftovers = [];
  }
  function slide(direction, { keep = 0 } = {}) {
    if (!chart || reducedMotion()) return;
    clearSlide();
    const stage = element.value;
    const root = stage.firstElementChild;
    for (const animation of root.getAnimations()) animation.cancel();
    const copy = () => {
      const node = root.cloneNode(true);
      Object.assign(node.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
      return node;
    };
    const ghost = copy();
    ghost.classList.add('cf-analytics-chart-ghost');
    stage.appendChild(ghost);
    leftovers.push(ghost);
    if (keep) {
      const strip = document.createElement('div');
      strip.className = 'cf-analytics-chart-keep';
      strip.style.width = `${keep}px`;
      strip.appendChild(copy());
      stage.appendChild(strip);
      leftovers.push(strip);
    }
    slideTo = direction;
    // 万一数据其实没有变、图表没有随之更新，就把留下的旧画面收走，不让它一直盖在图表上。
    setTimeout(() => {
      if (!slideTo) return;
      slideTo = 0;
      clearSlide();
    });
  }
  // 图表已经换成新内容：让它和留在原地的旧画面一起滑动，滑完把旧画面拿掉。
  function runSlide() {
    const direction = slideTo;
    slideTo = 0;
    const [ghost] = leftovers;
    const timing = { duration: 460, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
    const shift = (share) => ({ transform: `translateX(${share * 100}%)` });
    element.value.firstElementChild.animate([shift(direction), shift(0)], timing);
    const nodes = leftovers;
    ghost.animate([shift(0), shift(-direction)], timing).finished.then(
      () => {
        if (leftovers === nodes) clearSlide();
      },
      () => {},
    );
  }

  function render() {
    if (!element.value || !built.value) return;
    if (!chart) create();
    // 数据要变了，先放下当前的悬停；鼠标再动时会按新的图形重新判断。
    if (hint) {
      setPinned(false);
      leave();
      labelShown = null;
      hint.hide();
    }
    chart.setOption(
      {
        // 要整张滑动时，图表自己不做过渡，直接换成新内容。
        animation: !reducedMotion() && !slideTo,
        animationDuration: 520,
        animationDurationUpdate: 380,
        animationEasing: 'cubicOut',
        animationEasingUpdate: 'cubicOut',
        ...built.value,
      },
      { replaceMerge: replaced },
    );
    if (slideTo) runSlide();
  }

  onMounted(() => {
    // 图表所在的块可能正处于收起状态（宽度为零），等它展开后再创建。
    observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (!next || next === width.value) return;
      const first = !width.value;
      width.value = next;
      if (!first) chart?.resize();
    });
    observer.observe(element.value);
  });
  watch(built, render, { flush: 'post' });
  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', pressOutside);
    clearSlide();
    observer?.disconnect();
    hint?.remove();
    chart?.dispose();
  });

  // 容器高度变化（例如展开更多行）时，让图表带着过渡调整到新高度。
  function resize(height) {
    chart?.resize({
      height,
      animation: reducedMotion() ? undefined : { duration: 320, easing: 'cubicOut' },
    });
  }
  return { element, width, resize, slide };
}
