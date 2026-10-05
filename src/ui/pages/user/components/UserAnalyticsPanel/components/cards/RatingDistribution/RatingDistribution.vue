<script setup>
import { computed } from 'vue';
import { translate as t } from '../../../../../../../../i18n/index.js';
import { appSettings, saveSettings } from '../../../../../../../../settings.js';
import {
  RATING_MIN,
  RATING_MAX,
  RATING_STEP,
} from '../../../../../../../../features/user/analytics/stats.js';
import { useChart } from '../../../composables/chart.js';
import { grays } from '../../../utils/grays.js';
import { ratingPaint } from '../../../utils/rating-paint.js';
import { tipRows } from '../../../utils/tips.js';
import { AXIS_LEFT, axisCountText } from '../../../utils/numbers.js';
import ModeSwitch from '../../controls/ModeSwitch/ModeSwitch.vue';
import RatingSource from '../../parts/RatingSource/RatingSource.vue';

const props = defineProps({
  distribution: { type: Object, required: true },
  // 是否使用 CList 难度分，决定标题旁标注的来源。
  clist: Boolean,
});
const FONT = 'Arial, Helvetica, sans-serif';
// 图表显示哪一种数值，由标题栏的切换按钮决定；选择记在设置里，换页面后保持。
// 题数：这一档通过了多少题。
// 解决占比：这一档通过的题数 ÷ 全部已解决的题数。
// 分段占比：这一档覆盖了题库里的多少题 ÷ 题库里这一档共有多少题。
const modes = [
  ['count', 'analyticsModeCount'],
  ['share', 'analyticsModeShare'],
  ['coverage', 'analyticsModeCoverage'],
];
function setMode(id) {
  appSettings.user.analytics.ratingsMode = id;
  saveSettings();
}
// 占比写法：每栏只有二十多像素宽，10% 以上不带小数，以下带一位；覆盖到了但不到 0.05% 的写成 <.1%。
function shareText(value) {
  if (value >= 9.95) return `${Math.round(value)}%`;
  return value < 0.05 ? '<.1%' : `${value.toFixed(1)}%`;
}
const percent = (part, whole) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : 'N/A');
// 横轴上各档的名称。官方难度分最高就是 3500；CList 分会更高，都并在最高一档里，所以写成「≥3500」。
const nameOf = (rating) => (rating === RATING_MAX && props.clist ? `≥${rating}` : String(rating));
// 悬停提示里写出这一档的分数范围。最低一档收进了更低的分数，写成「≤899」。
function rangeOf(rating) {
  if (rating === RATING_MAX) return nameOf(rating);
  const top = rating + RATING_STEP - 1;
  return rating === RATING_MIN ? `≤${top}` : `${rating}–${top}`;
}
// 悬停提示里的小表（[[项目名, 数值], ...]）：三种数值都写出来，不管当前切到哪一种。
// 覆盖率按「覆盖了题库里的多少题」算，不按通过数算：并行场次的两道同名题在题库里只是一道。
const detailOf = (bucket, solvedTotal) =>
  t(
    'analyticsCoverageTip',
    bucket.solved,
    percent(bucket.solved, solvedTotal),
    bucket.covered,
    bucket.total,
    percent(bucket.covered, bucket.total),
  );
