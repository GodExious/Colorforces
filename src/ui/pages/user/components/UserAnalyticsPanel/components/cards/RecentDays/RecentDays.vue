<script setup>
import { appSettings, saveSettings } from '../../../../../../../../settings.js';
import { translate as t } from '../../../../../../../../i18n/index.js';
import ModeSwitch from '../../controls/ModeSwitch/ModeSwitch.vue';
import RecentAverage from '../../bases/RecentAverage/RecentAverage.vue';

// 近期平均难度（按天数）：最近一段时间里通过的全部有难度分的题，时间范围在标题栏右边选。
defineProps({
  // { problems, average }，见统计模块的 recentAverage（带 since）。
  trend: { type: Object, required: true },
  // 题号 → 题目名称。
  nameOf: { type: Function, required: true },
});

// 可选的时间范围，和刷题作息上的一样从长到短排；选择记在设置里，换页面后保持。
const spans = [
  ['year', 'analyticsSpanYear'],
  ['quarter', 'analyticsSpanQuarter'],
  ['month', 'analyticsSpanMonth'],
  ['week', 'analyticsSpanWeek'],
];
function setSpan(id) {
  appSettings.user.analytics.recentSpan = id;
  saveSettings();
}
</script>

<template>
  <RecentAverage
    :trend="trend"
    :name-of="nameOf"
    :title="t('analyticsRecentDaysTitle')"
    :empty="t('analyticsRecentDaysEmpty')"
  >
    <ModeSwitch
      :modes="spans"
      :model-value="appSettings.user.analytics.recentSpan"
      :label="t('analyticsSpanLabel')"
      @update:model-value="setSpan"
    />
  </RecentAverage>
</template>
