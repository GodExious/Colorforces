<script setup>
import { computed } from 'vue';
// 设置行里的滑动条。拖动过程中实时提交数值。
// 浏览器自带的滑动条在主题色较浅时会把未选中的轨道画成深色，所以轨道和滑块都自己画。
const props = defineProps({
  modelValue: { type: Number, required: true },
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  step: { type: Number, default: 1 },
  dataControl: String,
});
const emit = defineEmits(['update:modelValue', 'change']);
// 已选中的一段占整条轨道的比例，交给样式画填充。
const share = computed(() => {
  const span = props.max - props.min;
  return span > 0 ? Math.min(1, Math.max(0, (props.modelValue - props.min) / span)) : 0;
});
function update(event) {
  const value = Number(event.target.value);
  emit('update:modelValue', value);
  emit('change', value);
}
</script>

<template>
  <input
    class="cf-range-slider"
    type="range"
    :min="min"
    :max="max"
    :step="step"
    :value="modelValue"
    :style="{ '--cf-range-share': share }"
    :data-control="dataControl"
    @input="update"
  />
</template>

<style>
.cf-range-slider {
  --cf-range-thumb: 16px;
  --cf-range-track: 6px;
  /* 填充的终点落在滑块圆心：滑块只在「轨道宽度减去自身宽度」的范围内移动。 */
  --cf-range-fill: calc(
    var(--cf-range-thumb) / 2 + (100% - var(--cf-range-thumb)) * var(--cf-range-share, 0)
  );
  --cf-range-rest: color-mix(in srgb, var(--cf-menu-accent) 14%, var(--cf-gray-200));
  -webkit-appearance: none;
  appearance: none;
  width: 100px;
  height: var(--cf-range-thumb);
  margin: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}
.cf-range-slider:focus {
  outline: none;
}
.cf-range-slider::-webkit-slider-runnable-track {
  height: var(--cf-range-track);
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--cf-menu-accent) var(--cf-range-fill),
    var(--cf-range-rest) var(--cf-range-fill)
  );
}
/* 滑块与评级分析弹窗里的一致：白底、主题色描边。悬停和拖动时外圈浮出一层淡淡的光晕。 */
.cf-range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  box-sizing: border-box;
  width: var(--cf-range-thumb);
  height: var(--cf-range-thumb);
  margin-top: calc((var(--cf-range-track) - var(--cf-range-thumb)) / 2);
  border: 3px solid var(--cf-menu-accent);
  border-radius: 50%;
  background: #fff;
  box-shadow:
    0 1px 3px #26345333,
    0 0 0 0 color-mix(in srgb, var(--cf-menu-accent) 22%, transparent);
  transition: box-shadow 0.18s ease;
}
.cf-range-slider:is(:hover, :focus-visible)::-webkit-slider-thumb {
  box-shadow:
    0 1px 3px #26345333,
    0 0 0 4px color-mix(in srgb, var(--cf-menu-accent) 22%, transparent);
}
.cf-range-slider:active::-webkit-slider-thumb {
  box-shadow:
    0 1px 3px #26345333,
    0 0 0 6px color-mix(in srgb, var(--cf-menu-accent) 26%, transparent);
}
.cf-range-slider::-moz-range-track {
  height: var(--cf-range-track);
  border-radius: 999px;
  background: var(--cf-range-rest);
}
.cf-range-slider::-moz-range-progress {
  height: var(--cf-range-track);
  border-radius: 999px;
  background: var(--cf-menu-accent);
}
.cf-range-slider::-moz-range-thumb {
  box-sizing: border-box;
  width: var(--cf-range-thumb);
  height: var(--cf-range-thumb);
  border: 3px solid var(--cf-menu-accent);
  border-radius: 50%;
  background: #fff;
  box-shadow:
    0 1px 3px #26345333,
    0 0 0 0 color-mix(in srgb, var(--cf-menu-accent) 22%, transparent);
  transition: box-shadow 0.18s ease;
}
.cf-range-slider:is(:hover, :focus-visible)::-moz-range-thumb {
  box-shadow:
    0 1px 3px #26345333,
    0 0 0 4px color-mix(in srgb, var(--cf-menu-accent) 22%, transparent);
}
.cf-range-slider:active::-moz-range-thumb {
  box-shadow:
    0 1px 3px #26345333,
    0 0 0 6px color-mix(in srgb, var(--cf-menu-accent) 26%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  .cf-range-slider::-webkit-slider-thumb,
  .cf-range-slider::-moz-range-thumb {
    transition: none;
  }
}
</style>
