<script setup>
import { computed, ref, watch } from 'vue';
import { use } from 'echarts/core';
import { CustomChart } from 'echarts/charts';
import { CalendarComponent } from 'echarts/components';
import { translate as t } from '../../../../../../../../i18n/index.js';
import {
  bucketRating,
  localDay,
  zoneDay,
} from '../../../../../../../../features/user/analytics/stats.js';
import { problemLink } from '../../../../../../../../utils/problem.js';
import { useChart } from '../../../composables/chart.js';
import { grays } from '../../../utils/grays.js';
import { ratingPaint } from '../../../utils/rating-paint.js';
import PeriodSwitch from '../../controls/PeriodSwitch/PeriodSwitch.vue';
import ZonePicker from '../../controls/ZonePicker/ZonePicker.vue';
import ChartHint from '../../parts/ChartHint/ChartHint.vue';
import RatingSource from '../../parts/RatingSource/RatingSource.vue';

// 日历坐标和自定义图形只有这张图用，在这里登记。
use([CustomChart, CalendarComponent]);

const props = defineProps({
  // 「第几天 → { problems, top }」，见统计模块的 solvedByDay。日期已经按下面这个时区划分好。
  days: { type: Map, required: true },
  // 题号 → 题目名称。
  nameOf: { type: Function, required: true },
  // 划分日期用的时区（相对 UTC 的小时数）；null 表示用查看者自己的时区。和「最长连续」上的是同一个值。
  zone: { type: Number, default: null },
});
const emit = defineEmits(['zone']);

