<script setup>
import { computed, watch } from 'vue';
import { use } from 'echarts/core';
import { CustomChart } from 'echarts/charts';
import { hexToRgba, mixHex } from '../../../../../../../../utils/color.js';
import { useChart } from '../../../composables/chart.js';
import { grays } from '../../../utils/grays.js';
import { useFold } from '../../../composables/fold.js';

// 每行的名称和它旁边的图标是自己画的图形，在这里登记。
use([CustomChart]);

// 横向的条形列表：每行一个名称、一根柱子、右边一个数字。标签分布、语言分布、提交结果分布这类
// 「若干个类别各占多少」的图都用它。宽的时候排两列，先排满左列再排右列；窄的时候只排一列。
const props = defineProps({
  // 各行，按显示顺序：{ name, value, tip, color, icon }。
  // tip 是悬停提示的内容（文字，或 useChart 的提示对象），也可以是返回它的函数，悬停到这一行时才调用；
  // color 可选，是柱子的颜色，不给时用面板的主色。
  // icon 可选，是一张小图的地址，画在名称右边、柱子左边；各行的图标上下排成一列。
  rows: { type: Array, required: true },
  // 图标是否显示。关掉时图标缩小淡出，名称滑过去贴近柱子；打开时反过来。
  iconsShown: { type: Boolean, default: true },
  // 折叠时只列前面多少行，其余展开后可见；0 表示不折叠，全部列出。
  // 默认是折叠还是展开由「折叠过长的分析表」的设置决定，见 composables/fold.js。
  collapsed: { type: Number, default: 0 },
  // 把数值写成右边的数字。数字滚动时传进来的是小数。
  format: { type: Function, default: (value) => String(Math.round(value)) },
  // 柱长按这个数折算；不给时按各行里最大的数值。
  peak: { type: Number, default: null },
  // 展开、收起按钮上的文字。
  moreText: { type: String, default: '' },
  lessText: { type: String, default: '' },
});

// 名称一栏和数字一栏的宽度。各张条形图都用这一个宽度，不让各图自己定：
// 面板里几张图上下排着，柱子的起点和终点要对齐成一条线。名称放不下就省略，悬停显示全名。
// 数字一栏要放得下最宽的数字：数字画在柱子末端右边，最长的那根柱子顶到头，它的数字就全落在这一栏里；
// 悬停时数字加粗，还会再宽一些。56 像素放得下「99.9%」这样五个字的数字加粗之后的宽度，连同它和柱子之间的空隙。
const LABEL_WIDTH = 150;
const VALUE_WIDTH = 56;
// 数字和柱子末端之间的空隙。
const VALUE_GAP = 8;
// 版式尺寸：每行高度、名称和柱子之间的间隔、两列之间的间隔。
const ROW = 24;
const LABEL_MARGIN = 12;
const GAP = 28;
const FONT = 'verdana, arial, sans-serif';
// 图标的边长，以及它和左边的名称、右边的柱子之间各留的空。
const ICON = 16;
const ICON_GAP = 8;
// 图标显示着的时候，名称和柱子之间要让出图标的位置。
const hasIcons = computed(() => props.rows.some((row) => row.icon));
const labelMargin = computed(() =>
  hasIcons.value && props.iconsShown ? ICON_GAP * 2 + ICON : LABEL_MARGIN,
);
// 名称最多能占的宽度，超过就省略。
const nameRoom = computed(() => LABEL_WIDTH - labelMargin.value - 4);
// 数字一栏实际留的宽度。一般就是上面那个固定的宽度；万一有更宽的数字（位数特别多，或者换了更宽的字体），
// 按量出来的宽度放宽，宁可这张图的柱子短一点，也不让数字被裁掉。按全部行来量，展开和收起时宽度不变。
const valueRoom = computed(() => {
  const widest = Math.max(0, ...props.rows.map((row) => textWidth(props.format(row.value), true)));
  return Math.max(VALUE_WIDTH, Math.ceil(widest) + VALUE_GAP + 2);
});
const expanded = useFold();
const collapsible = computed(() => props.collapsed > 0 && props.rows.length > props.collapsed);
const shown = computed(() =>
  collapsible.value && !expanded.value ? props.rows.slice(0, props.collapsed) : props.rows,
);

