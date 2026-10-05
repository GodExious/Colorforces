<script setup>
import { computed } from 'vue';
import { translate as t } from '../../../../../../../../i18n/index.js';
import { utcOffsetLabel } from '../../../../../../../../utils/time.js';
import { ZONE_MIN, ZONE_MAX } from '../../../../../../../../features/user/analytics/index.js';
import AnimatedNumber from '../../parts/AnimatedNumber/AnimatedNumber.vue';

// 时区选择：只能上下调，一次一小时。可以点两个小箭头，也可以聚焦后按键盘的上下键。
// 「最长连续」、难度热力图、月度活跃度和刷题作息各放一个，改的是同一个值：它决定按哪个时区划分每一天（以及月份、钟点），
// 只对当前这个账号生效。在图表的标题栏里，它排在时间段控件的右边。
const props = defineProps({
  // 相对 UTC 的小时数；null 表示还没单独设置，用查看者自己的时区。
  zone: { type: Number, default: null },
});
const emit = defineEmits(['zone']);
// 显示的值：没有单独设置时是查看者自己的时区。
const shown = computed(() => props.zone ?? Math.round(-new Date().getTimezoneOffset() / 60));
const zoneText = (value) => utcOffsetLabel(Math.round(value) * 60);
function step(delta) {
  const next = Math.min(ZONE_MAX, Math.max(ZONE_MIN, shown.value + delta));
  if (next !== shown.value) emit('zone', next);
}
</script>

<template>
  <span
    class="cf-analytics-zone-picker"
    role="spinbutton"
    tabindex="0"
    :aria-label="t('analyticsZoneLabel')"
    :aria-valuenow="shown"
    :aria-valuemin="ZONE_MIN"
    :aria-valuemax="ZONE_MAX"
    :aria-valuetext="zoneText(shown)"
    :data-tooltip="t('analyticsZoneHint')"
    @keydown.up.prevent="step(1)"
    @keydown.down.prevent="step(-1)"
  >
    <AnimatedNumber :value="shown" :format="zoneText" />
    <span class="cf-analytics-zone-steps">
      <button
        type="button"
        tabindex="-1"
        :disabled="shown >= ZONE_MAX"
        :aria-label="t('analyticsZoneUp')"
        @click="step(1)"
      >
        <svg viewBox="0 0 8 5" aria-hidden="true"><path d="M1 4 4 1l3 3" /></svg>
      </button>
      <button
        type="button"
        tabindex="-1"
        :disabled="shown <= ZONE_MIN"
        :aria-label="t('analyticsZoneDown')"
        @click="step(-1)"
      >
        <svg viewBox="0 0 8 5" aria-hidden="true"><path d="M1 1l3 3 3-3" /></svg>
      </button>
    </span>
  </span>
</template>

<style>
/* 一个小控件：左边是当前时区，右边是上下两个小箭头。点缀色取所在卡片的颜色，没有时用面板的主色。 */
.cf-analytics-zone-picker {
  --cf-zone-accent: var(--cf-analytics-card, var(--cf-analytics-accent));
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 2px 1px 5px;
  border: 1px solid transparent;
  border-radius: var(--cf-radius-xs);
  color: var(--cf-gray-500);
  font-size: var(--cf-font-size-2xs);
  line-height: 14px;
  outline: none;
  cursor: default;
  white-space: nowrap;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease;
}
.cf-analytics-zone-picker:is(:hover, :focus-visible) {
  border-color: color-mix(in srgb, var(--cf-zone-accent) 40%, #e3e7ee);
  background: #fff;
  color: var(--cf-gray-700);
}
.cf-analytics-zone-picker:focus-visible {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--cf-zone-accent) 28%, transparent);
}
.cf-analytics-zone-steps {
  display: grid;
  gap: 1px;
}
.cf-analytics-zone-steps button {
  display: grid;
  place-items: center;
  width: 12px;
  height: 7px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 2px;
  background: transparent;
  color: var(--cf-gray-400);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}
.cf-analytics-zone-steps svg {
  width: 8px;
  height: 5px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.cf-analytics-zone-steps button:enabled:hover {
  background: color-mix(in srgb, var(--cf-zone-accent) 22%, #fff);
  color: var(--cf-gray-800);
}
.cf-analytics-zone-steps button:enabled:active {
  background: color-mix(in srgb, var(--cf-zone-accent) 38%, #fff);
}
.cf-analytics-zone-steps button:disabled {
  opacity: 0.35;
  cursor: default;
}
@media (prefers-reduced-motion: reduce) {
  .cf-analytics-zone-picker,
  .cf-analytics-zone-steps button {
    transition: none;
  }
}
</style>
