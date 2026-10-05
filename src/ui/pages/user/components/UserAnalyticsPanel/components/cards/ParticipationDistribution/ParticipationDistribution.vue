<script setup>
import { computed } from 'vue';
import { translate as t } from '../../../../../../../../i18n/index.js';
import BarList from '../../bases/BarList/BarList.vue';
import { countText, percentOf, percentText } from '../../../utils/numbers.js';
import { tintedTip } from '../../../utils/tips.js';

const props = defineProps({
  // [{ type, count }]，见统计模块的 participationDistribution：全部提交按提交时的参赛身份计数。
  // 正式参赛、虚拟参赛、未评级参赛、练习四种按这个顺序排在前面，其余的身份有才列出。
  types: { type: Array, required: true },
});

// 各种身份的颜色；没列在这里的用面板的主色。
const COLORS = {
  CONTESTANT: '#5b8fd6',
  VIRTUAL: '#8a7ad8',
  OUT_OF_COMPETITION: '#43b8af',
  PRACTICE: '#8b97a8',
};
const total = computed(() => props.types.reduce((sum, item) => sum + item.count, 0));
const rows = computed(() => {
  const names = t('analyticsTypeNames');
  return props.types.map((item) => {
    const name = names[item.type] || item.type;
    return {
      name,
      value: item.count,
      color: COLORS[item.type],
      tip: () =>
        tintedTip(
          name,
          COLORS[item.type],
          t(
            'analyticsSubmissionShareTip',
            countText(item.count),
            percentText(percentOf(item.count, total.value)),
          ),
        ),
    };
  });
});
</script>

<template>
  <section class="cf-analytics-card">
    <header class="cf-analytics-card-head">
      <h4>
        <span data-cf-language-text>{{ t('analyticsChartTypes') }}</span>
      </h4>
    </header>
    <BarList :rows="rows" />
  </section>
</template>
