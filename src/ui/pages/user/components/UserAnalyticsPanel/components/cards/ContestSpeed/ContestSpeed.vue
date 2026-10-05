<script setup>
import { computed } from 'vue';
import { translate as t } from '../../../../../../../../i18n/index.js';
import ChartLegend from '../../parts/ChartLegend/ChartLegend.vue';
import ColumnChart from '../../bases/ColumnChart/ColumnChart.vue';
import { countText } from '../../../utils/numbers.js';
import { tintedTip } from '../../../utils/tips.js';

const props = defineProps({
  // [{ from, to, submissions, solved }]，见统计模块的 contestSpeed：赛中的提交按开赛后的分钟数分段。
  // from、to 是这一段的起止分钟（左闭右开），最后一段的 to 为 null；solved 只算每道题在赛中的首次通过。
  buckets: { type: Array, required: true },
});

// 两组柱子的颜色：提交数用浅色，通过的题数用深色；后面一个是悬停时的颜色。
const SUBMISSIONS = ['#bfe3df', '#9fd3cd'];
const SOLVED = ['#43b8af', '#2f9a91'];
const any = computed(() => props.buckets.some((bucket) => bucket.submissions));
// 横轴只标分钟数：「0–10」「10–20」……最后一段写成「180+」。
const labels = computed(() =>
  props.buckets.map(({ from, to }) => (to === null ? `${from}+` : `${from}–${to}`)),
);
const series = computed(() => [
  {
    id: 'submissions',
    values: props.buckets.map((bucket) => bucket.submissions),
    colors: SUBMISSIONS,
  },
  {
    id: 'solved',
    values: props.buckets.map((bucket) => bucket.solved),
    colors: SOLVED,
    labelColor: SOLVED[1],
  },
]);
// 提示：这一段是开赛后的第几分钟，下面是这一段里提交了多少次、通过多少题。
function tipOf(index) {
  const bucket = props.buckets[index];
  return tintedTip(
    t('analyticsSpeedRange', bucket.from, bucket.to),
    SOLVED[0],
    t('analyticsSpeedTip', countText(bucket.submissions), countText(bucket.solved)),
  );
}
const legend = computed(() => [
  [SUBMISSIONS[0], t('analyticsSpeedSubmissions')],
  [SOLVED[0], t('analyticsSpeedSolved')],
]);
</script>

<template>
  <section class="cf-analytics-card">
    <header class="cf-analytics-card-head">
      <h4>
        <span data-cf-language-text>{{ t('analyticsChartSpeed') }}</span>
      </h4>
      <div class="cf-analytics-card-tools">
        <span class="cf-analytics-card-note" data-cf-language-text>{{
          t('analyticsSpeedNote')
        }}</span>
        <ChartLegend :items="legend" />
      </div>
    </header>
    <p v-if="!any" class="cf-analytics-card-empty">
      <span data-cf-language-text>{{ t('analyticsSpeedEmpty') }}</span>
    </p>
    <ColumnChart v-else :labels="labels" :series="series" :tip="tipOf" />
  </section>
</template>
