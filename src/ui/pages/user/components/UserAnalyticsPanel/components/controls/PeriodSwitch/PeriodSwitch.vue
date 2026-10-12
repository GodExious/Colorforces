<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { translate as t } from '../../../../../../../../i18n/index.js';

// 时间段切换，和原站活跃度图的选法一致：默认是「近一年」（截至今天的最近十二个月），
// 向左依次是今年、去年……一直到最早的一年；向右原路返回。
// 一年一年地翻要点很多下，所以中间显示着当前时间段的地方也可以点：点开是一张小表，
// 从最早的一年排到最晚的一年，最后是「近一年」，点哪个就直接跳到哪个。
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

// 可以直接跳去的年份，从早到晚。
const years = computed(() =>
  Array.from(
    { length: Math.max(0, props.lastYear - props.firstYear + 1) },
    (_, index) => props.firstYear + index,
  ),
);
// 那张小表开没开着。开着的时候点别处、按 Esc 都收起。
const root = ref(null);
const open = ref(false);
function pick(value) {
  open.value = false;
  if (value !== props.modelValue) emit('update:modelValue', value);
}
function closeOutside(event) {
  if (!root.value?.contains(event.target)) open.value = false;
}
function closeOnEscape(event) {
  if (event.key === 'Escape') open.value = false;
}
function listen(on) {
  const change = on ? 'addEventListener' : 'removeEventListener';
  document[change]('pointerdown', closeOutside, true);
  document[change]('keydown', closeOnEscape);
}
watch(open, listen);
onBeforeUnmount(() => listen(false));
</script>

<template>
  <div ref="root" class="cf-analytics-period">
    <button
      type="button"
      class="cf-analytics-period-step"
      :disabled="!canEarlier"
      :aria-label="t('analyticsPeriodEarlier')"
      @click="earlier"
    >
      <svg viewBox="0 0 6 10" aria-hidden="true"><path d="M5 1 1 5l4 4" /></svg>
    </button>
    <button
      type="button"
      class="cf-analytics-period-current"
      :class="{ 'is-open': open }"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-label="t('analyticsPeriodPick')"
      @click="open = !open"
    >
      <Transition name="cf-analytics-swap" mode="out-in">
        <span :key="modelValue">{{ isNow ? t('analyticsPeriodNow') : modelValue }}</span>
      </Transition>
    </button>
    <button
      type="button"
      class="cf-analytics-period-step"
      :disabled="isNow"
      :aria-label="t('analyticsPeriodLater')"
      @click="later"
    >
      <svg viewBox="0 0 6 10" aria-hidden="true"><path d="m1 1 4 4-4 4" /></svg>
    </button>
    <!-- 直接选一个时间段：各个年份从早到晚，最后是「近一年」。
         data-cf-language-keep：换语言时这张小表自己不参与过渡，只有「近一年」那一格换字，见 utils/language-wave.js。 -->
    <Transition name="cf-analytics-period-menu">
      <div v-if="open" class="cf-analytics-period-menu" role="listbox" data-cf-language-keep>
        <button
          v-for="year in years"
          :key="year"
          type="button"
          role="option"
          :aria-selected="modelValue === year"
          :class="{ 'is-active': modelValue === year }"
          @click="pick(year)"
        >
          {{ year }}
        </button>
        <button
          type="button"
          role="option"
          class="is-now"
          :aria-selected="isNow"
          :class="{ 'is-active': isNow }"
          @click="pick('now')"
        >
          <span>{{ t('analyticsPeriodNow') }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style>
.cf-analytics-period {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--cf-gray-600);
  font-size: var(--cf-font-size-base);
  font-weight: var(--cf-font-weight-semibold);
  line-height: 20px;
  font-variant-numeric: tabular-nums;
}
/* 中间显示当前时间段，也是打开那张小表的按钮。 */
.cf-analytics-period-current {
  margin: 0;
  padding: 0 4px;
  border: 0;
  border-radius: var(--cf-radius-xs);
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 20px;
  cursor: pointer;
  transition:
    background-color var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease;
}
.cf-analytics-period-current > span {
  display: inline-block;
  min-width: 40px;
  text-align: center;
  white-space: nowrap;
}
.cf-analytics-period-current:hover,
.cf-analytics-period-current.is-open {
  background: color-mix(in srgb, var(--cf-analytics-accent) 14%, #fff);
  color: var(--cf-analytics-ink);
}
/* 两边的箭头。 */
.cf-analytics-period-step {
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
    background-color var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease,
    opacity var(--cf-duration-fast) ease;
}
.cf-analytics-period-step svg {
  width: 6px;
  height: 10px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.cf-analytics-period-step:enabled:hover {
  background: color-mix(in srgb, var(--cf-analytics-accent) 14%, #fff);
  color: var(--cf-analytics-ink);
}
.cf-analytics-period button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--cf-analytics-accent) 55%, transparent);
  outline-offset: 1px;
}
.cf-analytics-period-step:disabled {
  opacity: 0.3;
  cursor: default;
}
/* 那张小表：贴在这个控件的右下方，四个一排，各格一样宽（按最宽的那一格），盖在图表上面。 */
.cf-analytics-period-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 6;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
  padding: 6px;
  border: 1px solid color-mix(in srgb, var(--cf-analytics-accent) 24%, #dfe4ec);
  border-radius: var(--cf-radius-md);
  background: var(--cf-white-surface);
  box-shadow: 0 8px 24px #1f2d3d24;
  transform-origin: top right;
}
.cf-analytics-period-menu button {
  margin: 0;
  padding: 2px 9px;
  border: 0;
  border-radius: var(--cf-radius-xs);
  background: transparent;
  color: var(--cf-gray-600);
  font: inherit;
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-medium);
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease;
}
.cf-analytics-period-menu button:hover {
  background: color-mix(in srgb, var(--cf-analytics-accent) 12%, #fff);
  color: var(--cf-analytics-ink);
}
.cf-analytics-period-menu button.is-active {
  background: color-mix(in srgb, var(--cf-analytics-accent) 20%, #fff);
  color: var(--cf-analytics-ink);
  font-weight: var(--cf-font-weight-bold);
}
/* 小表出现时从右上角略微放大并淡入，收起时反过来。 */
.cf-analytics-period-menu-enter-active,
.cf-analytics-period-menu-leave-active {
  transition:
    opacity var(--cf-duration-fast) ease,
    transform var(--cf-duration-base) var(--cf-ease-out);
}
.cf-analytics-period-menu-enter-from,
.cf-analytics-period-menu-leave-to {
  opacity: 0;
  transform: scale(0.94) translateY(-3px);
}
@media (prefers-reduced-motion: reduce) {
  .cf-analytics-period-current,
  .cf-analytics-period-step,
  .cf-analytics-period-menu button,
  .cf-analytics-period-menu-enter-active,
  .cf-analytics-period-menu-leave-active {
    transition: none;
  }
}
</style>
