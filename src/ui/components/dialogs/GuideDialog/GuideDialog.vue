<script setup>
import ActionButton from '../../forms/ActionButton/ActionButton.vue';
import DialogTransition from '../../transitions/DialogTransition/DialogTransition.vue';
import { computed, inject, ref, watch } from 'vue';
import { preventScrollChaining } from '../../../../utils/scroll.js';
import InlineSvg from '../../icons/InlineSvg/InlineSvg.vue';
const props = defineProps({
  options: { type: Object, required: true },
  visible: Boolean,
  origin: Object,
});
defineEmits(['close']);
const overlay = ref(null);
const theme = inject('cf-menu-theme', {});
const classes = computed(() => [
  'cf-clist-modal-overlay',
  'cf-menu-theme',
  'cf-guide-theme',
  props.options.className,
]);
const cardStyle = computed(() => ({
  width: props.options.width || '580px',
  maxWidth: props.options.maxWidth || '92vw',
}));
const buttonStyle = computed(() => ({
  background: 'var(--cf-control-ink)',
  color: '#fff',
  borderColor: 'var(--cf-control-ink)',
  padding: '6px 18px',
  fontWeight: 600,
}));
watch(overlay, (node) => {
  if (node) preventScrollChaining(node);
});
</script>
<template>
  <Teleport to="body">
    <DialogTransition :origin="origin"
      ><div
        v-if="visible"
        ref="overlay"
        :class="classes"
        :style="theme"
        @click.self="$emit(`close`)"
      >
        <div class="cf-clist-modal-card" :style="cardStyle">
          <div class="cf-clist-modal-header">
            <div class="cf-clist-modal-title">
              <InlineSvg :source="options.iconSvg" /><span>{{ options.title }}</span>
            </div>
            <button
              type="button"
              class="cf-modal-close-btn"
              style="
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #64748b;
              "
              @click="$emit(`close`)"
            >
              &times;
            </button>
          </div>
          <div class="cf-clist-modal-body" v-html="options.bodyHtml"></div>
          <div class="cf-clist-modal-footer">
            <ActionButton
              type="button"
              class="cf-clist-sync-btn cf-guide-confirm-btn"
              :style="buttonStyle"
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
.cf-clist-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(3px);
  z-index: 10000002;
  display: flex;
  align-items: center;
  justify-content: center;
  overscroll-behavior: contain;
}

.cf-clist-modal-card {
  background: var(--cf-card-surface, #ffffff);
  border-radius: 12px;
  width: 580px;
  max-width: 92vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  border: 1px solid var(--cf-surface-border, rgba(226, 232, 240, 0.8));
  overscroll-behavior: contain;
}

.cf-clist-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: var(--cf-control-active, #f8fafc);
  border-bottom: 1px solid var(--cf-surface-border, #e2e8f0);
}

.cf-clist-modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--cf-control-ink, #1e293b);
  display: flex;
  align-items: center;
  gap: 8px;
}

.cf-clist-modal-body {
  padding: 20px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.6;
  color: #334155;
  overscroll-behavior: contain;
}

.cf-clist-modal-footer {
  padding: 12px 20px;
  background: var(--cf-control-surface, #f8fafc);
  border-top: 1px solid var(--cf-surface-border, #e2e8f0);
  display: flex;
  justify-content: flex-end;
}

.cf-clist-mock-panel {
  background: var(--cf-control-surface, #ffffff);
  border: 1px solid var(--cf-surface-border, #e2e8f0);
  border-radius: 8px;
  padding: 14px;
  margin: 12px 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.cf-clist-code-block {
  background: var(--cf-guide-code-bg, #0f172a);
  color: var(--cf-guide-code-ink, #38bdf8);
  border-radius: 6px;
  padding: 10px 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  overflow-x: auto;
  margin: 8px 0;
  border: 1px solid #1e293b;
  user-select: all;
}

.cf-clist-popover-demo {
  background: var(--cf-control-surface, #ffffff);
  border: 1px solid var(--cf-surface-border, #cbd5e1);
  border-radius: 8px;
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -4px rgba(0, 0, 0, 0.05);
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
  background: var(--cf-control-surface, #ffffff);
  border-top: 1px solid var(--cf-surface-border, #cbd5e1);
  border-left: 1px solid var(--cf-surface-border, #cbd5e1);
  transform: rotate(45deg);
}

.cf-clist-progress-track {
  width: 100%;
  height: 10px;
  background: var(--cf-surface-border, #e2e8f0);
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
.cf-guide-theme {
  --cf-guide-code-bg: color-mix(in srgb, var(--cf-menu-accent) 18%, #172536);
  --cf-guide-code-ink: color-mix(in srgb, var(--cf-menu-secondary) 26%, #f2f7fb);
}
.cf-guide-theme a:link,
.cf-guide-theme a:visited {
  color: var(--cf-control-ink);
}
.cf-guide-theme a:hover {
  color: color-mix(in srgb, var(--cf-menu-accent) 45%, #19283d);
}
</style>
