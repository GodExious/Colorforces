<script setup>
import { tooltip } from '../FloatingTooltip/FloatingTooltip.vue';
defineProps({ text: { type: String, required: true } });
</script>

<template>
  <button
    type="button"
    class="cf-info-hint"
    :aria-label="text"
    @mouseenter="tooltip.show($event.currentTarget, text)"
    @mouseleave="tooltip.hide"
    @focus="tooltip.show($event.currentTarget, text)"
    @blur="tooltip.hide"
    @click.stop.prevent
    @keydown.escape="tooltip.hide"
  >
    <span aria-hidden="true">i</span>
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
</style>
