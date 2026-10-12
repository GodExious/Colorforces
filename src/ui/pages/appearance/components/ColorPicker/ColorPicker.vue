<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
// 一个取色按钮：颜色用 v-model 交给外面，用户改了颜色时另发一次 change（外面在这时保存设置）。
const props = defineProps({ modelValue: { type: String, required: true } });
const emit = defineEmits(['update:modelValue', 'change']);
const element = ref(null);
let picker;
// 选择器现在摆着的颜色（写成设置里的那种字符串）。
let shown = '';
// 正在由脚本把颜色摆进选择器。Pickr 的 setColor 即使带上 silent 也会发 change，这时发出的不是用户的操作。
let syncing = false;
// 把外面的颜色摆进选择器：只改选择器的样子，不往外发、不保存。
function show(color) {
  if (!picker) return;
  syncing = true;
  try {
    picker.setColor(color, true);
    picker.applyColor(true);
    shown = color;
  } finally {
    syncing = false;
  }
}
// 创建原版 nano 颜色选择器，不替换视觉和输入格式。
onMounted(() => {
  const PickrLibrary = typeof Pickr !== 'undefined' ? Pickr : window.Pickr;
  if (!PickrLibrary) return;
  picker = PickrLibrary.create({
    el: element.value,
    theme: 'nano',
    default: props.modelValue,
    position: 'bottom-end',
    components: {
      preview: true,
      opacity: true,
      hue: true,
      interaction: { hex: true, rgba: true, input: true, clear: false, save: false },
    },
  });
  picker
    .on('init', () => show(props.modelValue))
    .on('change', (color) => {
      // 只有用户在选择器上的操作才往外发。脚本摆颜色时也往外发并保存的话，别的标签页同步过来的旧颜色
      // 会被这一页再存一遍，两个标签页就拿着先后的几种颜色来回覆盖，滑块自己跳个不停。
      if (syncing) return;
      const next = color.toRGBA().toString(0);
      picker.applyColor(true);
      if (next === shown) return;
      shown = next;
      emit('update:modelValue', next);
      emit('change', next);
    });
});
// 设置重置、别的标签页改了颜色时同步选择器。颜色就是选择器自己刚给出的那一个时不再摆回去：
// 设置里存的是取整后的颜色，摆回去会让滑块在拖动中跳到取整后的位置。
watch(
  () => props.modelValue,
  (color) => {
    if (color !== shown) show(color);
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
