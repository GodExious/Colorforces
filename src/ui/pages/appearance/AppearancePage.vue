<script setup>
import ExpandTransition from '../../components/transitions/ExpandTransition/ExpandTransition.vue';
import { computed, ref, watch } from 'vue';
import { appSettings, saveSettings } from '../../../settings.js';
import { tooltip } from '../../components/tooltips/FloatingTooltip/FloatingTooltip.vue';
import { translate as t } from '../../../i18n/index.js';
import { customFormatTime } from '../../../utils/time.js';
import ColorPicker from './components/ColorPicker/ColorPicker.vue';
import TagVisibilitySettings from './components/TagVisibilitySettings/TagVisibilitySettings.vue';
import { openTimeFormatGuide } from './components/TimeFormatGuide/TimeFormatGuide.vue';
import { openVerdictGuide } from './components/VerdictGuide/VerdictGuide.vue';
import ToggleSwitch from '../../components/forms/ToggleSwitch/ToggleSwitch.vue';
import InfoHint from '../../components/tooltips/InfoHint/InfoHint.vue';
import { toggleFromRow } from '../../../utils/row-toggle.js';
// 打开外观页面专用指南。
function openGuide(kind, event) {
  tooltip.hide();
  if (kind === 'time') openTimeFormatGuide(event.currentTarget);
  else openVerdictGuide(event.currentTarget);
}
const previewDate = ref(new Date());
watch(
  () => [appSettings.timeFormat.enabled, appSettings.timeFormat.format, appSettings.lang],
  () => (previewDate.value = new Date()),
);
const timePreview = computed(() =>
  appSettings.timeFormat.enabled
    ? t().timeFormatPreview +
      customFormatTime(previewDate.value, appSettings.timeFormat.format || 'YYYY/MM/DD HH:mm')
    : t().timeFormatDisabled,
);
</script>
<template>
  <div class="cf-tab-panel">
    <TagVisibilitySettings />
    <label class="cf-setting-item" style="cursor: pointer; user-select: none; margin: 0px"
      ><span class="cf-setting-label" v-text="t('locAcHighlight')"></span
      ><toggle-switch
        as="div"
        v-model="appSettings.show.acHighlight"
        data-control="cbAcHighlight"
        @change="saveSettings()"
      ></toggle-switch
    ></label>
    <ExpandTransition :show="appSettings.show.acHighlight"
      ><div class="cf-setting-item cf-row-ac-color" style="padding-left: 12px">
        <span class="cf-setting-sublabel" v-text="t().acColor"></span>
        <!-- 禁用时一并移除挂在 body 的颜色弹层，避免收起后仍可修改。 -->
        <color-picker v-if="appSettings.show.acHighlight"></color-picker></div
    ></ExpandTransition>
    <label class="cf-setting-item" style="cursor: pointer; user-select: none; margin: 0px"
      ><span class="cf-setting-label" v-text="t().locLangIcon"></span
      ><toggle-switch
        as="div"
        v-model="appSettings.show.langIcon"
        input-class="cf-toggle-lang-icon"
        data-control="cbLangIcon"
        @change="saveSettings()"
      ></toggle-switch
    ></label>
    <ExpandTransition :show="appSettings.show.langIcon"
      ><div class="cf-setting-item cf-row-lang-icon-size" style="padding-left: 12px">
        <span class="cf-setting-sublabel" v-text="t().locLangIconSize"></span>
        <div style="display: flex; align-items: center; gap: 5px">
          <input
            type="range"
            min="0.8"
            max="3.0"
            step="0.1"
            style="width: 100px; cursor: pointer"
            v-model.number="appSettings.langIconSize"
            v-on:input="saveSettings()"
            data-control="langIconSizeInput"
          /><span
            style="
              font-size: var(--cf-font-size-base);
              width: 28px;
              text-align: right;
              display: inline-block;
              color: rgb(100, 116, 139);
              font-weight: var(--cf-font-weight-medium);
            "
            v-text="parseFloat(appSettings.langIconSize).toFixed(1) + 'x'"
          ></span>
        </div></div
    ></ExpandTransition>
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
      <div style="display: flex; align-items: center; margin: 0px">
        <span class="cf-setting-label" v-text="t().locShortVerdict"></span
        ><InfoHint
          :text="t('verdictHelpTooltip')"
          variant="question"
          :clickable="true"
          @click="openGuide('verdict', $event)"
        />
      </div>
      <toggle-switch
        as="div"
        style="margin: 0px"
        v-model="appSettings.show.shortVerdict"
        input-class="cf-toggle-short-verdict"
        data-control="cbShortVerdict"
        @change="saveSettings()"
      ></toggle-switch>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px">
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
        <div style="display: flex; align-items: center; margin: 0px">
          <span class="cf-setting-label" v-text="t().timeFormatTitle"></span
          ><InfoHint
            :text="t('timeFormatHelpTooltip')"
            variant="question"
            :clickable="true"
            @click="openGuide('time', $event)"
          />
        </div>
        <toggle-switch
          as="div"
          style="margin: 0px"
          v-model="appSettings.timeFormat.enabled"
          input-class="cf-toggle-time-format"
          data-control="timeToggle"
          @change="saveSettings()"
        ></toggle-switch>
      </div>
      <input
        type="text"
        placeholder="YYYY/MM/DD HH:mm"
        style="
          width: 100%;
          padding: 6px 10px;
          border-radius: var(--cf-radius-sm);
          font-size: var(--cf-font-size-lg);
          box-sizing: border-box;
          outline: none;
          font-family: inherit;
        "
        v-model="appSettings.timeFormat.format"
        v-on:input="saveSettings()"
        v-bind:disabled="!appSettings.timeFormat.enabled"
        v-bind:style="{ opacity: appSettings.timeFormat.enabled ? '1' : '0.5' }"
        data-control="timeInput"
      />
      <div
        style="
          font-size: var(--cf-font-size-base);
          color: rgb(100, 116, 139);
          font-family: inherit;
          text-align: right;
        "
        v-text="timePreview"
      ></div>
    </div>
  </div>
</template>
