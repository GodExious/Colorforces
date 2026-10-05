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
import { watch } from 'vue';
import DialogTransition from '../../../../components/transitions/DialogTransition/DialogTransition.vue';
import { appSettings, saveSettings } from '../../../../../settings.js';
import { translate as t } from '../../../../../i18n/index.js';
import { CURRENT_VERSION } from '../../../../../config/runtime.js';
import { resetUpdateCooldown } from '../../../../../features/general/updates.js';
const displayedVersion = ref(remoteVersion.value);
// 关闭时保留检测到的版本，直到退出过渡完成。
watch(
  remoteVersion,
  (value) => {
    if (value) displayedVersion.value = value;
  },
  { flush: 'sync' },
);
// 重新开启自动检查时清除旧冷却时间。
function autoCheckChanged() {
  saveSettings();
  if (!appSettings.general.disableUpdateCheck) resetUpdateCooldown();
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
      ><div id="cf-update-modal-overlay" class="cf-aurora-dialog" v-if="remoteVersion">
        <div class="cf-update-card cf-aurora-card">
          <div class="cf-update-title" v-text="t('updateModalTitle')"></div>
          <div class="cf-update-desc">
            <div v-html="t('updateModalDesc', displayedVersion, CURRENT_VERSION)"></div>
            <div class="cf-update-subdesc" v-text="t('updateModalSubDesc')"></div>
          </div>
          <label class="cf-update-stop">
            <input
              type="checkbox"
              id="cf-update-stop-cb"
              v-model="appSettings.general.disableUpdateCheck"
              v-on:change="autoCheckChanged"
            />
            <span v-text="t('updateModalStopCheck')"></span>
          </label>
          <div class="cf-update-actions">
            <button
              type="button"
              id="cf-update-btn-later"
              class="cf-aurora-btn"
              v-text="t('updateModalBtnLater')"
              v-on:click="remoteVersion = null"
            ></button>
            <a
              id="cf-update-btn-update"
              class="cf-aurora-btn cf-aurora-btn--primary"
              v-bind:href="downloadUrl"
              target="_blank"
              rel="noopener noreferrer"
              v-text="t('updateModalBtnUpdate')"
              v-on:click="installUpdate"
            ></a>
          </div>
        </div></div></DialogTransition
  ></Teleport>
</template>

<style>
/* 更新提示：外观来自幻彩主题，与其他弹窗一致，不再单独区分深浅色页面。 */
#cf-update-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.cf-update-card {
  box-sizing: border-box;
  width: 420px;
  max-width: 90vw;
  padding: 26px 26px 22px;
}

.cf-update-title {
  margin-bottom: 14px;
  color: #3b4868;
  font-size: 19px;
  font-weight: var(--cf-font-weight-bold);
  line-height: 1.3;
}

.cf-update-desc {
  margin-bottom: 18px;
  color: var(--cf-aurora-text);
  font-size: 13.5px;
  line-height: 1.65;
}

.cf-update-version {
  padding: 1px 8px;
  border: 1px solid var(--cf-aurora-glass-border);
  border-radius: 999px;
  background: #ffffff99;
  color: #5565b0;
  font-weight: var(--cf-font-weight-bold);
  font-variant-numeric: tabular-nums;
}

.cf-update-subdesc {
  margin-top: 8px;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-md);
}

.cf-update-stop {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-md);
  cursor: pointer;
  user-select: none;
}

.cf-update-stop input {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: var(--cf-menu-accent);
  cursor: pointer;
}

.cf-update-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cf-update-actions .cf-aurora-btn {
  padding-top: 8px;
  padding-bottom: 8px;
  font-size: var(--cf-font-size-lg);
}
</style>
