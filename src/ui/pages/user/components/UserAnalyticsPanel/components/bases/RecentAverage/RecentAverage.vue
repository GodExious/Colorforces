<script setup>
import { computed } from 'vue';
import { use } from 'echarts/core';
import { CustomChart } from 'echarts/charts';
import { translate as t } from '../../../../../../../../i18n/index.js';
import { bucketRating } from '../../../../../../../../features/user/analytics/stats.js';
import { problemLink } from '../../../../../../../../utils/problem.js';
import AnimatedNumber from '../../parts/AnimatedNumber/AnimatedNumber.vue';
import ChartHint from '../../parts/ChartHint/ChartHint.vue';
import RatingSource from '../../parts/RatingSource/RatingSource.vue';
import { useChart } from '../../../composables/chart.js';
import { grays } from '../../../utils/grays.js';
import { ratingPaint } from '../../../utils/rating-paint.js';
import { AXIS_LEFT } from '../../../utils/numbers.js';

// 平均线和它末端的数值标签是自己画的图形，在这里登记。
use([CustomChart]);

// 近期平均难度的图：一批最近通过的题各一根柱子，一条平均线，平均分写在标题后面。
// 「按题数」和「按天数」两张图都用它，各自在标题栏右边放自己的控件（默认插槽）。
const props = defineProps({
  // 卡片的标题，以及没有题可画时的一行说明。
  title: { type: String, required: true },
  empty: { type: String, required: true },
  // { problems: [{ key, rating, time }], average }，见统计模块的 recentAverage。
  // problems 是最近通过的几道（或最近一段时间里通过的全部）有难度分的题，按通过时间从早到晚排。
  trend: { type: Object, required: true },
  // 题号 → 题目名称。
  nameOf: { type: Function, required: true },
});

