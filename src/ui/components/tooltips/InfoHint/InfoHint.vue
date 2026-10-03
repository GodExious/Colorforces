<script setup>
import { tooltip } from '../FloatingTooltip/FloatingTooltip.vue';
// variant：info 仅悬停提示；question 点击打开说明；warning 点击打开需要留意的事项。
defineProps({
  text: { type: String, required: true },
  variant: { type: String, default: 'info' },
  clickable: { type: Boolean, default: false },
});
const emit = defineEmits(['click']);
</script>

<template>
  <button
    type="button"
    class="cf-info-hint"
    :class="[`cf-info-hint--${variant}`, { 'cf-info-hint--clickable': clickable }]"
    :aria-label="text"
    :aria-haspopup="clickable ? 'dialog' : undefined"
    :data-tooltip="text"
    @click.stop.prevent="emit('click', $event)"
    @keydown.escape="tooltip.hide"
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <template v-if="variant === 'warning'">
        <path class="cf-info-hint-shape" d="M8 2.4 14.2 13.1H1.8Z" />
        <path class="cf-info-hint-glyph" d="M8 6.4v3.1" />
        <circle class="cf-info-hint-dot" cx="8" cy="11.5" r="0.85" />
      </template>
      <template v-else-if="variant === 'question'">
        <circle class="cf-info-hint-shape" cx="8" cy="8" r="7" />
        <path class="cf-info-hint-glyph" d="M6.1 6.4a1.95 1.95 0 1 1 2.9 1.7c-.6.35-1 .8-1 1.5" />
        <circle class="cf-info-hint-dot" cx="8" cy="11.7" r="0.85" />
      </template>
      <template v-else>
        <circle class="cf-info-hint-shape" cx="8" cy="8" r="6.6" />
        <circle class="cf-info-hint-dot" cx="8" cy="5.05" r="0.9" />
        <path class="cf-info-hint-glyph" d="M8 7.5v3.9" />
      </template>
    </svg>
  </button>
</template>

<style scoped>
/*
 * 三种提示共用同一套线条，靠「空心 / 实心」和形状区分：
 * info 是空心圆，只在悬停时出提示；question 是实心圆，点击打开说明；
 * warning 是实心圆角三角，点击打开需要留意的事项。
 * 三者的颜色都由当前设置页的主题色推导，警告只是取得更深一些，不另用一种颜色。
 */
.cf-info-hint {
  --cf-hint-color: color-mix(in srgb, var(--cf-menu-accent, #6b8fd6) 62%, #5b6b82);
  --cf-hint-glyph: var(--cf-hint-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  margin-left: 5px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--cf-hint-color);
  cursor: help;
  transition:
    color 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;
}
.cf-info-hint svg {
  display: block;
  width: 16px;
  height: 16px;
  overflow: visible;
}
.cf-info-hint-shape {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.3;
  stroke-linejoin: round;
  transition: fill 160ms ease;
}
.cf-info-hint-glyph {
  fill: none;
  stroke: var(--cf-hint-glyph);
  stroke-width: 1.45;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.cf-info-hint-dot {
  fill: var(--cf-hint-glyph);
}

/* 空心圆：悬停时填入一层很淡的主题色，提示「这里有说明」。 */
.cf-info-hint--info:hover .cf-info-hint-shape,
.cf-info-hint--info:focus-visible .cf-info-hint-shape {
  fill: color-mix(in srgb, var(--cf-hint-color) 16%, transparent);
}

/* 实心：可点击，白色符号；悬停时加深并出现一圈光晕。 */
.cf-info-hint--clickable {
  --cf-hint-glyph: #fff;
  cursor: pointer;
}
.cf-info-hint--clickable .cf-info-hint-shape {
  fill: currentColor;
}
.cf-info-hint--clickable:hover,
.cf-info-hint--clickable:focus-visible {
  color: color-mix(in srgb, var(--cf-hint-color) 78%, #1f2a3d);
  transform: scale(1.1);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--cf-hint-color) 20%, transparent);
}
/* 三角用粗圆角描边补足体量，颜色比问号深一档以示提醒；外形不是圆，悬停时不加圆形光晕。 */
.cf-info-hint--warning {
  --cf-hint-color: color-mix(in srgb, var(--cf-menu-accent, #6b8fd6) 74%, #3f2f2a);
  border-radius: 5px;
}
.cf-info-hint--warning .cf-info-hint-shape {
  stroke-width: 1.8;
}
.cf-info-hint--warning:hover,
.cf-info-hint--warning:focus-visible {
  box-shadow: none;
}

.cf-info-hint:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--cf-hint-color) 70%, transparent);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .cf-info-hint,
  .cf-info-hint-shape {
    transition: none;
  }
}
</style>
