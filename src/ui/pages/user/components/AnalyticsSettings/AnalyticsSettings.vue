<script setup>
import { appSettings, saveSettings } from '../../../../../settings.js';
import { translate as t } from '../../../../../i18n/index.js';
import ToggleSwitch from '../../../../components/forms/ToggleSwitch/ToggleSwitch.vue';
import NumberInput from '../../../../components/forms/NumberInput/NumberInput.vue';
import ExpandTransition from '../../../../components/transitions/ExpandTransition/ExpandTransition.vue';
import InfoHint from '../../../../components/tooltips/InfoHint/InfoHint.vue';
import { toggleFromRow } from '../../../../../utils/row-toggle.js';

// 总开关下的几项开关；带 hint 的在文字旁显示「i」说明。
const options = [
  { key: 'autoLoad', label: 'analyticsAutoLoad' },
  { key: 'collapse', label: 'analyticsCollapse', hint: 'analyticsCollapseHint' },
  { key: 'followRatingSource', label: 'analyticsFollowSource', hint: 'analyticsFollowSourceHint' },
  { key: 'followRatingStyle', label: 'analyticsFollowStyle' },
  { key: 'includeTeams', label: 'analyticsIncludeTeams' },
];
// 「展示的分析数据」下的各项，顺序与个人主页上的排列一致。
const charts = [
  ['summary', 'analyticsChartSummary'],
  ['heatmap', 'analyticsChartHeatmap'],
  ['activity', 'analyticsChartActivity'],
  ['hours', 'analyticsChartHours'],
  ['compare', 'analyticsChartCompare'],
  ['compareRank', 'analyticsChartCompareRank'],
  ['ratings', 'analyticsChartRatings'],
  ['tags', 'analyticsChartTags'],
  ['weakness', 'analyticsChartWeakness'],
  ['recent', 'analyticsChartRecent'],
  ['recentDays', 'analyticsChartRecentDays'],
  ['attempts', 'analyticsChartAttempts'],
  ['verdicts', 'analyticsChartVerdicts'],
  ['speed', 'analyticsChartSpeed'],
  ['types', 'analyticsChartTypes'],
  ['languages', 'analyticsChartLanguages'],
  ['unsolved', 'analyticsChartUnsolved'],
];
</script>

<template>
  <section class="cf-analytics-settings">
    <div class="cf-setting-item" @click="toggleFromRow">
      <span class="cf-setting-label"
        ><label for="cf-analytics-control-enabled" data-cf-language-text>{{
          t('analyticsEnable')
        }}</label></span
      >
      <ToggleSwitch
        as="label"
        input-id="cf-analytics-control-enabled"
        v-model="appSettings.user.analytics.enabled"
        data-control="analyticsEnabled"
        @change="saveSettings()"
      />
    </div>
    <ExpandTransition :show="appSettings.user.analytics.enabled">
      <div class="cf-analytics-subsettings">
        <div
          v-for="option in options"
          :key="option.key"
          class="cf-setting-item"
          @click="toggleFromRow"
        >
          <span class="cf-setting-sublabel"
            ><span data-cf-language-text>{{ t(option.label) }}</span
            ><InfoHint v-if="option.hint" :text="t(option.hint)"
          /></span>
          <ToggleSwitch
            as="label"
            v-model="appSettings.user.analytics[option.key]"
            :data-control="`analytics-${option.key}`"
            @change="saveSettings()"
          />
        </div>
        <!-- 整行不能做成 label：行里的说明图标是按钮，会被当成这个 label 对应的控件，
             鼠标停在行内空白处时图标也会显示成悬停状态。所以只让文字对应输入框。 -->
        <div class="cf-setting-item cf-analytics-number-row">
          <span class="cf-setting-sublabel"
            ><label for="cf-analytics-control-cache-users" data-cf-language-text>{{
              t('analyticsCacheUsers')
            }}</label
            ><InfoHint :text="t('analyticsCacheUsersHint')"
          /></span>
          <NumberInput
            v-model="appSettings.user.analytics.cacheUsers"
            input-id="cf-analytics-control-cache-users"
            data-control="analyticsCacheUsers"
            @change="saveSettings()"
          />
        </div>
        <!-- 和个人主页「近期平均难度」图表上的输入框是同一项设置，两边同步。 -->
        <div class="cf-setting-item cf-analytics-number-row">
          <span class="cf-setting-sublabel"
            ><label for="cf-analytics-control-recent-count" data-cf-language-text>{{
              t('analyticsRecentCount')
            }}</label></span
          >
          <NumberInput
            v-model="appSettings.user.analytics.recentCount"
            :min="1"
            input-id="cf-analytics-control-recent-count"
            data-control="analyticsRecentCount"
            @change="saveSettings()"
          />
        </div>
        <div class="cf-setting-item cf-analytics-group-title">
          <span class="cf-setting-sublabel" data-cf-language-text>{{
            t('analyticsChartsTitle')
          }}</span>
        </div>
        <div class="cf-nested-options">
          <label v-for="[key, label] in charts" :key="key" class="cf-setting-item">
            <span class="cf-setting-sublabel" data-cf-language-text>{{ t(label) }}</span>
            <ToggleSwitch
              as="div"
              v-model="appSettings.user.analytics.charts[key]"
              :data-control="`analytics-chart-${key}`"
              @change="saveSettings()"
            />
          </label>
        </div>
      </div>
    </ExpandTransition>
  </section>
</template>

<style scoped>
.cf-setting-item {
  cursor: pointer;
  user-select: none;
  margin: 0;
}
.cf-setting-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.cf-setting-sublabel {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
/* 间距与「评分预测」页一致：总开关与首个子项隔 12px，子项行高 28px、彼此隔 8px。 */
.cf-analytics-subsettings {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0 0 12px;
}
.cf-analytics-subsettings .cf-setting-item {
  min-height: 28px;
}
/* 「展示的分析数据」只是分组标题，不可点击；它下面的各项再缩进一级（公共样式 cf-nested-options）。 */
.cf-analytics-group-title,
.cf-analytics-number-row {
  cursor: default;
}
.cf-analytics-number-row label {
  cursor: pointer;
}
</style>