const FONT = 'verdana, arial, sans-serif';
const pad = (value) => String(value).padStart(2, '0');
function dateText(seconds) {
  const date = new Date(seconds * 1000);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
// 平均分所在档位的一组颜色：标题后面的数值、图里的平均线和线末端的数值标签都用它。
const averagePaint = computed(() =>
  props.trend.average === null ? null : ratingPaint(bucketRating(props.trend.average)),
);
const averageColor = computed(() => averagePaint.value?.text ?? null);
// 每一栏：一道题，配上它所在档位的颜色。
const columns = computed(() =>
  props.trend.problems.map((problem) => ({
    ...problem,
    ...ratingPaint(bucketRating(problem.rating)),
  })),
);

// 绘图区的边距：左边留给纵轴的难度分，右边留给平均线末端的数值标签。
const GRID = { left: AXIS_LEFT, right: 46, top: 20, bottom: 22 };
function buildOption(width) {
  const ink = grays();
  const list = columns.value;
  // 每一栏够宽时，在柱子上方标出这道题的难度分；太挤就不标，看纵轴和悬停提示。
  const band = (width - GRID.left - GRID.right) / Math.max(1, list.length);
  const labelled = band >= 30;
  const lowest = list.reduce((low, column) => Math.min(low, column.rating), Infinity);
  // 柱子一根接一根地长出来。题数很多时把间隔压短，让最后一根也在四分之一秒内开始动，整段动画不随题数变长。
  const stagger = (step) => Math.min(step, 240 / Math.max(1, list.length));
  const mean = averagePaint.value;
  return {
    grid: GRID,
    xAxis: [
      // 横轴只标序号：1 是这几道题里最早通过的，最后一个是最近通过的。
      {
        type: 'category',
        data: list.map((_, index) => String(index + 1)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: ink.line } },
        axisLabel: {
          margin: 7,
          fontSize: 10,
          fontFamily: FONT,
          color: ink.muted,
          hideOverlap: true,
        },
      },
      // 第二条横轴不显示，只给平均线用：0 是绘图区的左边缘，1 是右边缘。
      { type: 'value', min: 0, max: 1, show: false },
    ],
    // 纵轴不从 0 起：难度分都在几百以上，从最低的那道题往下留一点空，各题之间的差别才看得出来。
    // 刻度上的分数用所在档位的颜色。
    yAxis: {
      type: 'value',
      min: Number.isFinite(lowest) ? Math.max(0, Math.floor(lowest / 100) * 100 - 200) : 0,
      max: ({ max }) => Math.ceil(max / 100) * 100,
      minInterval: 100,
      splitNumber: 4,
      axisLabel: {
        fontSize: 10,
        fontFamily: FONT,
        color: (value) => ratingPaint(bucketRating(value)).text,
      },
      splitLine: { lineStyle: { color: ink.faint } },
    },
    series: [
      {
        id: 'recent',
        type: 'bar',
        // 柱子自己不响应鼠标：悬停范围由下面的 hit 统一判断，强调也由它触发。
        silent: true,
        barCategoryGap: '24%',
        barMaxWidth: 34,
        animationDurationUpdate: 460,
        animationEasingUpdate: 'cubicInOut',
        animationDelay: (index) => index * stagger(12),
        animationDelayUpdate: (index) => index * stagger(8),
        data: list.map((column) => ({
          value: column.rating,
          label: { color: column.text },
          itemStyle: {
            color: column.fill,
            borderColor: column.edge,
            borderWidth: 1,
            borderRadius: [3, 3, 0, 0],
          },
          // 悬停：柱子保持本色，边线换成这一档的文字色并加粗，外面加一圈同色的光晕。
          emphasis: {
            itemStyle: {
              color: column.fill,
              borderColor: column.text,
              borderWidth: 1.5,
              shadowBlur: 8,
              shadowColor: column.edge,
            },
          },
        })),
        label: {
          show: labelled,
          position: 'top',
          distance: 3,
          fontSize: 10,
          fontFamily: FONT,
          valueAnimation: true,
          formatter: ({ value }) => String(Math.round(value)),
        },
        emphasis: { label: { fontWeight: 'bold' } },
      },
      /*
       * 平均线和它末端的数值标签，画在柱子上面。用第二条横轴定位：0 是绘图区的左边缘，1 是右边缘；
       * 要是跟着各栏走，线只会从第一根柱子的中间画到最后一根的中间。
       * 这里不用图表库的折线和它自带的末端标签：平均分变化时（换题数、换难度分来源），
       * 那个标签的位置和数字是直接跳过去的。自己画的这几样都带过渡：线和标签一起移到新的高度，
       * 颜色渐变到新的档位，标签上的数字滚动到新的值。
       */
      {
        id: 'average',
        type: 'custom',
        xAxisIndex: 1,
        silent: true,
        z: 3,
        data: mean ? [[0, props.trend.average]] : [],
        renderItem(_params, api) {
          const value = api.value(1);
          const [left, y] = api.coord([0, value]);
          const [right] = api.coord([1, value]);
          const line = { x1: left, y1: y, x2: right, y2: y };
          // 刚出现时淡入。
          const enterFrom = { style: { opacity: 0 } };
          return {
            type: 'group',
            children: [
              // 半透明的白色衬底：线穿过颜色各异的柱子时，靠它和柱子隔开，才看得清。
              {
                type: 'line',
                shape: line,
                style: { stroke: '#ffffff', lineWidth: 4, opacity: 0.8 },
                transition: ['shape'],
                enterFrom,
              },
              // 线本身：圆头的虚线，用平均分所在档位的文字色。
              {
                type: 'line',
                shape: line,
                style: { stroke: mean.text, lineWidth: 1.5, lineDash: [6, 4], lineCap: 'round' },
                transition: ['shape', 'style'],
                enterFrom,
              },
              // 数值标签：挂在线的右端，放在绘图区右边的留白里，不压住柱子；底色、边线和文字都按这一档取色。
              // 数字不能直接做过渡，所以另外带一个跟着过渡的数值，每一帧把它取整后写成文字。
              {
                type: 'text',
                x: right + 5,
                y,
                style: {
                  text: String(value),
                  fill: mean.text,
                  backgroundColor: mean.fill,
                  borderColor: mean.edge,
                  borderWidth: 1,
                  borderRadius: 3,
                  padding: [2, 5],
                  fontSize: 10,
                  fontFamily: FONT,
                  fontWeight: 'bold',
                  align: 'left',
                  verticalAlign: 'middle',
                },
                extra: { value, transition: ['value'] },
                transition: ['x', 'y', 'style'],
                enterFrom,
                during(frame) {
                  frame.setStyle('text', String(Math.round(frame.getExtra('value'))));
                },
              },
            ],
          };
        },
      },
    ],
  };
}
// 悬停范围：每一栏里，从柱顶数字的上沿一直到图表底部都算；数字上方的空白不算。
const LABEL_REACH = 18;
function hit(x, y, chart) {
  const list = columns.value;
  const index = chart.convertFromPixel({ seriesIndex: 0 }, [x, y])?.[0];
  if (!Number.isInteger(index) || index < 0 || index >= list.length) return null;
  const value = list[index].rating;
  const top = chart.convertToPixel({ seriesIndex: 0 }, [index, value]);
  if (!top || y < top[1] - LABEL_REACH) return null;
  const band = (chart.getWidth() - GRID.left - GRID.right) / list.length;
  if (Math.abs(x - top[0]) > band / 2) return null;
  return { seriesIndex: 0, dataIndex: index, value };
}
// 提示和难度热力图的是同一种样子：标题行是通过的日期，下面一行是这道题——题号、名称、难度分，
// 题号和难度分按档位着色，整行是指向题目页的链接。
// 平时提示只是跟着悬停走；点一下柱子把它固定住，才能移进去点链接。
function tipOf({ dataIndex }) {
  const column = columns.value[dataIndex];
  return {
    lead: dateText(column.time),
    leadColor: column.text,
    background: column.tint,
    border: column.edge,
    items: [
      {
        label: column.key,
        text: props.nameOf(column.key),
        value: String(column.rating),
        color: column.text,
        href: problemLink(column.key),
        action: true,
      },
    ],
  };
}
const { element } = useChart(buildOption, { tip: { hit, content: tipOf, pinnable: true } });
</script>

