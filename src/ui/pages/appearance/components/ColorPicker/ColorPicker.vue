<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { appSettings, saveSettings } from '../../../../../settings.js';
const element = ref(null);
let picker;
// 创建原版 nano 颜色选择器，不替换视觉和输入格式。
onMounted(() => {
  const PickrLibrary = typeof Pickr !== 'undefined' ? Pickr : window.Pickr;
  if (!PickrLibrary) return;
  picker = PickrLibrary.create({
    el: element.value,
    theme: 'nano',
    default: appSettings.acBgColor,
    position: 'bottom-end',
    components: {
      preview: true,
      opacity: true,
      hue: true,
      interaction: { hex: true, rgba: true, input: true, clear: false, save: false },
    },
  });
  picker
    .on('init', () => {
      picker.setColor(appSettings.acBgColor, true);
    })
    .on('change', (color) => {
      appSettings.acBgColor = color.toRGBA().toString(0);
      picker.applyColor(true);
      saveSettings();
    })
    .on('save', () => saveSettings());
});
// 设置重置或外部切换时同步选择器，避免重复发出 change。
watch(
  () => appSettings.acBgColor,
  (color) => {
    picker?.setColor(color, true);
  },
);
onBeforeUnmount(() => picker?.destroyAndRemove());
</script>
<template><div ref="element"></div></template>

<style>
.pcr-app {
  z-index: 9999999 !important;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.pcr-app.visible {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.pcr-app[data-theme='nano'] {
  width: 240px !important;
}

.pcr-app[data-theme='nano'] .pcr-interaction {
  flex-wrap: wrap !important;
}

.pcr-app[data-theme='nano'] .pcr-interaction .pcr-result {
  flex: 1 1 100% !important;
  width: 100% !important;
  min-width: 100% !important;
  margin-top: 8px !important;
}
</style>
