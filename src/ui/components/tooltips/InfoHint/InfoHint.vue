<script setup>
import { tooltip } from '../FloatingTooltip/FloatingTooltip.vue';
defineProps({
  text: { type: String, required: true },
  symbol: { type: String, default: 'i' },
  variant: { type: String, default: 'info' },
  clickable: { type: Boolean, default: false },
});
const emit = defineEmits(['click']);
</script>

<template>
  <button
    type="button"
    class="cf-info-hint"
    :class="[`cf-info-hint--${variant}`, { 'cf-info-hint--clickable': clickable }]"
    :aria-label="text"
    :aria-haspopup="clickable ? 'dialog' : undefined"
    :data-tooltip="text"
    @click.stop.prevent="emit('click', $event)"
    @keydown.escape="tooltip.hide"
  >
    <span aria-hidden="true">{{ symbol }}</span>
  </button>
</template>

<style scoped>
.cf-info-hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  margin-left: 4px;
  padding: 0;
  border: 1px solid #a8c1dd;
  border-radius: 50%;
  background: #eaf2fb;
  color: #537da8;
  font:
    italic 600 12px/1 Georgia,
    serif;
  cursor: help;
  transition:
    background-color 160ms ease,
    border-color 160ms ease;
}
.cf-info-hint:hover,
.cf-info-hint:focus-visible {
  background: #dceafa;
  border-color: #759ac3;
  outline: none;
}
/* 圆形只是悬停提示；点击会打开说明弹窗的用圆角方形，从形状上区分。 */
.cf-info-hint--clickable {
  cursor: pointer;
  font-style: normal;
  border-radius: 5px;
}
.cf-info-hint:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
.cf-info-hint--question {
  border-color: #c3b4e7;
  background: #f1edff;
  color: #765ca4;
}
.cf-info-hint--question:hover,
.cf-info-hint--question:focus-visible {
  border-color: #a995d2;
  background: #e8e0ff;
}
.cf-info-hint--warning {
  border-color: #e7c58b;
  background: #fff6df;
  color: #a06c22;
}
.cf-info-hint--warning:hover,
.cf-info-hint--warning:focus-visible {
  border-color: #d7a95d;
  background: #ffefc5;
}
</style>
