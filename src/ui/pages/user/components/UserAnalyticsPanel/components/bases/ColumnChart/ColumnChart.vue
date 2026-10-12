<script setup>
import { use } from 'echarts/core';
import { CustomChart } from 'echarts/charts';
import { useChart } from '../../../composables/chart.js';
import { grays } from '../../../utils/grays.js';
import { AXIS_LEFT, axisCountText } from '../../../utils/numbers.js';
import { scaled } from '../../../../../../../../utils/font-scale.js';

// 竖向的柱状图：横轴是若干个类别（月份、钟点、时间段），每个类别里并排一组或几组柱子，柱顶标数字；左边是数量的刻度。
// 月度活跃度、比赛速度、刷题作息都用它。
const props = defineProps({
  // 横轴上各栏的文字，按顺序。文字里可以带换行，分成两行显示（比如月份下面再标年份）。
  labels: { type: Array, required: true },
  // 各组柱子：{ id, values, colors: [平时的颜色, 悬停时的颜色], labelColor }。
  // values 和 labels 一一对应；labelColor 是柱顶数字的颜色，不给时用灰色。
  series: { type: Array, required: true },
  // 悬停提示的内容：tip(index) 返回文字，或 useChart 的提示对象。
  tip: { type: Function, required: true },
  // 每组柱子至少这么宽时才在柱顶标数字；太挤就不标，看悬停提示。0 表示总是标。
  labelRoom: { type: Number, default: 0 },
});

// 横轴的文字是自己画的图形，在这里登记。
use([CustomChart]);

