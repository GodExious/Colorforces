<script>
import * as cfAssets from '../../../../assets/index.js';
import { shallowRef } from 'vue';
import { appSettings } from '../../../../settings.js';
import { tGlobal as t } from '../../../../i18n/index.js';
const pending = shallowRef(null);
// 打开确认提示，新的提示替换旧提示。
// 标题、正文、补充说明、按钮文字可以直接给文字，也可以给一个返回文字的函数。
// 给函数的话每次显示时现取：提示开着的时候换了语言，文字跟着换（带着和别的弹窗一样的过渡）。
export function showConfirmPop(options) {
  pending.value = options;
}
const read = (value) => (typeof value === 'function' ? value() : value) || '';
// 按提示类型决定图标、语气和按钮组合；配色由样式按语气处理。
function buildAppearance(options = {}) {
  const {
    type = 'danger',
    lang = (typeof appSettings !== 'undefined' && appSettings && appSettings.general.lang) || 'zh',
    onConfirm = null,
  } = options;
  const message = read(options.message);
  const note = read(options.note);
  const confirmText = read(options.confirmText);
  const cancelText = read(options.cancelText);
  const tone = type === 'info' || type === 'warning' ? type : 'danger';
  const isAlertOnly = tone === 'info' || typeof onConfirm !== 'function';
  const icons = {
    danger: cfAssets.dialogDeleteIcon,
    warning: cfAssets.dialogWarningIcon,
    info: cfAssets.dialogInfoIcon,
  };

  let mainMsg = message || '';
  let subNote = note || '';
  if (!subNote && mainMsg.includes('\n\n')) {
    const parts = mainMsg.split('\n\n');
    mainMsg = parts[0];
    subNote = parts.slice(1).join('\n\n');
  }

  return {
    title: read(options.title),
    tone,
    isAlertOnly,
    iconSvg: icons[tone],
    subNote,
    mainHtml: mainMsg.split(String.fromCharCode(10)).join('<br>'),
    noteHtml: subNote.split(String.fromCharCode(10)).join('<br>'),
    confirmLabel: confirmText || t(isAlertOnly ? 'popGotItBtn' : 'popConfirmBtn', lang),
    cancelLabel: cancelText || t('popCancelBtn', lang),
  };
}
</script>
<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import InlineSvg from '../../icons/InlineSvg/InlineSvg.vue';
import DialogTransition from '../../transitions/DialogTransition/DialogTransition.vue';
import { preventScrollChaining } from '../../../../utils/scroll.js';
import { backdropClose } from '../../../../utils/backdrop.js';
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
// 点遮罩关闭；在弹窗里按下、拖到弹窗外才松开不算。
const backdrop = backdropClose(close);
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
      ><div
        class="cf-confirm-pop-overlay cf-aurora-dialog"
        v-if="pending"
        ref="overlay"
        v-on="backdrop"
      >
        <div class="cf-confirm-pop-card cf-aurora-card" :data-tone="appearance.tone">
          <div class="cf-confirm-main">
            <div class="cf-confirm-icon cf-aurora-emblem">
              <inline-svg v-bind:source="appearance.iconSvg"></inline-svg>
            </div>
            <div class="cf-confirm-text">
              <div class="cf-confirm-title" v-text="appearance.title"></div>
              <div class="cf-confirm-message" v-html="appearance.mainHtml"></div>
              <div
                class="cf-confirm-note"
                v-html="appearance.noteHtml"
                v-if="appearance.subNote"
              ></div>
            </div>
          </div>
          <div class="cf-confirm-actions">
            <button
              type="button"
              class="cf-aurora-btn cf-confirm-btn-cancel"
              v-text="appearance.cancelLabel"
              v-if="!appearance.isAlertOnly"
              v-on:click="close"
            ></button>
            <button
              type="button"
              class="cf-aurora-btn cf-aurora-btn--primary cf-confirm-btn-primary"
              :data-tone="appearance.tone"
              v-text="appearance.confirmLabel"
              v-on:click="confirm"
            ></button>
          </div>
        </div></div></DialogTransition
  ></Teleport>
</template>

<style>
/* 确认提示：外观来自幻彩主题；危险、警告、提示三种语气只改图标底板、备注和主按钮的颜色。 */
.cf-confirm-pop-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 10000005;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
  overscroll-behavior: contain;
}

.cf-confirm-pop-card {
  --cf-confirm-tone: #d6587c;
  --cf-confirm-tint: #fbe6ec;
  /* 宽度跟着内容走：短的提示不会被固定的宽度挤成两行、最后剩几个字单独一行；
     内容多的到上限再折行，太短的也不比原来窄多少。 */
  width: max-content;
  min-width: min(360px, 92vw);
  max-width: min(560px, 92vw);
  overflow: hidden;
  box-sizing: border-box;
  overscroll-behavior: contain;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
}

.cf-confirm-pop-card[data-tone='warning'] {
  --cf-confirm-tone: #c98524;
  --cf-confirm-tint: #fcefd9;
}

.cf-confirm-pop-card[data-tone='info'] {
  --cf-confirm-tone: #6475c4;
  --cf-confirm-tint: #e6eafc;
}

.cf-confirm-main {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 22px 22px 16px;
}

/* 图标底块跟着语气换颜色：红、黄、蓝。 */
.cf-confirm-pop-card .cf-confirm-icon {
  --cf-emblem-petal: var(--cf-confirm-tone);
  width: 42px;
  height: 42px;
}

.cf-confirm-icon svg {
  width: 26px;
  height: 26px;
}

.cf-confirm-text {
  flex: 1;
  min-width: 0;
}

.cf-confirm-title {
  margin-bottom: 5px;
  color: #3b4868;
  font-size: calc(15px * var(--cf-font-scale));
  font-weight: var(--cf-font-weight-bold);
  line-height: 1.35;
}

.cf-confirm-message {
  color: var(--cf-aurora-text);
  font-size: var(--cf-font-size-lg);
  line-height: 1.55;
  word-break: break-word;
  text-wrap: pretty;
}

.cf-confirm-note {
  margin-top: 11px;
  padding: 8px 11px;
  border: 1px solid color-mix(in srgb, var(--cf-confirm-tone) 26%, #ffffff);
  border-radius: var(--cf-radius-lg);
  background: color-mix(in srgb, var(--cf-confirm-tint) 78%, transparent);
  color: color-mix(in srgb, var(--cf-confirm-tone) 82%, #2b3550);
  font-size: var(--cf-font-size-base);
  line-height: 1.5;
  /* 非折行不可时，尽量不让最后一行只剩一两个字。 */
  text-wrap: pretty;
}

.cf-confirm-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 22px 18px;
  border-top: 1px solid #d3dbec99;
}
</style>
