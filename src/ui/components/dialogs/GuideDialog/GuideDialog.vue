<script setup>
import ActionButton from '../../forms/ActionButton/ActionButton.vue';
import DialogTransition from '../../transitions/DialogTransition/DialogTransition.vue';
import { computed, ref, watch } from 'vue';
import { preventScrollChaining } from '../../../../utils/scroll.js';
import { backdropClose } from '../../../../utils/backdrop.js';
import InlineSvg from '../../icons/InlineSvg/InlineSvg.vue';
const props = defineProps({
  options: { type: Object, required: true },
  visible: Boolean,
  origin: Object,
});
const emit = defineEmits(['close']);
const overlay = ref(null);
// 点遮罩关闭；在弹窗里按下、拖到弹窗外才松开（如拖选文字）不算。
const backdrop = backdropClose(() => emit('close'));
const classes = computed(() => [
  'cf-clist-modal-overlay',
  'cf-aurora-dialog',
  'cf-guide-theme',
  props.options.className,
]);
const cardStyle = computed(() => ({
  width: props.options.width || '580px',
  maxWidth: props.options.maxWidth || '92vw',
}));
watch(overlay, (node) => {
  if (node) preventScrollChaining(node);
});
</script>
<template>
  <Teleport to="body">
    <DialogTransition :origin="origin"
      ><div v-if="visible" ref="overlay" :class="classes" v-on="backdrop">
        <div class="cf-clist-modal-card cf-aurora-card" :style="cardStyle">
          <div class="cf-clist-modal-header">
            <div class="cf-clist-modal-title">
              <span class="cf-modal-title-icon cf-aurora-emblem"
                ><InlineSvg :source="options.iconSvg" /></span
              ><span>{{ options.title }}</span>
            </div>
            <button
              type="button"
              class="cf-modal-close-btn cf-aurora-close"
              @click="$emit(`close`)"
            >
              &times;
            </button>
          </div>
          <!-- 新的说明内容用插槽写成正常模板；尚未改写的仍传入拼好的 HTML。 -->
          <div v-if="$slots.default" class="cf-clist-modal-body"><slot /></div>
          <div v-else class="cf-clist-modal-body" v-html="options.bodyHtml"></div>
          <div class="cf-clist-modal-footer">
            <ActionButton
              type="button"
              class="cf-clist-sync-btn cf-modal-primary-btn"
              @click="$emit(`close`)"
            >
              {{ options.confirmText }}
            </ActionButton>
          </div>
        </div>
      </div>
    </DialogTransition></Teleport
  >
</template>

<style>
/*
 * 说明、同步进度、数据查看、身份说明等弹窗共用的外壳。
 * 这里只管布局；配色、圆角与阴影来自 styles/aurora-dialog.css 的幻彩主题。
 */
.cf-clist-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000002;
  display: flex;
  align-items: center;
  justify-content: center;
  overscroll-behavior: contain;
}

.cf-clist-modal-card {
  width: 580px;
  max-width: 92vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  overscroll-behavior: contain;
}

.cf-clist-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 14px 22px;
  border-bottom: 1px solid #d3dbec99;
}

