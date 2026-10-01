<script setup>
import { computed, ref, inject, onBeforeUnmount } from 'vue';
import { appSettings, saveSettings, setSetting as choose } from '../../../settings.js';
import { translate as t } from '../../../i18n/index.js';
import { languages } from '../../../i18n/languages.js';
import { CURRENT_VERSION } from '../../../config/runtime.js';
import { checkScriptUpdate, resetUpdateCooldown } from '../../../features/general/updates.js';
import ToggleSwitch from '../../components/forms/ToggleSwitch/ToggleSwitch.vue';
import SegmentedSwitch from '../../components/forms/SegmentedSwitch/SegmentedSwitch.vue';
import ActionButton from '../../components/forms/ActionButton/ActionButton.vue';
import InlineSvg from '../../components/icons/InlineSvg/InlineSvg.vue';
import { syncIcon } from '../../../assets/index.js';
import { toggleFromRow } from '../../../utils/row-toggle.js';
import MenuSizeSettings from './components/MenuSizeSettings/MenuSizeSettings.vue';
import MenuPositionSettings from './components/MenuPositionSettings/MenuPositionSettings.vue';
const updateState = ref('');
const changeLanguage = inject('cf-change-language', (value) => choose('lang', value));
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
  if (!appSettings.disableAutoCheckUpdate) resetUpdateCooldown();
  saveSettings();
}
onBeforeUnmount(() => clearTimeout(resetTimer));
</script>
<template>
  <div class="cf-tab-panel">
    <div class="cf-setting-item">
      <span class="cf-setting-label" data-cf-language-text v-text="t().langLabel"></span
      ><segmented-switch
        style="width: 140px"
        :model-value="appSettings.lang"
        @update:model-value="changeLanguage"
        :options="languageOptions"
      ></segmented-switch>
    </div>
    <MenuPositionSettings />
    <MenuSizeSettings />
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
      <span class="cf-setting-label" data-cf-language-text v-text="t().locAutoCheckUpdate"></span>
      <div style="display: inline-flex; align-items: center; gap: 10px">
        <ActionButton
          class="cf-update-check-btn"
          :status="updateState"
          :busy="updateState === 'checking'"
          :disabled="Boolean(updateState)"
          @click.stop.prevent="manualUpdate"
          ><InlineSvg :source="syncIcon" /><span data-cf-language-text>{{
            updateLabel
          }}</span></ActionButton
        ><toggle-switch
          as="label"
          style="margin: 0px; cursor: pointer"
          v-model="appSettings.disableAutoCheckUpdate"
          input-class="cf-toggle-auto-check"
          data-control="cbAutoCheckUpdate"
          @change="autoCheckChanged"
        ></toggle-switch>
      </div>
    </div>
  </div>
</template>
