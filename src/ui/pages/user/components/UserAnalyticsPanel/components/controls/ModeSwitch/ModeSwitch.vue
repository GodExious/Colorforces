<script setup>
import { computed } from 'vue';
import { translate as t } from '../../../../../../../../i18n/index.js';

// 图表标题栏里的小切换：几个等宽的按钮，选中的那一格下面垫一块滑块。
// modes 是 [取值, 文案键] 的列表；label 是给读屏用的整体说明。
const props = defineProps({
  modes: { type: Array, required: true },
  modelValue: { type: String, required: true },
  label: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);
const index = computed(() =>
  Math.max(
    0,
    props.modes.findIndex(([id]) => id === props.modelValue),
  ),
);
function choose(id) {
  if (id !== props.modelValue) emit('update:modelValue', id);
}
</script>

<template>
  <div
    class="cf-analytics-modes"
    :style="{ '--cf-analytics-mode': index, '--cf-analytics-modes': modes.length }"
    role="group"
    :aria-label="label"
  >
    <i class="cf-analytics-modes-thumb" aria-hidden="true"></i>
    <button
      v-for="[id, text] in modes"
      :key="id"
      type="button"
      :class="{ 'is-active': modelValue === id }"
      :aria-pressed="modelValue === id"
      @click="choose(id)"
    >
      <span data-cf-language-text>{{ t(text) }}</span>
    </button>
  </div>
</template>

<style>
/*
 * 切换时滑块滑到选中的那一格，文字颜色跟着渐变，不是直接换底色。
 * 格数和当前选中的是第几格由组件写进两个变量。
 */
.cf-analytics-modes {
  position: relative;
  display: inline-grid;
  grid-template-columns: repeat(var(--cf-analytics-modes, 2), 1fr);
  padding: 1px;
  border: 1px solid color-mix(in srgb, var(--cf-analytics-accent) 26%, #dfe4ec);
  border-radius: var(--cf-radius-sm);
  background: #fff;
}
.cf-analytics-modes-thumb {
  position: absolute;
  top: 1px;
  bottom: 1px;
  left: 1px;
  width: calc((100% - 2px) / var(--cf-analytics-modes, 2));
  border-radius: var(--cf-radius-xs);
  background: color-mix(in srgb, var(--cf-analytics-accent) 18%, #fff);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--cf-analytics-accent) 22%, transparent);
  transform: translateX(calc(var(--cf-analytics-mode, 0) * 100%));
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}
.cf-analytics-modes button {
  position: relative;
  margin: 0;
  padding: 0 9px;
  border: 0;
  background: transparent;
  color: var(--cf-gray-500);
  font: inherit;
  font-size: var(--cf-font-size-2xs);
  line-height: 16px;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.24s ease;
}
.cf-analytics-modes button:hover,
.cf-analytics-modes button.is-active {
  color: var(--cf-analytics-ink);
}
.cf-analytics-modes button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--cf-analytics-accent) 55%, transparent);
  outline-offset: 1px;
}
@media (prefers-reduced-motion: reduce) {
  .cf-analytics-modes-thumb,
  .cf-analytics-modes button {
    transition: none;
  }
}
</style>