// 柱子的颜色：从浅到深的横向渐变；悬停时整体加深，并带一圈同色的光晕。
const DEFAULT_COLOR = '#5b8fd6';
const gradient = (from, to) => ({
  type: 'linear',
  x: 0,
  y: 0,
  x2: 1,
  y2: 0,
  colorStops: [
    { offset: 0, color: from },
    { offset: 1, color: to },
  ],
});
const DEFAULT_PAINT = {
  fill: gradient('#a9c4ea', DEFAULT_COLOR),
  strong: gradient('#7ea6e0', '#3f76c4'),
  glow: 'rgba(63, 118, 196, 0.35)',
};
// 指定了颜色的行：浅的一端往白色靠，悬停时深的一端往黑色靠，都由这一个颜色推出来。
function paintOf(color) {
  if (!color) return DEFAULT_PAINT;
  const deep = mixHex(color, '#000000', 0.16);
  return {
    fill: gradient(mixHex(color, '#ffffff', 0.48), color),
    strong: gradient(mixHex(color, '#ffffff', 0.2), deep),
    glow: hexToRgba(deep, 0.35),
  };
}

// 上一次各个位置（第几列第几行）上画的名称，以及它换掉的前一个名称。名称换了的位置要做淡出淡入，见 names。
let lastNames = new Map();
function buildOption(width) {
  const ink = grays();
  const before = lastNames;
  lastNames = new Map();
  const count = columnCount.value;
  const columnWidth = (width - GAP * (count - 1)) / count;
  // 柱长按全部行里最大的那个折算，展开和收起时比例不变。
  // 图标的显隐在这里读出来：图表库是在更新时才去调用下面的 renderItem 的，在那里面读，
  // 这份配置就不知道自己依赖这个开关，开关变了图表不会跟着更新。
  const iconsShown = props.iconsShown;
  const peak = props.peak ?? (Math.max(...props.rows.map((row) => row.value), 0) || 1);
  const parts = Array.from({ length: count }, (_, index) =>
    shown.value.slice(index * perColumn.value, (index + 1) * perColumn.value),
  );
  return {
    grid: parts.map((part, index) => ({
      id: `grid-${index}`,
      left: index * (columnWidth + GAP) + LABEL_WIDTH,
      width: Math.max(20, columnWidth - LABEL_WIDTH - valueRoom.value),
      top: 0,
      height: Math.max(1, part.length) * ROW,
    })),
    xAxis: parts.map((_, index) => ({
      id: `x-${index}`,
      gridIndex: index,
      type: 'value',
      show: false,
      min: 0,
      max: peak,
    })),
    yAxis: parts.map((part, index) => ({
      id: `y-${index}`,
      gridIndex: index,
      type: 'category',
      inverse: true,
      data: part.map((row) => row.name),
      // 名称不用坐标轴自带的文字：那种文字的位置变了是直接跳过去的，做不了滑动。名称由下面的 names 自己画。
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { show: false },
    })),
    series: [...parts.map(bars), ...parts.map(names)],
  };
  // 各列的柱子。悬停判断按 id 找到某一列的柱子：列数变过之后，系列的序号不一定还等于第几列。
  function bars(part, index) {
    return {
      id: `bars-${index}`,
      type: 'bar',
      // 柱子自己不响应鼠标：悬停范围由 hit 统一判断，强调也由它触发。
      silent: true,
      xAxisIndex: index,
      yAxisIndex: index,
      barWidth: 8,
      // 数值变化时柱子带着过渡伸缩到新的长度，右边的数字同步滚动。
      animationDurationUpdate: 520,
      animationEasingUpdate: 'cubicInOut',
      data: part.map((row) => {
        const paint = paintOf(row.color);
        return {
          value: row.value,
          itemStyle: { color: paint.fill },
          emphasis: { itemStyle: { color: paint.strong, shadowBlur: 6, shadowColor: paint.glow } },
        };
      }),
      showBackground: true,
      backgroundStyle: { color: '#edf1f7', borderRadius: 4 },
      itemStyle: { borderRadius: 4 },
      label: {
        show: true,
        formatter: ({ value }) => props.format(value),
        position: 'right',
        distance: VALUE_GAP,
        fontSize: 12,
        fontFamily: FONT,
        color: ink.label,
        valueAnimation: true,
      },
      emphasis: { label: { color: ink.strong, fontWeight: 'bold' } },
    };
  }
  // 各列的名称和图标。名称靠右排在柱子左边，放不下时省略；图标夹在名称和柱子之间。
  // 图标的开关切换时，和提交记录页语言一栏的动法一致：图标朝柱子那一侧缩小并淡出，让出来的位置由名称滑过去补上；
  // 打开时名称先让开，图标再长出来。两者同时进行，图标的左边缘始终在名称前面，不会叠在一起。
  // 某个位置上的名称换了字（比如提交结果在缩写和全称之间切换）：旧名称先淡出，新名称再淡入。
  // 图表库在文字内容变了的时候是把这个文字图形整个换成新的，没法让同一个图形从旧字过渡到新字，
  // 所以每个位置另放一个平时看不见的图形专门画「前一个名称」：换字时它带着旧名称重新出现并淡出，
  // 同时新名称的图形稍后淡入，两段各占一半时间，接起来就是先出后进。
  function names(part, index) {
    const margin = labelMargin.value;
    const room = nameRoom.value;
    const scale = iconsShown ? 1 : 0;
    const HALF = 130;
    // 各行的前一个名称：这次换了字的是刚被换掉的那个；没换的沿用原来记着的，那个图形就不会被重画。
    const previous = part.map((row, line) => {
      const last = before.get(`${index}:${line}`);
      const from = last && last.name !== row.name ? last.name : last ? last.from : '';
      lastNames.set(`${index}:${line}`, { name: row.name, from });
      return from;
    });
    return {
      id: `names-${index}`,
      type: 'custom',
      silent: true,
      xAxisIndex: index,
      yAxisIndex: index,
      // 和提交记录页上语言图标的显隐用同样的时长。
      animationDurationUpdate: 260,
      animationEasingUpdate: 'cubicOut',
      data: part.map((_, line) => [0, line]),
      renderItem(params, api) {
        const row = part[params.dataIndex];
        if (!row) return null;
        // 这一行柱子的起点和行的中线。
        const [x, y] = api.coord([0, api.value(1)]);
        const style = {
          fill: ink.name,
          fontSize: 12,
          fontFamily: FONT,
          align: 'right',
          verticalAlign: 'middle',
          width: room,
          overflow: 'truncate',
        };
        const children = [
          {
            type: 'text',
            x: x - margin,
            y,
            style: { ...style, text: row.name },
            transition: ['x', 'y'],
            enterFrom: { style: { opacity: 0 } },
            enterAnimation: { duration: HALF, delay: HALF },
          },
          {
            type: 'text',
            x: x - margin,
            y,
            style: { ...style, text: previous[params.dataIndex], opacity: 0 },
            transition: ['x', 'y'],
            enterFrom: { style: { opacity: 1 } },
            enterAnimation: { duration: HALF },
          },
        ];
        // 图标以靠柱子那一侧的中点为基准放置和缩放。
        if (row.icon)
          children.push({
            type: 'image',
            x: x - ICON_GAP,
            y,
            scaleX: scale,
            scaleY: scale,
            style: {
              image: row.icon,
              x: -ICON,
              y: -ICON / 2,
              width: ICON,
              height: ICON,
              opacity: scale,
            },
            transition: ['x', 'y', 'scaleX', 'scaleY', 'style'],
            enterFrom: { style: { opacity: 0 } },
          });
        return { type: 'group', children };
      },
    };
  }
}
// 一段文字画出来有多宽（bold 为真时按加粗的量）。和图表用同样的字体量，
// 用来判断名字有没有被省略，以及右边的数字要留多宽。
let ruler;
function textWidth(text, bold = false) {
  ruler ??= document.createElement('canvas').getContext('2d');
  ruler.font = `${bold ? 'bold ' : ''}12px ${FONT}`;
  return ruler.measureText(text).width;
}
// 鼠标落在第几列第几行；不在任何一行上时返回 null。
function rowAt(x, y) {
  const count = columnCount.value;
  const columnWidth = (chartWidth.value - GAP * (count - 1)) / count;
  const column = Math.min(count - 1, Math.max(0, Math.floor(x / (columnWidth + GAP))));
  const line = Math.floor(y / ROW);
  const row = shown.value[column * perColumn.value + line];
  if (!row || line < 0 || line >= perColumn.value) return null;
  // start 是这一列柱子的起点。
  return { row, column, line, start: column * (columnWidth + GAP) + LABEL_WIDTH };
}
// 名称被省略时，悬停显示全名；没被省略的不提示。提示对准这个名字的正上方。
function labelTip(x, y) {
  const at = rowAt(x, y);
  if (!at || textWidth(at.row.name) <= nameRoom.value) return null;
  // 名字靠右排在柱子左边；被省略的名字正好占满这一栏的宽度。
  const right = at.start - labelMargin.value;
  if (x < right - nameRoom.value || x > right) return null;
  return {
    key: `${at.column}:${at.line}`,
    text: at.row.name,
    point: [right - nameRoom.value / 2, at.line * ROW + ROW / 2],
  };
}
// 悬停范围。纵向：柱子只有 8 像素高，所以整行的高度（24 像素）都算，行与行之间没有空档。
// 横向：从柱子起点一直到右边数字的末端（柱子、柱子和数字之间的空隙、数字）连成一片都算；数字右边的空白不算。
// 悬停时这一行的柱子加深、数字加粗，并在柱子末端上方显示提示。
function hit(x, y, instance) {
  const at = rowAt(x, y);
  if (!at) return null;
  const { row, column, line } = at;
  const seriesId = `bars-${column}`;
  const end = instance.convertToPixel({ seriesId }, [row.value, line]);
  if (!end || x < at.start || x > end[0] + valueRoom.value) return null;
  return { seriesId, dataIndex: line, value: row.value, tip: row.tip };
}
// 列数会变，坐标系和系列的数量跟着变，所以这几类部件按 id 增减。
const chart = useChart(buildOption, {
  replaced: ['grid', 'xAxis', 'yAxis', 'series'],
  tip: {
    hit,
    content: (item) => (typeof item.tip === 'function' ? item.tip() : item.tip),
    horizontal: true,
    label: labelTip,
  },
});
const { element, width: chartWidth, resize } = chart;
const columnCount = computed(() => (chartWidth.value && chartWidth.value < 640 ? 1 : 2));
const perColumn = computed(() => Math.max(1, Math.ceil(shown.value.length / columnCount.value)));
const height = computed(() => perColumn.value * ROW);
// 行数变化（展开、收起、换成一列）时，图表带着过渡调整到新的高度。
watch(height, (value) => resize(value), { flush: 'post' });
</script>

