<script setup>
import { appSettings, saveSettings } from '../../../../../settings.js';
import { translate as t } from '../../../../../i18n/index.js';
import ToggleSwitch from '../../../../components/forms/ToggleSwitch/ToggleSwitch.vue';
import NumberInput from '../../../../components/forms/NumberInput/NumberInput.vue';
import ExpandTransition from '../../../../components/transitions/ExpandTransition/ExpandTransition.vue';
import InfoHint from '../../../../components/tooltips/InfoHint/InfoHint.vue';
import SettingSection from '../../../../components/settings/SettingSection/SettingSection.vue';
import { toggleFromRow } from '../../../../../utils/row-toggle.js';

// 总开关下面的子选项分成三段（功能、样式、内容，见 SettingSection）。这是前两段里的开关；带 hint 的在文字旁显示「i」说明。
// 「功能」一段的末尾另有两个数字框（缓存用户数、近期平均难度的题数）。
const functions = [
  { key: 'autoLoad', label: 'analyticsAutoLoad' },
  { key: 'includeTeams', label: 'analyticsIncludeTeams' },
  { key: 'followRatingSource', label: 'analyticsFollowSource', hint: 'analyticsFollowSourceHint' },
];
const styles = [
  { key: 'followRatingStyle', label: 'analyticsFollowStyle' },
  { key: 'collapse', label: 'analyticsCollapse', hint: 'analyticsCollapseHint' },
];
// 「内容」一段：展示哪些分析数据，顺序与个人主页上的排列一致。这一段可以折叠，标题右边写已选了几项。
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
// 「内容」一段里开着几项。
const shownCharts = () => charts.filter(([key]) => appSettings.user.analytics.charts[key]).length;
</script>

<template>
  <section class="cf-analytics-settings">
    <div class="cf-setting-item" @click="toggleFromRow">
      <span class="cf-setting-label"
        ><label for="cf-analytics-control-enabled">{{ t('analyticsEnable') }}</label></span
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
        <SettingSection :title="t('settingSectionFunction')">
          <div
            v-for="option in functions"
            :key="option.key"
            class="cf-setting-item"
            @click="toggleFromRow"
          >
            <span class="cf-setting-sublabel"
              ><span>{{ t(option.label) }}</span
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
              ><label for="cf-analytics-control-cache-users">{{ t('analyticsCacheUsers') }}</label
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
              ><label for="cf-analytics-control-recent-count">{{
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
        </SettingSection>
        <SettingSection :title="t('settingSectionStyle')">
          <div
            v-for="option in styles"
            :key="option.key"
            class="cf-setting-item"
            @click="toggleFromRow"
          >
            <span class="cf-setting-sublabel"
              ><span>{{ t(option.label) }}</span
              ><InfoHint v-if="option.hint" :text="t(option.hint)"
            /></span>
            <ToggleSwitch
              as="label"
              v-model="appSettings.user.analytics[option.key]"
              :data-control="`analytics-${option.key}`"
              @change="saveSettings()"
            />
          </div>
        </SettingSection>
        <SettingSection
          :title="t('settingSectionContent')"
          foldable
          :summary="t('settingSelected', shownCharts(), charts.length)"
          :muted="shownCharts() === 0"
        >
          <label v-for="[key, label] in charts" :key="key" class="cf-setting-item">
            <span class="cf-setting-sublabel">{{ t(label) }}</span>
            <ToggleSwitch
              as="div"
              v-model="appSettings.user.analytics.charts[key]"
              :data-control="`analytics-chart-${key}`"
              @change="saveSettings()"
            />
          </label>
        </SettingSection>
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
/* 数字输入这一行没有开关，行内空白处不可点，只有文字可点（点了聚焦输入框）。 */
.cf-analytics-number-row {
  cursor: default;
}
.cf-analytics-number-row label {
  cursor: pointer;
}
</style>