<template>
  <section class="cf-analytics-card">
    <header class="cf-analytics-card-head is-stacked">
      <!-- 平均分紧跟在标题后面：数值变化时滚动过去，颜色跟着档位变。 -->
      <h4 class="cf-analytics-recent-head">
        <span data-cf-language-text>{{ title }}</span>
        <span class="cf-analytics-recent-value" :style="{ color: averageColor }">
          <AnimatedNumber :value="trend.average" empty="N/A" />
        </span>
      </h4>
      <!-- 右侧分两行：各自的控件（题数，或时间范围）；难度分来源。 -->
      <div class="cf-analytics-card-tools">
        <slot />
        <RatingSource />
      </div>
    </header>
    <!-- 图表的容器一直留着，没有数据时只是不显示；这样数据出现后图表能直接画出来。 -->
    <div
      v-show="trend.problems.length"
      ref="element"
      class="cf-analytics-chart cf-analytics-recent-chart"
    ></div>
    <!-- 说明从纵轴的位置起，和绘图区的左边缘对齐。 -->
    <ChartHint v-show="trend.problems.length" :inset="GRID.left">{{
      t('analyticsRecentPinHint')
    }}</ChartHint>
    <p v-if="!trend.problems.length" class="cf-analytics-card-empty">
      <span data-cf-language-text>{{ empty }}</span>
    </p>
  </section>
</template>

<style>
.cf-analytics-recent-chart {
  height: 180px;
}
.cf-analytics-card-head h4.cf-analytics-recent-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.cf-analytics-recent-value {
  font-size: var(--cf-font-size-xl);
  font-weight: var(--cf-font-weight-bold);
  font-variant-numeric: tabular-nums;
  transition: color 0.3s ease;
}
/* 卡片里没有内容可画时的一行说明。 */
.cf-analytics-card-empty {
  margin: 0;
  padding: 10px 0 6px;
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-base);
  text-align: center;
}
@media (prefers-reduced-motion: reduce) {
  .cf-analytics-recent-value {
    transition: none;
  }
}
</style>
