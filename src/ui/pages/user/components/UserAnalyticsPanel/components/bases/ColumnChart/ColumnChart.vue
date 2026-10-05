<script setup>
import { useChart } from '../../../composables/chart.js';
import { grays } from '../../../utils/grays.js';
import { AXIS_LEFT, axisCountText } from '../../../utils/numbers.js';

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

const FONT = 'verdana, arial, sans-serif';
// 绘图区右边留的空白；左边留给纵轴的刻度。
const SIDE = 2;
function buildOption(width) {
  const ink = grays();
  // 横轴的文字有两行时，下边多留一行的高度。
  const twoLines = props.labels.some((label) => String(label).includes('\n'));
  const room = (width - AXIS_LEFT - SIDE) / Math.max(1, props.labels.length * props.series.length);
  const labelled = room >= props.labelRoom;
  return {
    grid: { left: AXIS_LEFT, right: SIDE, top: 20, bottom: twoLines ? 34 : 22 },
    xAxis: {
      type: 'category',
      data: props.labels.map((_, index) => String(index)),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: ink.line } },
      axisLabel: {
        interval: 0,
        margin: 7,
        fontSize: 10,
        lineHeight: 13,
        fontFamily: FONT,
        color: ink.label,
        formatter: (_value, index) => props.labels[index],
      },
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
        fontSize: 10,
        fontFamily: FONT,
        color: ink.label,
        formatter: axisCountText,
      },
      splitLine: { lineStyle: { color: ink.faint } },
    },
    series: props.series.map(({ id, values, colors: [color, strong], labelColor }) => ({
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
        fontSize: 10,
        fontFamily: FONT,
        color: labelColor || ink.label,
        valueAnimation: true,
        formatter: ({ value }) => (Math.round(value) ? String(Math.round(value)) : ''),
      },
    })),
  };
}
// 悬停范围：每一栏里，从最高那根柱子的数字上沿一直到图表底部都算；数字上方的空白不算。
const LABEL_REACH = 18;
function hit(x, y, chart) {
  const index = chart.convertFromPixel({ seriesIndex: 0 }, [x, y])?.[0];
  if (!Number.isInteger(index) || index < 0 || index >= props.labels.length) return null;
  const value = Math.max(...props.series.map(({ values }) => values[index] || 0));
  const top = chart.convertToPixel({ seriesIndex: 0 }, [index, value]);
  if (!top || y < top[1] - (value ? LABEL_REACH : 4)) return null;
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