.cf-clist-modal-title {
  font-size: 16px;
  font-weight: var(--cf-font-weight-semibold);
  letter-spacing: 0.01em;
  color: #3b4868;
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

.cf-modal-title-icon {
  width: 32px;
  height: 32px;
  border-radius: 11px;
}

.cf-modal-title-icon svg {
  width: 17px;
  height: 17px;
}

.cf-clist-modal-body {
  padding: 18px 22px 20px;
  overflow-y: auto;
  font-size: var(--cf-font-size-lg);
  line-height: 1.6;
  color: var(--cf-aurora-text, var(--cf-gray-700));
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #c3cce2 transparent;
}

.cf-clist-modal-footer {
  padding: 12px 22px 18px;
  border-top: 1px solid #d3dbec99;
  display: flex;
  justify-content: flex-end;
}

/* 弹窗的主操作：蓝紫渐变实心按钮，与卡片里浅色的次要按钮区分主次。 */
.cf-action-button.cf-modal-primary-btn,
.cf-action-button.cf-modal-primary-btn:not(:disabled):hover {
  padding: 7px 20px;
  border-color: #8590cf;
  border-radius: var(--cf-radius-lg);
  background: linear-gradient(135deg, #8b9ddd, #9c8fd6);
  color: #fff;
  font-weight: var(--cf-font-weight-semibold);
  box-shadow:
    0 6px 16px -7px #8590cf,
    inset 0 1px 0 #ffffff59;
}

.cf-action-button.cf-modal-primary-btn {
  transition: filter 160ms ease;
}

.cf-action-button.cf-modal-primary-btn:not(:disabled):hover {
  filter: brightness(1.06) saturate(1.08);
}

.cf-clist-mock-panel {
  background: var(--cf-control-surface, #ffffff);
  border: 1px solid var(--cf-aurora-glass-border, var(--cf-gray-200));
  border-radius: var(--cf-radius-lg);
  padding: 14px;
  margin: 12px 0;
  box-shadow: 0 1px 3px #5a6a8f14;
}

.cf-clist-code-block {
  background: var(--cf-guide-code-bg, var(--cf-gray-900));
  color: var(--cf-guide-code-ink, #38bdf8);
  border-radius: var(--cf-radius-md);
  padding: 10px 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--cf-font-size-base);
  overflow-x: auto;
  margin: 8px 0;
  border: 1px solid var(--cf-guide-code-border, var(--cf-gray-800));
  user-select: all;
}

.cf-clist-popover-demo {
  --cf-popover-surface: #ffffffe6;
  background: var(--cf-popover-surface);
  border: 1px solid var(--cf-surface-border, var(--cf-gray-300));
  border-radius: var(--cf-radius-lg);
  box-shadow:
    0 12px 24px -10px #4f5f8a47,
    0 2px 6px #4f5f8a14;
  padding: 12px;
  margin-top: 10px;
  position: relative;
}

.cf-clist-popover-demo::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 28px;
  width: 10px;
  height: 10px;
  background: #fdfdff;
  border-top: 1px solid var(--cf-surface-border, var(--cf-gray-300));
  border-left: 1px solid var(--cf-surface-border, var(--cf-gray-300));
  transform: rotate(45deg);
}

.cf-clist-progress-track {
  width: 100%;
  height: 10px;
  background: var(--cf-surface-border, var(--cf-gray-200));
  border-radius: 5px;
  overflow: hidden;
  margin: 12px 0 8px;
  position: relative;
}

.cf-clist-progress-fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(
    90deg,
    var(--cf-menu-secondary, #3b82f6),
    var(--cf-menu-accent, #6366f1)
  );
  border-radius: 5px;
  transition: width 0.3s ease;
}

/* 说明框内的表格：不用斑马纹，表头是一条横向的幻彩渐变。 */
.cf-guide-theme .cf-guide-table-wrap {
  border: 1px solid var(--cf-aurora-glass-border);
  border-radius: var(--cf-radius-xl);
  overflow: hidden;
  background: #ffffff8c;
  box-shadow: 0 1px 3px #5a6a8f14;
}
.cf-guide-theme .cf-guide-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--cf-font-size-base);
}
.cf-guide-theme .cf-guide-table thead tr {
  background: linear-gradient(90deg, #e2e8fb, #ebe3f6 55%, #dcf0ea);
  border-bottom: 1px solid #d3d9ee;
}
.cf-guide-theme .cf-guide-table th {
  background: transparent;
  color: #4b5778;
  font-size: var(--cf-font-size-sm);
  font-weight: 650;
  letter-spacing: 0.02em;
}
.cf-guide-theme .cf-guide-table tbody tr,
.cf-guide-theme .cf-guide-table tbody td {
  background: transparent;
}
.cf-guide-theme .cf-guide-table tbody tr {
  transition: background-color 140ms ease;
}
.cf-guide-theme .cf-guide-table tbody tr:hover {
  background: #eef1fc99;
}
.cf-guide-theme a:link,
.cf-guide-theme a:visited {
  color: #5565b0;
}
.cf-guide-theme a:hover {
  color: #3b4a8e;
}
</style>
