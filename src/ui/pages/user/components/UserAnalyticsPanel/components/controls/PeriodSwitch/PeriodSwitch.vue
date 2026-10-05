<script setup>
import { computed } from 'vue';
import { translate as t } from '../../../../../../../../i18n/index.js';

// 时间段切换，和原站活跃度图的选法一致：默认是「近一年」（截至今天的最近十二个月），
// 向左依次是今年、去年……一直到最早的一年；向右原路返回。
// modelValue 是 'now' 或一个年份。
const props = defineProps({
  modelValue: { type: [String, Number], required: true },
  // 能切到的最早和最晚的年份。
  firstYear: { type: Number, required: true },
  lastYear: { type: Number, required: true },
});
const emit = defineEmits(['update:modelValue']);
const isNow = computed(() => props.modelValue === 'now');
const canEarlier = computed(() => isNow.value || props.modelValue > props.firstYear);
// 往更早切：近一年 → 今年 → 去年……
function earlier() {
  if (!canEarlier.value) return;
  emit('update:modelValue', isNow.value ? props.lastYear : props.modelValue - 1);
}
// 往更近切：……去年 → 今年 → 近一年。
function later() {
  if (isNow.value) return;
  emit('update:modelValue', props.modelValue >= props.lastYear ? 'now' : props.modelValue + 1);
}
</script>

<template>
  <div class="cf-analytics-period">
    <button
      type="button"
      :disabled="!canEarlier"
      :aria-label="t('analyticsPeriodEarlier')"
      @click="earlier"
    >
      <svg viewBox="0 0 6 10" aria-hidden="true"><path d="M5 1 1 5l4 4" /></svg>
    </button>
    <Transition name="cf-analytics-swap" mode="out-in">
      <span :key="modelValue" :data-cf-language-text="isNow ? '' : null">{{
        isNow ? t('analyticsPeriodNow') : modelValue
      }}</span>
    </Transition>
    <button type="button" :disabled="isNow" :aria-label="t('analyticsPeriodLater')" @click="later">
      <svg viewBox="0 0 6 10" aria-hidden="true"><path d="m1 1 4 4-4 4" /></svg>
    </button>
  </div>
</template>

<style>
.cf-analytics-period {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--cf-gray-600);
  font-size: var(--cf-font-size-base);
  font-weight: var(--cf-font-weight-semibold);
  line-height: 20px;
  font-variant-numeric: tabular-nums;
}
.cf-analytics-period > span {
  display: inline-block;
  min-width: 40px;
  text-align: center;
  white-space: nowrap;
}
.cf-analytics-period button {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--cf-radius-xs);
  background: transparent;
  color: var(--cf-gray-400);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease;
}
.cf-analytics-period svg {
  width: 6px;
  height: 10px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.cf-analytics-period button:enabled:hover {
  background: color-mix(in srgb, var(--cf-analytics-accent) 14%, #fff);
  color: var(--cf-analytics-ink);
}
.cf-analytics-period button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--cf-analytics-accent) 55%, transparent);
  outline-offset: 1px;
}
.cf-analytics-period button:disabled {
  opacity: 0.3;
  cursor: default;
}
@media (prefers-reduced-motion: reduce) {
  .cf-analytics-period button {
    transition: none;
  }
}
</style>
