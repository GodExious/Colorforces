<script setup>
import { computed, ref, inject, onBeforeUnmount } from 'vue';
import { appSettings, saveSettings, setSetting as choose } from '../../../settings.js';
import { translate as t } from '../../../i18n/index.js';
import { languages } from '../../../i18n/languages.js';
import { CURRENT_VERSION } from '../../../config/runtime.js';
import { FONT_SIZE } from '../../../config/defaults.js';
import { checkScriptUpdate, resetUpdateCooldown } from '../../../features/general/updates.js';
import ToggleSwitch from '../../components/forms/ToggleSwitch/ToggleSwitch.vue';
import SegmentedSwitch from '../../components/forms/SegmentedSwitch/SegmentedSwitch.vue';
import ActionButton from '../../components/forms/ActionButton/ActionButton.vue';
import NumberInput from '../../components/forms/NumberInput/NumberInput.vue';
import InlineSvg from '../../components/icons/InlineSvg/InlineSvg.vue';
import { syncIcon, shortcutResetIcon as resetIcon } from '../../../assets/index.js';
import { toggleFromRow } from '../../../utils/row-toggle.js';
import MenuSizeSettings from './components/MenuSizeSettings/MenuSizeSettings.vue';
import MenuPositionSettings from './components/MenuPositionSettings/MenuPositionSettings.vue';
const updateState = ref('');
const changeLanguage = inject('cf-change-language', (value) => choose('general.lang', value));
const languageOptions = computed(() =>
  languages.map(({ code, labelKey, label }) => ({
    value: code,
    label: labelKey ? t(labelKey) : label,
  })),
);
const updateLabel = computed(() =>
  updateState.value === 'checking'
    ? t().statusCheckingUpdate
    : updateState.value === 'preview'
      ? t().statusUpdatePreview + ' (v' + CURRENT_VERSION + ')'
      : updateState.value === 'latest'
        ? t().statusUpdateLatest + ' (v' + CURRENT_VERSION + ')'
        : updateState.value === 'failed'
          ? t().statusUpdateFailed
          : t().btnCheckUpdateNow,
);
let resetTimer;
// 检查和结果展示期间均锁定入口，提示结束后同时恢复文案与可点击状态。
async function manualUpdate() {
  if (updateState.value) return;
  clearTimeout(resetTimer);
  updateState.value = 'checking';
  try {
    const result = await checkScriptUpdate(true);
    updateState.value = result?.hasUpdate
      ? ''
      : result?.success
        ? result.isPreview
          ? 'preview'
          : 'latest'
        : 'failed';
  } catch {
    updateState.value = 'failed';
  }
  clearTimeout(resetTimer);
  resetTimer = setTimeout(() => {
    updateState.value = '';
  }, 2500);
}
// 重新启用自动检查时清除原有冷却。
function autoCheckChanged() {
  if (!appSettings.general.disableUpdateCheck) resetUpdateCooldown();
  saveSettings();
}
// 插件字体大小恢复成默认值。
function resetFontSize() {
  appSettings.general.fontSize = FONT_SIZE.base;
  saveSettings();
}
onBeforeUnmount(() => clearTimeout(resetTimer));
</script>
<template>
  <div class="cf-tab-panel">
    <div class="cf-setting-item">
      <span class="cf-setting-label" v-text="t().langLabel"></span
      ><segmented-switch
        style="width: 140px"
        :model-value="appSettings.general.lang"
        @update:model-value="changeLanguage"
        :options="languageOptions"
      ></segmented-switch>
    </div>
    <MenuPositionSettings />
    <MenuSizeSettings />
    <div class="cf-setting-item cf-font-size-row">
      <label class="cf-setting-label" for="cf-general-control-font-size">{{
        t('fontSizeLabel')
      }}</label>
      <div class="cf-font-size-actions">
        <ActionButton
          :disabled="appSettings.general.fontSize === FONT_SIZE.base"
          data-control="fontSizeReset"
          @click="resetFontSize"
          ><InlineSvg :source="resetIcon" /><span>{{
            t('menuLayoutResetAction')
          }}</span></ActionButton
        >
        <NumberInput
          v-model="appSettings.general.fontSize"
          class="cf-font-size-input"
          clamp
          live
          :min="FONT_SIZE.min"
          :max="FONT_SIZE.max"
          input-id="cf-general-control-font-size"
          data-control="fontSizeInput"
          @change="saveSettings()"
        />
      </div>
    </div>
    <div
      class="cf-setting-item"
      style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        user-select: none;
        margin: 0px;
      "
      @click="toggleFromRow"
    >
      <span class="cf-setting-label" v-text="t().locAutoCheckUpdate"></span>
      <div style="display: inline-flex; align-items: center; gap: 10px">
        <ActionButton
          class="cf-update-check-btn"
          :status="updateState"
          :busy="updateState === 'checking'"
          :disabled="Boolean(updateState)"
          @click.stop.prevent="manualUpdate"
          ><InlineSvg :source="syncIcon" /><span>{{ updateLabel }}</span></ActionButton
        ><toggle-switch
          as="label"
          style="margin: 0px; cursor: pointer"
          v-model="appSettings.general.disableUpdateCheck"
          input-class="cf-toggle-auto-check"
          data-control="cbAutoCheckUpdate"
          @change="autoCheckChanged"
        ></toggle-switch>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 插件字体大小一行：右边是恢复默认和数字输入框，间隔同别的几行（按钮和开关隔 10px）。 */
.cf-font-size-row {
  gap: 10px;
}
.cf-font-size-actions {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 10px;
}
/* 输入框和开关一样宽（34px），这一页四个按钮的右边缘就对齐成一列；框里只有两位数，居中。 */
.cf-font-size-input {
  width: 34px;
  padding: 3px 2px;
  text-align: center;
}
</style>