const DAY = 86400000;
const pad = (value) => String(value).padStart(2, '0');
// 「第几天」和日期互换。天数是按所选时区的日历数的，所以用协调世界时的读写方法换算，不再受本机时区影响。
const dayOfDate = (year, month, date) => Math.floor(Date.UTC(year, month, date) / DAY);
function dateText(day) {
  const date = new Date(day * DAY);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
const yearOfDay = (day) => new Date(day * DAY).getUTCFullYear();

// 所选时区里的「今天」。
const today = computed(() => {
  const now = Date.now() / 1000;
  return props.zone === null ? localDay(now) : zoneDay(props.zone)(now);
});
// 能切到的年份：从最早通过的那一年到今年。
const lastYear = computed(() => yearOfDay(today.value));
const firstYear = computed(() => {
  let first = Infinity;
  for (const day of props.days.keys()) first = Math.min(first, day);
  return Number.isFinite(first) ? Math.min(lastYear.value, yearOfDay(first)) : lastYear.value;
});
// 默认显示「近一年」：截至今天的 365 天。也可以切到某一个自然年。
const period = ref('now');
watch([firstYear, lastYear], () => {
  if (period.value !== 'now' && (period.value < firstYear.value || period.value > lastYear.value))
    period.value = 'now';
});
// 当前时间段的第一天和最后一天。
const range = computed(() =>
  period.value === 'now'
    ? [today.value - 364, today.value]
    : [dayOfDate(period.value, 0, 1), dayOfDate(period.value, 11, 31)],
);

// 一道题的颜色：有难度分的按所在档位取色，没有的用中性的灰色。
// mark / markEdge 是格子的填充与边线；edge / tint 是悬停提示面板的边线与底色。
function paintOf(rating, ink) {
  if (rating === null)
    return {
      mark: ink.edge,
      markEdge: ink.muted,
      edge: ink.muted,
      text: ink.label,
      tint: ink.faint,
    };
  return ratingPaint(bucketRating(rating));
}
// 一天的颜色。当天有新通过的题：取其中最高的难度。
// 当天只是把以前通过的题又通过了一次：用一种很淡的灰色，比没有记录的空格子略深一点、带一圈细边。
// 没有记录：最浅的灰色，不带边。
function paintOfDay(entry, ink) {
  if (!entry) return { mark: ink.faint, markEdge: '', text: '' };
  if (!entry.problems.length)
    return { mark: ink.line, markEdge: ink.edge, edge: '', text: ink.label, tint: '' };
  return paintOf(entry.top, ink);
}
// 时间段里的每一天：日期、当天的记录（没有通过则为空）、格子的颜色。
const cells = computed(() => {
  const ink = grays();
  const [start, end] = range.value;
  return Array.from({ length: end - start + 1 }, (_, offset) => {
    const entry = props.days.get(start + offset) || null;
    return {
      day: start + offset,
      date: dateText(start + offset),
      entry,
      ...paintOfDay(entry, ink),
    };
  });
});
// 标题栏里的小字：这段时间有多少天通过了新题、一共多少题。只有重做的日子不算在内。
const totals = computed(() => {
  let days = 0;
  let count = 0;
  for (const cell of cells.value) {
    if (!cell.entry?.problems.length) continue;
    days++;
    count += cell.entry.problems.length;
  }
  return { days, count };
});

// 版式：左边留给星期，上边留给月份。
const LEFT = 26;
const TOP = 18;
// 这段时间在日历上占几列（一列一周，从星期日起）：一年是 53 列，个别年份 54 列。
const weeks = computed(() => {
  const [start, end] = range.value;
  return Math.ceil((new Date(start * DAY).getUTCDay() + end - start + 1) / 7);
});
// 格子的大小按宽度算，让日历正好从左边的星期标注排到卡片的右边缘，右边不留一截空白；
// 所以大小不取整。卡片特别宽时封顶，不让格子大得离谱；特别窄时也有个下限。
// 相邻两个格子之间的空隙。最后一列右边的那半个空隙不算在宽度里，格子的右边缘才贴得到卡片的右边缘。
const GAP = 3;
const CELL_MIN = 6;
const CELL_MAX = 20;
const cellSize = (width) =>
  Math.max(CELL_MIN, Math.min(CELL_MAX, (width - LEFT + GAP / 2 - 1) / weeks.value));
function buildOption(width) {
  const ink = grays();
  const list = cells.value;
  const size = cellSize(width);
  const label = { fontSize: 10, color: ink.muted, fontFamily: 'verdana, arial, sans-serif' };
  return {
    calendar: {
      range: [list[0].date, list.at(-1).date],
      left: LEFT,
      top: TOP,
      cellSize: [size, size],
      splitLine: { show: false },
      itemStyle: { color: 'transparent', borderWidth: 0 },
      yearLabel: { show: false },
      // 第一行是星期日，往下依次是星期一到星期六。
      dayLabel: { ...label, firstDay: 0, margin: 6, nameMap: t('analyticsWeekdays') },
      monthLabel: { ...label, margin: 5, nameMap: t('analyticsMonths') },
    },
    series: [
      {
        id: 'heatmap',
        type: 'custom',
        coordinateSystem: 'calendar',
        // 这里不能像柱状图那样设成「不响应鼠标」：自定义图形一旦不响应鼠标，由代码触发的强调也不生效。
        // 悬停范围仍由下面的 hit 统一判断；图形自己对鼠标的响应由 useChart 兜住。
        data: list.map((cell) => [cell.date, cell.day]),
        renderItem(params, api) {
          const cell = list[params.dataIndex];
          if (!cell) return null;
          const [x, y] = api.coord(api.value(0));
          const side = Math.max(2, params.coordSys.cellWidth - GAP);
          return {
            type: 'rect',
            shape: { x: x - side / 2, y: y - side / 2, width: side, height: side, r: 2 },
            style: {
              fill: cell.mark,
              stroke: cell.markEdge || null,
              lineWidth: cell.markEdge ? 1 : 0,
            },
            // 悬停：格子保持本色，边线换成这一档的文字色并加粗。
            emphasis: { style: { stroke: cell.text || cell.markEdge || null, lineWidth: 1.5 } },
            // 换时区或换配色时，各个格子挪到新位置、颜色渐变过去。换时间段时整张日历滑动，见下面的 slide。
            // 不要给格子加「离场淡出」（leaveTo）：带动画更新时图表库会在那一步报错，整张图就不再更新了。
            transition: ['shape', 'style'],
          };
        },
      },
    ],
  };
}
// 悬停范围：有通过记录（新通过或重做）的那一天的格子。没有记录的日子不提示。
function hit(x, y, chart) {
  // 先看鼠标是否在日历的范围里；范围之外不必去换算日期。
  const size = cellSize(chart.getWidth());
  if (x < LEFT || x > LEFT + weeks.value * size || y < TOP || y > TOP + 7 * size) return null;
  const time = chart.convertFromPixel({ seriesIndex: 0 }, [x, y]);
  if (!time) return null;
  // 日历按本机时区解读日期文字，换算回来的时刻也按本机时区读出年月日，正好还原成同一个日期。
  const date = new Date(time);
  const list = cells.value;
  const index = dayOfDate(date.getFullYear(), date.getMonth(), date.getDate()) - list[0].day;
  const cell = list[index];
  if (!cell?.entry) return null;
  return { seriesIndex: 0, dataIndex: index, value: cell.day };
}
// 提示：日期和当天的题数，下面逐条列出当天的题，每一行是指向题目页的链接。
// 新通过的题在前，题号和难度分按档位着色；以前就通过、当天重做的题排在后面，
// 前面有一行小标题，整行用灰色，和新通过的一眼分得开。题目很多时列表自己滚动。
// 平时提示只是跟着悬停走；点一下格子把它固定住，才能移进去点链接和滚动列表。
function tipOf({ dataIndex }) {
  const ink = grays();
  const cell = cells.value[dataIndex];
  const { problems, repeats } = cell.entry;
  const row = (problem, muted) => ({
    label: problem.key,
    text: props.nameOf(problem.key),
    value: problem.rating === null ? 'N/A' : String(problem.rating),
    color: muted ? '' : paintOf(problem.rating, ink).text,
    href: problemLink(problem.key),
    // 每一行都能点进题目页，样子上给出提示：名称带下划线，行尾一个箭头。
    action: true,
    muted,
  });
  return {
    lead: cell.date,
    leadColor: cell.text,
    text: [
      problems.length ? t('analyticsHeatmapTip', problems.length) : '',
      repeats.length ? t('analyticsHeatmapTipRepeat', repeats.length) : '',
    ]
      .filter(Boolean)
      .join(' · '),
    background: cell.tint,
    border: cell.edge,
    items: [
      ...problems.map((problem) => row(problem, false)),
      ...(repeats.length ? [{ heading: t('analyticsHeatmapRepeatHeading') }] : []),
      ...repeats.map((problem) => row(problem, true)),
    ],
  };
}
// 提示的面板离格子的上沿这么远。
const TIP_GAP = 6;
const { element, width, resize, slide } = useChart(buildOption, {
  tip: {
    hit,
    content: tipOf,
    // 提示里的题目是链接：点一下格子把提示固定住，鼠标就能移进去点。
    pinnable: true,
    // 提示对准格子所在那一格的上沿正中。
    point({ dataIndex }, chart) {
      const [x, y] = chart.convertToPixel({ seriesIndex: 0 }, cells.value[dataIndex].date);
      return [x, y - cellSize(chart.getWidth()) / 2];
    },
    gap: TIP_GAP,
  },
});
// 换时间段时整张日历横向滑动，像沿着时间轴翻页：换到更早的一段，新的日历从左边滑进来；
// 换到更晚的一段，从右边滑进来。左边的星期标注留在原地。「近一年」排在所有年份之后。
// 这个侦听在图表更新之前运行，slide 才来得及把换之前的画面留下来。
const order = (value) => (value === 'now' ? Infinity : value);
watch(period, (next, previous) => slide(order(next) < order(previous) ? -1 : 1, { keep: LEFT }));
// 图表的高度跟着格子的大小走：七行格子加上方的月份。
const height = computed(() => Math.ceil(TOP + cellSize(width.value || 800) * 7 + 4));
// 面板变宽变窄时格子大小会变，图表跟着调整到新的高度。
watch(height, (value) => resize(value), { flush: 'post' });
</script>

<template>
  <section class="cf-analytics-card">
    <header class="cf-analytics-card-head is-stacked">
      <h4>
        <span data-cf-language-text>{{ t('analyticsHeatmapTitle') }}</span>
      </h4>
      <!-- 右侧分三行：时间段和时区；难度分来源；这段时间的小计。 -->
      <div class="cf-analytics-card-tools">
        <div class="cf-analytics-card-row">
          <PeriodSwitch v-model="period" :first-year="firstYear" :last-year="lastYear" />
          <!-- 按哪个时区划分每一天，排在时间段的右边。和「最长连续」上的那一个改的是同一个值。 -->
          <ZonePicker :zone="zone" @zone="emit('zone', $event)" />
        </div>
        <!-- 格子的颜色按难度分取，标出用的是哪一种难度分。 -->
        <RatingSource />
        <Transition name="cf-analytics-swap" mode="out-in">
          <span
            :key="`${period}-${totals.days}-${totals.count}`"
            class="cf-analytics-card-note"
            data-cf-language-text
            >{{ t('analyticsHeatmapNote', totals.days, totals.count) }}</span
          >
        </Transition>
      </div>
    </header>
    <div
      ref="element"
      class="cf-analytics-chart cf-analytics-heatmap-chart"
      :style="{ height: `${height}px` }"
    ></div>
    <!-- 说明从日历格子开始的位置起，不压在左边的星期标注下面。 -->
    <ChartHint :inset="LEFT">{{ t('analyticsHeatmapPinHint') }}</ChartHint>
  </section>
</template>
