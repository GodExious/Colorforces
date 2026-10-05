<script setup>
import { computed, ref, watch } from 'vue';
import { translate as t } from '../../../../../../../../i18n/index.js';
import { localMonth, zoneMonth } from '../../../../../../../../features/user/analytics/stats.js';
import ChartLegend from '../../parts/ChartLegend/ChartLegend.vue';
import ColumnChart from '../../bases/ColumnChart/ColumnChart.vue';
import PeriodSwitch from '../../controls/PeriodSwitch/PeriodSwitch.vue';
import ZonePicker from '../../controls/ZonePicker/ZonePicker.vue';
import { tintedTip } from '../../../utils/tips.js';

const props = defineProps({
  // 逐月的 { month, submissions, solved }，见统计模块的 monthlyActivity。month 是「年 × 12 + 月」，已经按下面这个时区算好。
  months: { type: Array, required: true },
  // 划分月份用的时区（相对 UTC 的小时数）；null 表示用查看者自己的时区。和「最长连续」、难度热力图、刷题作息上的是同一个值。
  zone: { type: Number, default: null },
});
const emit = defineEmits(['zone']);

// 两组柱子的颜色：提交数用浅色，新通过的题数用深色；后面一个是悬停时的颜色。
const SUBMISSIONS = ['#bcd3f2', '#9dbdea'];
const SOLVED = ['#5b8fd6', '#3f73bd'];
const pad = (value) => String(value).padStart(2, '0');
const yearOf = (month) => Math.floor(month / 12);
const nameOf = (month) => `${yearOf(month)}-${pad((month % 12) + 1)}`;
const count = (value) => Math.round(value).toLocaleString('en-US');

// 一次只看十二个月：默认是截至本月的最近十二个月，也可以切到某一个自然年。
// 「本月」也按所选的时区算。
const thisMonth = computed(() =>
  (props.zone === null ? localMonth : zoneMonth(props.zone))(Date.now() / 1000),
);
const lastYear = computed(() => yearOf(thisMonth.value));
const firstYear = computed(() =>
  props.months.length ? Math.min(lastYear.value, yearOf(props.months[0].month)) : lastYear.value,
);
const period = ref('now');
watch([firstYear, lastYear], () => {
  if (period.value !== 'now' && (period.value < firstYear.value || period.value > lastYear.value))
    period.value = 'now';
});
const byMonth = computed(() => new Map(props.months.map((item) => [item.month, item])));
// 当前时间段的十二个月，没有提交的月份数字为 0。
const shown = computed(() => {
  const first = period.value === 'now' ? thisMonth.value - 11 : period.value * 12;
  return Array.from(
    { length: 12 },
    (_, offset) =>
      byMonth.value.get(first + offset) || { month: first + offset, submissions: 0, solved: 0 },
  );
});
// 每个月都标出来；第一栏和每年一月在月份下面再标一行年份，跨年时不会看错。
const labels = computed(() => {
  const names = t('analyticsMonths');
  return shown.value.map(({ month }, index) => {
    const name = names[month % 12];
    return index === 0 || month % 12 === 0 ? `${name}\n${yearOf(month)}` : name;
  });
});
const series = computed(() => [
  { id: 'submissions', values: shown.value.map((item) => item.submissions), colors: SUBMISSIONS },
  {
    id: 'solved',
    values: shown.value.map((item) => item.solved),
    colors: SOLVED,
    labelColor: SOLVED[1],
  },
]);
// 提示：这个月的年月，下面是提交了多少次、新通过多少题。
function tipOf(index) {
  const item = shown.value[index];
  return tintedTip(
    nameOf(item.month),
    SOLVED[0],
    t('analyticsActivityTip', count(item.submissions), count(item.solved)),
  );
}
// 图例：两组柱子各是什么。
const legend = computed(() => [
  [SUBMISSIONS[0], t('analyticsActivitySubmissions')],
  [SOLVED[0], t('analyticsActivitySolved')],
]);
</script>

<template>
  <section class="cf-analytics-card">
    <header class="cf-analytics-card-head is-stacked">
      <h4>
        <span data-cf-language-text>{{ t('analyticsActivityTitle') }}</span>
      </h4>
      <!-- 右侧分两行：时间段和时区；图例。 -->
      <div class="cf-analytics-card-tools">
        <div class="cf-analytics-card-row">
          <PeriodSwitch v-model="period" :first-year="firstYear" :last-year="lastYear" />
          <!-- 按哪个时区划分月份。和「最长连续」、难度热力图、刷题作息上的那一个改的是同一个值。 -->
          <ZonePicker :zone="zone" @zone="emit('zone', $event)" />
        </div>
        <ChartLegend :items="legend" />
      </div>
    </header>
    <ColumnChart :labels="labels" :series="series" :tip="tipOf" />
  </section>
</template>
