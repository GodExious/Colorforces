<script setup>
import { appSettings, saveSettings } from '../../../../../../../../settings.js';
import { translate as t } from '../../../../../../../../i18n/index.js';
import NumberInput from '../../../../../../../components/forms/NumberInput/NumberInput.vue';
import RecentAverage from '../../bases/RecentAverage/RecentAverage.vue';

// 近期平均难度（按题数）：最近通过的若干道有难度分的题，题数在标题栏右边填。
defineProps({
  // { problems, average }，见统计模块的 recentAverage（不带 since）。
  trend: { type: Object, required: true },
  // 题号 → 题目名称。
  nameOf: { type: Function, required: true },
});
</script>

<template>
  <RecentAverage
    :trend="trend"
    :name-of="nameOf"
    :title="t('analyticsRecentTitle')"
    :empty="t('analyticsRecentEmpty')"
  >
    <!-- 用多少道题来平均。和菜单里的同一项设置同步。 -->
    <label class="cf-analytics-recent-count">
      <span data-cf-language-text>{{ t('analyticsRecentBefore') }}</span>
      <NumberInput
        v-model="appSettings.user.analytics.recentCount"
        :min="1"
        :aria-label="t('analyticsRecentCountLabel')"
        @change="saveSettings()"
      />
      <span data-cf-language-text>{{ t('analyticsRecentAfter') }}</span>
    </label>
  </RecentAverage>
</template>

<style>
.cf-analytics-recent-count {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  color: var(--cf-gray-500);
  font-size: var(--cf-font-size-xs);
  font-weight: normal;
  white-space: nowrap;
}
.cf-analytics-recent-count .cf-number-input {
  width: 48px;
  padding: 1px 6px;
  font-size: var(--cf-font-size-xs);
}
</style>
