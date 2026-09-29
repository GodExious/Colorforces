<script>
import { ref } from 'vue';
import { SCRIPT_UPDATE_URL } from '../../../../../config/release.js';
const remoteVersion = ref(null);
const downloadUrl = ref(SCRIPT_UPDATE_URL);
// 显示新版本提示，并保留本次检测成功的安装地址。
export function showUpdateModal(version, url = SCRIPT_UPDATE_URL) {
  downloadUrl.value = url;
  remoteVersion.value = version;
}
</script>
<script setup>
import { computed, watch } from 'vue';
import DialogTransition from '../../../../components/transitions/DialogTransition/DialogTransition.vue';
import { appSettings, saveSettings } from '../../../../../settings.js';
import { translate as t } from '../../../../../i18n/index.js';
import { CURRENT_VERSION } from '../../../../../config/runtime.js';
import { resetUpdateCooldown } from '../../../../../features/general/updates.js';
import { isDarkTheme } from '../../../../../features/page/theme.js';
const dark = computed(() => {
  remoteVersion.value;
  return isDarkTheme();
});
const displayedVersion = ref(remoteVersion.value);
// 关闭时保留检测到的版本，直到退出过渡完成。
watch(
  remoteVersion,
  (value) => {
    if (value) displayedVersion.value = value;
  },
  { flush: 'sync' },
);
const laterHover = ref(false),
  updateHover = ref(false);
const cardStyle = computed(() => ({
  background: dark.value ? '#1e2022' : '#ffffff',
  color: dark.value ? '#e0e0e0' : '#222222',
  borderColor: dark.value ? '#333b42' : '#e2e8f0',
}));
const titleStyle = computed(() => ({ color: dark.value ? '#f8fafc' : '#0f172a' }));
const descriptionStyle = computed(() => ({ color: dark.value ? '#cbd5e1' : '#475569' }));
const mutedStyle = computed(() => ({ color: dark.value ? '#94a3b8' : '#64748b' }));
const laterStyle = computed(() => ({
  background: dark.value
    ? laterHover.value
      ? '#3d444d'
      : '#2d333b'
    : laterHover.value
      ? '#e2e8f0'
      : '#f1f5f9',
  color: dark.value ? '#cbd5e1' : '#475569',
  borderColor: dark.value ? '#3d444d' : '#e2e8f0',
}));
const updateStyle = computed(() => ({ background: updateHover.value ? '#40a9ff' : '#1890ff' }));
// 重新开启自动检查时清除旧冷却时间。
function autoCheckChanged() {
  saveSettings();
  if (!appSettings.disableAutoCheckUpdate) resetUpdateCooldown();
}
// 普通点击后关闭提示；新标签跳转交给链接，保留中键和修饰键行为。
function installUpdate(event) {
  if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey)
    remoteVersion.value = null;
}
</script>
<template>
  <Teleport to="body"
    ><DialogTransition
      ><div
        id="cf-update-modal-overlay"
        style="
          position: fixed;
          inset: 0px;
          background: rgba(0, 0, 0, 0.55);
          z-index: 99999999;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(4px);
          font-family:
            -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
            sans-serif;
        "
        v-if="remoteVersion"
      >
        <div
          style="
            background: rgb(30, 32, 34);
            color: rgb(224, 224, 224);
            padding: 26px 28px;
            border-radius: 14px;
            width: 420px;
            max-width: 90vw;
            box-shadow: rgba(0, 0, 0, 0.35) 0px 16px 40px;
            border: 1px solid rgb(51, 59, 66);
          "
          v-bind:style="cardStyle"
        >
          <div style="margin-bottom: 16px">
            <div
              style="
                font-size: 19px;
                font-weight: 800;
                color: #f8fafc;
                display: flex;
                align-items: center;
                gap: 8px;
              "
              v-text="t('updateModalTitle')"
              v-bind:style="titleStyle"
            ></div>
          </div>
          <div
            style="font-size: 13.5px; line-height: 1.65; color: #cbd5e1; margin-bottom: 20px"
            v-bind:style="descriptionStyle"
          >
            <div
              style="margin-bottom: 8px"
              v-html="t('updateModalDesc', displayedVersion, CURRENT_VERSION)"
            ></div>
            <div
              style="font-size: 12.5px; color: #94a3b8"
              v-text="t('updateModalSubDesc')"
              v-bind:style="mutedStyle"
            ></div>
          </div>
          <div style="margin-bottom: 20px">
            <label
              style="
                display: inline-flex;
                align-items: center;
                gap: 8px;
                font-size: 12.5px;
                cursor: pointer;
                user-select: none;
                color: #94a3b8;
              "
              v-bind:style="mutedStyle"
            >
              <input
                type="checkbox"
                id="cf-update-stop-cb"
                style="cursor: pointer; accent-color: #1890ff; width: 15px; height: 15px; margin: 0"
                v-model="appSettings.disableAutoCheckUpdate"
                v-on:change="autoCheckChanged"
              />
              <span v-text="t('updateModalStopCheck')"></span>
            </label>
          </div>
          <div style="display: flex; gap: 10px; justify-content: flex-end">
            <button
              id="cf-update-btn-later"
              style="
                background: #2d333b;
                color: #cbd5e1;
                border: 1px solid #3d444d;
                padding: 8px 18px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
              "
              v-text="t('updateModalBtnLater')"
              v-on:click="remoteVersion = null"
              v-bind:style="laterStyle"
              v-on:mouseenter="laterHover = true"
              v-on:mouseleave="laterHover = false"
            ></button>
            <a
              id="cf-update-btn-update"
              v-bind:href="downloadUrl"
              target="_blank"
              rel="noopener noreferrer"
              style="
                display: inline-flex;
                align-items: center;
                text-decoration: none;
                line-height: normal;
                background: #1890ff;
                color: #ffffff;
                border: none;
                padding: 8px 20px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.2s;
                box-shadow: 0 2px 6px rgba(24, 144, 255, 0.35);
              "
              v-text="t('updateModalBtnUpdate')"
              v-on:click="installUpdate"
              v-bind:style="updateStyle"
              v-on:mouseenter="updateHover = true"
              v-on:mouseleave="updateHover = false"
            ></a>
          </div>
        </div></div></DialogTransition
  ></Teleport>
</template>
