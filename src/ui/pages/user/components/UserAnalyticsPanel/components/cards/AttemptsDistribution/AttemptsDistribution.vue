<script setup>
import { computed } from 'vue';
import { translate as t } from '../../../../../../../../i18n/index.js';
import BarList from '../../bases/BarList/BarList.vue';
import { countText, percentOf, percentText } from '../../../utils/numbers.js';
import { tintedTip } from '../../../utils/tips.js';

const props = defineProps({
  // [{ id, count }]，四档：一次、两次、三到五次、六次及以上，见统计模块的 attemptsDistribution。
  // 每道已通过的题按「到首次通过为止交了几次」归到一档。
  attempts: { type: Array, required: true },
});

// 各档的颜色：交的次数越多越偏暖，一次通过是绿色，六次以上是红色。
const COLORS = { 1: '#34b37a', 2: '#9bbf3b', '3-5': '#f0a12e', '6+': '#e5604d' };
const total = computed(() => props.attempts.reduce((sum, item) => sum + item.count, 0));
const rows = computed(() => {
  const names = t('analyticsAttemptsNames');
  return props.attempts.map((item) => ({
    name: names[item.id],
    value: item.count,
    color: COLORS[item.id],
    tip: () =>
      tintedTip(
        names[item.id],
        COLORS[item.id],
        t(
          'analyticsSolvedShareTip',
          countText(item.count),
          percentText(percentOf(item.count, total.value)),
        ),
      ),
  }));
});
</script>

<template>
  <section class="cf-analytics-card">
    <header class="cf-analytics-card-head">
      <h4>
        <span data-cf-language-text>{{ t('analyticsChartAttempts') }}</span>
      </h4>
    </header>
    <BarList :rows="rows" />
  </section>
</template>