<template>
  <div
    ref="element"
    class="cf-analytics-chart cf-analytics-barlist"
    :style="{ height: `${height}px` }"
  ></div>
  <!-- 展开与收起放在列表的正下方：它管的是列表有多长，放在列表末尾比挤在标题栏里顺。 -->
  <div v-if="collapsible" class="cf-analytics-more-row">
    <button
      type="button"
      class="cf-analytics-more"
      :class="{ 'is-open': expanded }"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <Transition name="cf-analytics-swap" mode="out-in">
        <span :key="expanded" data-cf-language-text>{{ expanded ? lessText : moreText }}</span>
      </Transition>
      <svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg>
    </button>
  </div>
</template>

<style>
/* 展开和收起时容器高度平滑变化，图表在里面同步调整。 */
.cf-analytics-barlist {
  overflow: hidden;
  transition: height 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}
/* 列表下方的展开 / 收起：居中的一行小字加一个箭头，上面一条细线把它和列表分开。 */
.cf-analytics-more-row {
  display: flex;
  justify-content: center;
  margin-top: -2px;
  padding-top: 8px;
  border-top: 1px dashed var(--cf-gray-200);
}
.cf-analytics-more {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  padding: 2px 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--cf-gray-500);
  font: inherit;
  font-size: var(--cf-font-size-xs);
  line-height: 18px;
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}
.cf-analytics-more:hover {
  background: color-mix(in srgb, var(--cf-analytics-accent) 10%, #fff);
  color: var(--cf-analytics-ink);
}
.cf-analytics-more:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--cf-analytics-accent) 55%, transparent);
  outline-offset: 1px;
}
/* 箭头展开后翻过来指向上方。 */
.cf-analytics-more svg {
  width: 10px;
  height: 6px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}
.cf-analytics-more.is-open svg {
  transform: rotate(180deg);
}
@media (prefers-reduced-motion: reduce) {
  .cf-analytics-barlist,
  .cf-analytics-more,
  .cf-analytics-more svg {
    transition: none;
  }
}
</style>
