<script>
import * as cfAssets from '../../../../assets/index.js';
import { shallowRef } from 'vue';
import { appSettings } from '../../../../settings.js';
import { tGlobal as t } from '../../../../i18n/index.js';
const pending = shallowRef(null);
// 打开原版确认提示，新的提示替换旧提示。
export function showConfirmPop(options) {
  pending.value = options;
}
// 按原有提示类型生成颜色、文案和按钮组合。
function buildAppearance({
  title = '',
  message = '',
  note = '',
  confirmText = '',
  cancelText = '',
  type = 'danger',
  lang = (typeof appSettings !== 'undefined' && appSettings && appSettings.lang) || 'zh',
  onConfirm = null,
} = {}) {
  const isInfo = type === 'info';
  const isWarning = type === 'warning';
  const isAlertOnly = isInfo || typeof onConfirm !== 'function';

  let iconSvg = '';
  let iconBg = '#fee2e2';
  let iconColor = '#ef4444';
  let confirmBtnBg = '#e11d48';
  let confirmBtnBorder = '#e11d48';
  let defaultConfirmText = t('popConfirmBtn', lang);

  if (isWarning) {
    iconBg = '#fef3c7';
    iconColor = '#d97706';
    confirmBtnBg = '#d97706';
    confirmBtnBorder = '#d97706';
    iconSvg = `${cfAssets.dialogWarningIcon}`;
  } else if (isInfo) {
    iconBg = '#e0f2fe';
    iconColor = '#0284c7';
    confirmBtnBg = '#0284c7';
    confirmBtnBorder = '#0284c7';
    iconSvg = `${cfAssets.dialogInfoIcon}`;
  } else {
    iconSvg = `${cfAssets.dialogDeleteIcon}`;
  }

  let mainMsg = message || '';
  let subNote = note || '';
  if (!subNote && mainMsg.includes('\n\n')) {
    const parts = mainMsg.split('\n\n');
    mainMsg = parts[0];
    subNote = parts.slice(1).join('\n\n');
  }

  const noteBg = isWarning ? '#fffbeb' : isInfo ? '#f0f9ff' : '#fff1f2';
  const noteBorder = isWarning ? '#fde68a' : isInfo ? '#bae6fd' : '#fecdd3';
  const noteColor = isWarning ? '#b45309' : isInfo ? '#0369a1' : '#9f1239';

  return {
    isAlertOnly,
    iconSvg,
    subNote,
    mainHtml: mainMsg.split(String.fromCharCode(10)).join('<br>'),
    noteHtml: subNote.split(String.fromCharCode(10)).join('<br>'),
    confirmLabel: confirmText || (isAlertOnly ? t('popGotItBtn', lang) : defaultConfirmText),
    cancelLabel: cancelText || t('popCancelBtn', lang),
    iconStyle: { background: iconBg, color: iconColor },
    noteStyle: { background: noteBg, borderColor: noteBorder, color: noteColor },
    buttonStyle: {
      background: confirmBtnBg,
      borderColor: confirmBtnBorder,
      padding: isAlertOnly ? '6px 18px' : '6px 16px',
    },
  };
}
</script>
<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import InlineSvg from '../../icons/InlineSvg/InlineSvg.vue';
import DialogTransition from '../../transitions/DialogTransition/DialogTransition.vue';
import { preventScrollChaining } from '../../../../utils/scroll.js';
const overlay = ref(null);
// 离场保留最后一份文案，避免按钮与说明在关闭帧重新排版。
const displayed = shallowRef(pending.value);
watch(
  pending,
  (value) => {
    if (value) displayed.value = value;
  },
  { flush: 'sync' },
);
const appearance = computed(() => buildAppearance(displayed.value || {}));
// 关闭提示，不执行取消的操作。
function close() {
  pending.value = null;
}
// 先关闭弹窗，再运行用户确认的动作。
function confirm() {
  const callback = pending.value?.onConfirm;
  close();
  callback?.();
}
// Escape 仅关闭当前提示。
function keydown(event) {
  if (pending.value && event.key === 'Escape') close();
}
watch(overlay, (node) => {
  if (node) preventScrollChaining(node);
});
onMounted(() => window.addEventListener('keydown', keydown));
onBeforeUnmount(() => window.removeEventListener('keydown', keydown));
</script>
<template>
  <Teleport to="body"
    ><DialogTransition
      ><div class="cf-confirm-pop-overlay" v-if="pending" ref="overlay" v-on:click.self="close">
        <div class="cf-confirm-pop-card">
          <div
            style="display: flex; gap: 14px; align-items: flex-start; padding: 18px 20px 14px 20px"
          >
            <div
              style="
                width: 40px;
                height: 40px;
                border-radius: 10px;
                background: #fee2e2;
                color: #ef4444;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
              "
              v-bind:style="appearance.iconStyle"
            >
              <inline-svg v-bind:source="appearance.iconSvg"></inline-svg>
            </div>
            <div style="flex: 1; min-width: 0">
              <div
                style="
                  font-size: 14.5px;
                  font-weight: 700;
                  color: #0f172a;
                  margin-bottom: 5px;
                  line-height: 1.3;
                "
                v-text="displayed.title"
              ></div>
              <div
                style="font-size: 12.5px; color: #475569; line-height: 1.5; word-break: break-word"
                v-html="appearance.mainHtml"
              ></div>

              <div
                style="
                  background: #fff1f2;
                  border: 1px solid #fecdd3;
                  border-radius: 6px;
                  padding: 7px 10px;
                  font-size: 11.5px;
                  color: #9f1239;
                  line-height: 1.45;
                  margin-top: 10px;
                "
                v-html="appearance.noteHtml"
                v-if="appearance.subNote"
                v-bind:style="appearance.noteStyle"
              ></div>
            </div>
          </div>
          <div
            style="
              padding: 10px 18px;
              background: #f8fafc;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: flex-end;
              align-items: center;
              border-radius: 0 0 12px 12px;
            "
          >
            <button
              type="button"
              class="cf-confirm-btn-cancel"
              style="
                background: #fff;
                color: #475569;
                border: 1px solid #cbd5e1;
                padding: 6px 14px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                margin-right: 8px;
                transition: all 0.15s ease;
              "
              v-text="appearance.cancelLabel"
              v-if="!appearance.isAlertOnly"
              v-on:click="close"
            ></button>
            <button
              type="button"
              class="cf-confirm-btn-primary"
              style="
                background: #e11d48;
                color: #fff;
                border: 1px solid #e11d48;
                padding: 6px 16px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s ease;
              "
              v-text="appearance.confirmLabel"
              v-on:click="confirm"
              v-bind:style="appearance.buttonStyle"
            ></button>
          </div>
        </div></div></DialogTransition
  ></Teleport>
</template>

<style>
.cf-confirm-pop-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.48);
  backdrop-filter: blur(4px);
  z-index: 10000005;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
  overscroll-behavior: contain;
}

.cf-confirm-pop-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.15),
    0 8px 10px -6px rgba(0, 0, 0, 0.1);
  width: 420px;
  max-width: 92vw;
  overflow: hidden;
  box-sizing: border-box;
  overscroll-behavior: contain;
}

.cf-confirm-btn-cancel:hover {
  background: #f1f5f9 !important;
  border-color: #94a3b8 !important;
  color: #0f172a !important;
}

.cf-confirm-btn-primary:hover {
  filter: brightness(0.92);
}
</style>
