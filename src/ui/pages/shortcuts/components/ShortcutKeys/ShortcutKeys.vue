<script setup>
import { computed } from 'vue';
import { translate as t } from '../../../../../i18n/index.js';
const props = defineProps({ combo: String, recording: Boolean });
const labels = {
  PAGEUP: 'PgUp',
  PAGEDOWN: 'PgDn',
  INSERT: 'Ins',
  DELETE: 'Del',
  ESCAPE: 'Esc',
  CONTROL: 'Ctrl',
  ARROWUP: '↑',
  ARROWDOWN: '↓',
  ARROWLEFT: '←',
  ARROWRIGHT: '→',
  UP: '↑',
  DOWN: '↓',
  LEFT: '←',
  RIGHT: '→',
  BACKSPACE: '⌫',
};
const parts = computed(() => (props.combo ? props.combo.split('+') : []));
</script>
<template>
  <span class="cf-shortcut-content" :class="{ 'is-recording': recording }">
    <span class="cf-shortcut-value" :aria-hidden="recording">
      <span v-if="!parts.length" class="cf-shortcut-empty">{{ t().shortcutEmpty }}</span>
      <template v-else v-for="(part, index) in parts" :key="index">
        <span v-if="index" class="cf-shortcut-plus">+</span>
        <kbd>{{ labels[part.toUpperCase()] || part }}</kbd>
      </template>
    </span>
    <span class="cf-shortcut-recording-label" :aria-hidden="!recording">
      {{ t().shortcutRecording }}
    </span>
  </span>
</template>
<style scoped>
/* 两种状态共用网格占位，录制时不改变按钮与相邻控件的位置。 */
.cf-shortcut-content {
  display: inline-grid;
  align-items: center;
  height: 22px;
  overflow: clip;
  overflow-clip-margin: 2px;
}

.cf-shortcut-value,
.cf-shortcut-recording-label {
  grid-area: 1 / 1;
  transition:
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 140ms ease,
    visibility 0s;
}

.cf-shortcut-value {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
}

.cf-shortcut-recording-label {
  padding: 0 6px;
  text-align: center;
  font-weight: 600;
  opacity: 0;
  visibility: hidden;
  transform: translateY(6px);
  transition-delay: 0s, 0s, 180ms;
}

.is-recording .cf-shortcut-value {
  opacity: 0;
  visibility: hidden;
  transform: translateY(-6px);
  transition-delay: 0s, 0s, 180ms;
}

.is-recording .cf-shortcut-recording-label {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  transition-delay: 0s;
}

@media (prefers-reduced-motion: reduce) {
  .cf-shortcut-value,
  .cf-shortcut-recording-label {
    transition: none;
    transform: none;
  }
}
</style>