// 横轴上的每一栏：各分数档，以及未评级。range 和 detail 是悬停提示的两部分。
const columns = computed(() => {
  const { buckets, unrated } = props.distribution;
  // 占比的分母：全部已解决的题，包括未评级的。
  const solvedTotal = buckets.reduce((sum, bucket) => sum + bucket.solved, unrated.solved);
  const list = buckets.map((bucket) => ({
    name: nameOf(bucket.rating),
    solved: bucket.solved,
    covered: bucket.covered,
    total: bucket.total,
    range: rangeOf(bucket.rating),
    detail: detailOf(bucket, solvedTotal),
    ...ratingPaint(bucket.rating),
  }));
  // 横轴上每栏只有二十多像素宽，「未评级」写不下，轴上标 N/A，悬停提示里写全称。
  list.push({
    name: 'N/A',
    solved: unrated.solved,
    covered: unrated.covered,
    total: unrated.total,
    range: t('analyticsUnrated'),
    // 说明和各分数档写法一致。
    detail: detailOf(unrated, solvedTotal),
    unrated: true,
  });
  return list;
});
// 悬停提示：整块提示用这一档难度的配色——浅色背板、同色边线，分数范围用档位色加粗，下面是和别的图表一样的小表。
// 不在提示里再套一个标签框。这里只给出内容和配色，面板由图表的提示统一维护，换档时颜色能渐变过去。
function tipOf(column) {
  return {
    lead: column.range,
    leadColor: column.text,
    items: tipRows(column.detail),
    background: column.tint,
    border: column.edge,
  };
}
// 各栏配上颜色。未评级不属于任何档位，用中性的灰色。
const painted = computed(() => {
  const ink = grays();
  return columns.value.map((column) =>
    column.unrated
      ? { ...column, fill: ink.faint, edge: ink.edge, text: ink.muted, tint: ink.faint }
      : column,
  );
});
// 每一栏要画的数值；两种占比都写成百分数。
const values = computed(() => {
  const mode = appSettings.user.analytics.ratingsMode;
  const solvedTotal = painted.value.reduce((sum, column) => sum + column.solved, 0);
  return painted.value.map((column) => {
    if (mode === 'coverage') return column.total ? (column.covered / column.total) * 100 : 0;
    if (mode === 'share') return solvedTotal ? (column.solved / solvedTotal) * 100 : 0;
    return column.solved;
  });
});
// 绘图区右边留的空白；左边留给纵轴的刻度。
const SIDE = 2;
function buildOption(width) {
  const ink = grays();
  const share = appSettings.user.analytics.ratingsMode !== 'count';
  const list = painted.value;
  const shown = values.value;
  // 窄屏上横轴的数字放不下，斜着写。
  const narrow = (width - AXIS_LEFT - SIDE) / list.length < 25;
  return {
    grid: { left: AXIS_LEFT, right: SIDE, top: 20, bottom: narrow ? 34 : 22 },
    xAxis: {
      type: 'category',
      data: list.map((column) => column.name),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: ink.line } },
      // 每一档都标出来，文字用该档难度的颜色。
      axisLabel: {
        interval: 0,
        margin: 7,
        rotate: narrow ? 55 : 0,
        fontSize: 10,
        fontFamily: FONT,
        color: (_value, index) => list[index]?.text,
      },
    },
    // 左边的刻度：题数，或者占比（百分数）。上限交给图表库取整到好读的刻度；全是 0 时给个 1，不然没有范围。
    // 绘图区上方留出的 20 像素放最高那根柱子的数字。
    yAxis: {
      type: 'value',
      min: 0,
      max: ({ max }) => (max ? null : 1),
      // 题数的刻度只取整数。
      minInterval: share ? 0 : 1,
      splitNumber: 3,
      axisLabel: {
        margin: 6,
        fontSize: 10,
        fontFamily: FONT,
        color: ink.label,
        formatter: (value) => (share ? `${+value.toFixed(1)}%` : axisCountText(value)),
      },
      splitLine: { lineStyle: { color: ink.faint } },
    },
    series: [
      {
        id: 'ratings',
        type: 'bar',
        // 柱子自己不响应鼠标：悬停范围由下面的 hit 统一判断，强调也由它触发。
        silent: true,
        barCategoryGap: '16%',
        // 数值变化（切换题数与占比、切换队伍提交或难度分来源、刷新）时，柱子从左到右依次过渡到新的高度，
        // 像一道波浪推过去；柱顶的数字同步滚动。
        animationDurationUpdate: 520,
        animationEasingUpdate: 'cubicInOut',
        animationDelay: (index) => index * 12,
        animationDelayUpdate: (index) => index * 9,
        data: list.map((column, index) => ({
          // 两种模式下各柱的高低不同，切换时柱子带着过渡长到新的高度，数字跟着滚动到新值。
          value: shown[index],
          empty: !shown[index],
          // 柱子上方的数字和横轴的分数一样，用这一档难度的颜色。
          label: { color: column.text },
          itemStyle: {
            color: column.fill,
            borderColor: column.edge,
            borderWidth: 1,
            borderType: column.unrated ? 'dashed' : 'solid',
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
        // 题数或占比标在各自的柱子上方；没有题的那一档不标。数字滚动时是小数，题数要取整后再显示。
        label: {
          show: true,
          formatter: ({ value, data }) => {
            if (data ? data.empty : !value) return '';
            if (share) return shareText(value);
            return Math.round(value) ? String(Math.round(value)) : '';
          },
          position: 'top',
          distance: 3,
          fontSize: 10,
          fontFamily: FONT,
          valueAnimation: true,
        },
        emphasis: { label: { fontWeight: 'bold' } },
      },
    ],
  };
}
// 悬停范围：每一栏里，从柱顶数字的上沿一直到图表底部（数字、数字和柱子之间的空隙、柱子、横轴的分数）
// 连成一片都算；数字上方的空白不算。没有题的那一栏没有数字，只有贴近底线的一小段和横轴的分数算。
const LABEL_REACH = 18;
function hit(x, y, chart) {
  const list = painted.value;
  const index = chart.convertFromPixel({ seriesIndex: 0 }, [x, y])?.[0];
  if (!Number.isInteger(index) || index < 0 || index >= list.length) return null;
  const value = values.value[index];
  const top = chart.convertToPixel({ seriesIndex: 0 }, [index, value]);
  if (!top) return null;
  // 鼠标要在这一栏的左右范围内，并且不高于数字的上沿。
  const band = (chart.getWidth() - AXIS_LEFT - SIDE) / list.length;
  if (Math.abs(x - top[0]) > band / 2) return null;
  if (y < top[1] - (value ? LABEL_REACH : 4)) return null;
  return { seriesIndex: 0, dataIndex: index, value };
}
const { element } = useChart(buildOption, {
  tip: { hit, content: (item) => tipOf(painted.value[item.dataIndex]) },
});
</script>

<template>
  <section class="cf-analytics-card">
    <header class="cf-analytics-card-head is-stacked">
      <h4>
        <span data-cf-language-text>{{ t('analyticsRatingsTitle') }}</span>
      </h4>
      <!-- 右侧分两行：显示哪一种数值；难度分来源。 -->
      <div class="cf-analytics-card-tools">
        <ModeSwitch
          :modes="modes"
          :model-value="appSettings.user.analytics.ratingsMode"
          :label="t('analyticsModeLabel')"
          @update:model-value="setMode"
        />
        <RatingSource />
      </div>
    </header>
    <div ref="element" class="cf-analytics-chart cf-analytics-ratings-chart"></div>
  </section>
</template>

<style>
.cf-analytics-ratings-chart {
  height: 190px;
}
</style>
