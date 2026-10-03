<script setup>
import { computed } from 'vue';
const props = defineProps({
  modelValue: String,
  options: { type: Array, required: true },
  activeStyle: Object,
  activeColor: { type: String, default: 'var(--cf-control-ink)' },
});
defineEmits(['update:modelValue']);
const sliderStyle = computed(() => ({
  left: props.modelValue === props.options[0].value ? '2px' : '50%',
  ...props.activeStyle,
}));
</script>
<template>
  <div class="cf-segmented-switch">
    <div class="cf-segmented-slider" :style="sliderStyle"></div>
    <div
      v-for="option in options"
      :key="option.value"
      class="cf-segmented-btn"
      :class="option.class"
      :data-tooltip="option.tooltip"
      :style="{
        color: modelValue === option.value ? activeColor : `var(--cf-gray-500)`,
        fontWeight: modelValue === option.value ? `bold` : `normal`,
      }"
      @click="$emit(`update:modelValue`, option.value)"
    >
      {{ option.label }}
    </div>
  </div>
</template>

<style>
.cf-segmented-switch {
  display: flex;
  position: relative;
  background: var(--cf-control-surface);
  box-shadow: inset 0 0 0 1px var(--cf-surface-border);
  border-radius: var(--cf-radius-xl);
  padding: 2px;
  cursor: pointer;
  font-size: var(--cf-font-size-base);
  font-weight: bold;
  user-select: none;
  box-sizing: border-box;
}

.cf-segmented-slider {
  position: absolute;
  top: 2px;
  bottom: 2px;
  width: calc(50% - 2px);
  border-radius: var(--cf-radius-lg);
  transition:
    left 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    background-color 0.25s ease;
  box-shadow:
    0 1px 3px color-mix(in srgb, var(--cf-menu-accent) 20%, transparent),
    inset 0 0 0 1px var(--cf-surface-border);
  box-sizing: border-box;
  background: var(--cf-control-active);
}

.cf-segmented-btn {
  flex: 1;
  text-align: center;
  padding: 3px 0;
  font-size: var(--cf-font-size-base);
  z-index: 1;
  transition: color 0.25s;
  box-sizing: border-box;
  margin: 1px;
  color: #888;
}
</style>