const FONT = 'verdana, arial, sans-serif';
// 横轴的文字离轴线多远。
const LABEL_MARGIN = 7;
// 上一次各栏下面写的文字，以及它换掉的前一个。文字换了的那一栏要做淡出淡入，见 captions。
let lastLabels = new Map();
// 绘图区右边留的空白；左边留给纵轴的刻度。
const SIDE = 2;
function buildOption(width) {
  const ink = grays();
  const before = lastLabels;
  lastLabels = new Map();
  // 各栏的前一个文字：这次换了字的是刚被换掉的那个；没换的沿用原来记着的，那个图形就不会被重画。
  const previous = props.labels.map((label, index) => {
    const name = String(label);
    const last = before.get(index);
    const from = last && last.name !== name ? last.name : last ? last.from : '';
    lastLabels.set(index, { name, from });
    return from;
  });
  // 横轴的文字有两行时，下边多留一行的高度。
  const twoLines = props.labels.some((label) => String(label).includes('\n'));
  // 字号，以及给字留的位置（左边的刻度、上边柱顶的数字、下边各栏的文字），都跟着插件字体大小走。
  const left = scaled(AXIS_LEFT);
  const room = (width - left - SIDE) / Math.max(1, props.labels.length * props.series.length);
  const labelled = room >= scaled(props.labelRoom);
  return {
    grid: { left, right: SIDE, top: scaled(20), bottom: scaled(twoLines ? 34 : 22) },
    xAxis: {
      type: 'category',
      data: props.labels.map((_, index) => String(index)),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: ink.line } },
      // 各栏下面的文字不用坐标轴自带的：那种文字换了字是直接换掉的，没有过渡。由下面的 captions 自己画。
      axisLabel: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      // 上限交给图表库取整到好读的刻度；全是 0 时给个 1，不然没有范围。
      max: ({ max }) => (max ? null : 1),
      // 都是数量，刻度只取整数。
      minInterval: 1,
      splitNumber: 3,
      axisLabel: {
        margin: 6,
        fontSize: scaled(10),
        fontFamily: FONT,
        color: ink.label,
        formatter: axisCountText,
      },
      splitLine: { lineStyle: { color: ink.faint } },
    },
    series: [...bars(), captions()],
  };
  /*
   * 各栏下面的文字（月份、时间段……）。位置和样子照坐标轴原来的文字：在轴线下面，居中，可以分两行。
   * 文字换了（换语言）的时候旧的先淡出、新的再淡入，和条形图里名称的做法一样（见 BarList 的 names）：
   * 每一栏放两个文字图形，一个画现在的文字，一个平时看不见、专门画前一个文字；两个都按自己画的字起名，
   * 图表库按名字对应新旧图形，字一换就都算新出现的，各自走入场的过渡。字没换时图形不动。
   */
  function captions() {
    const HALF = 130;
    const labels = props.labels.map(String);
    return {
      id: 'captions',
      type: 'custom',
      silent: true,
      data: labels.map((_, index) => [index, 0]),
      renderItem(params, api) {
        const at = params.dataIndex;
        const [x, y] = api.coord([at, 0]);
        const place = { type: 'text', x, y: y + LABEL_MARGIN };
        const style = {
          fill: ink.label,
          fontSize: scaled(10),
          lineHeight: scaled(13),
          fontFamily: FONT,
          align: 'center',
          verticalAlign: 'top',
        };
        return {
          type: 'group',
          diffChildrenByName: true,
          children: [
            {
              ...place,
              name: `now:${labels[at]}`,
              style: { ...style, text: labels[at] },
              transition: ['x', 'y'],
              enterFrom: { style: { opacity: 0 } },
              enterAnimation: { duration: HALF, delay: HALF },
            },
            {
              ...place,
              name: `was:${previous[at]}`,
              style: { ...style, text: previous[at], opacity: 0 },
              transition: ['x', 'y'],
              enterFrom: { style: { opacity: 1 } },
              enterAnimation: { duration: HALF },
            },
          ],
        };
      },
    };
  }
  function bars() {
    return props.series.map(({ id, values, colors: [color, strong], labelColor }) => ({
      id,
      type: 'bar',
      // 柱子自己不响应鼠标：悬停范围由下面的 hit 统一判断，强调也由它触发。
      silent: true,
      barGap: '12%',
      barCategoryGap: '26%',
      // 数据变化时柱子带着过渡长到新的高度，数字跟着滚动。
      animationDurationUpdate: 460,
      animationEasingUpdate: 'cubicInOut',
      animationDelay: (index) => index * Math.min(14, 240 / values.length),
      animationDelayUpdate: (index) => index * Math.min(10, 180 / values.length),
      data: values,
      itemStyle: { color, borderRadius: [3, 3, 0, 0] },
      emphasis: { itemStyle: { color: strong }, label: { fontWeight: 'bold' } },
      // 数字标在各自的柱子上方；为 0 的不标。
      label: {
        show: labelled,
        position: 'top',
        distance: 3,
        fontSize: scaled(10),
        fontFamily: FONT,
        color: labelColor || ink.label,
        valueAnimation: true,
        formatter: ({ value }) => (Math.round(value) ? String(Math.round(value)) : ''),
      },
    }));
  }
}
// 悬停范围：每一栏里，从最高那根柱子的数字上沿一直到图表底部都算；数字上方的空白不算。
const LABEL_REACH = 18;
function hit(x, y, chart) {
  const index = chart.convertFromPixel({ seriesIndex: 0 }, [x, y])?.[0];
  if (!Number.isInteger(index) || index < 0 || index >= props.labels.length) return null;
  const value = Math.max(...props.series.map(({ values }) => values[index] || 0));
  const top = chart.convertToPixel({ seriesIndex: 0 }, [index, value]);
  if (!top || y < top[1] - (value ? scaled(LABEL_REACH) : 4)) return null;
  // 这一栏的几根柱子一起强调。
  return {
    seriesIndex: 0,
    dataIndex: index,
    value,
    emphasis: { seriesIndex: props.series.map((_, at) => at), dataIndex: index },
  };
}
const { element } = useChart(buildOption, {
  tip: { hit, content: ({ dataIndex }) => props.tip(dataIndex) },
});
</script>

<template>
  <div ref="element" class="cf-analytics-chart cf-analytics-columns"></div>
</template>

<style>
.cf-analytics-columns {
  height: 170px;
}
</style>
