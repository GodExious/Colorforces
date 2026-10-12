<script setup>
import { shortcutResetIcon as resetIcon } from '../../../../assets/index.js';
import InlineSvg from '../../icons/InlineSvg/InlineSvg.vue';
import { tooltip } from '../../tooltips/FloatingTooltip/FloatingTooltip.vue';
defineProps({ label: { type: String, required: true }, disabled: Boolean });
defineEmits(['click']);
</script>

<template>
  <button
    type="button"
    class="cf-reset-button"
    :disabled="disabled"
    :aria-label="label"
    :data-tooltip="label"
    @focus="tooltip.show($event.currentTarget, label)"
    @blur="tooltip.hide"
    @click="
      tooltip.hide();
      $emit('click', $event);
    "
  >
    <InlineSvg :source="resetIcon" />
  </button>
</template>

<style scoped>
.cf-reset-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: var(--cf-radius-sm);
  background: transparent;
  color: var(--cf-gray-400);
  cursor: pointer;
  transition:
    background-color var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease,
    border-color var(--cf-duration-fast) ease;
}
.cf-reset-button:not(:disabled):hover,
.cf-reset-button:focus-visible {
  background: var(--cf-control-active);
  color: var(--cf-control-ink);
  border-color: var(--cf-surface-border);
}
.cf-reset-button:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
