<script setup>
import { computed, useId } from 'vue';
const props = defineProps({
  // 各片花瓣的颜色，从正上方起顺时针；有几个颜色就画几片。
  colors: { type: Array, required: true },
  size: { type: Number, default: 44 },
  // 各片花瓣的亮度（0 到 1）；不传时全部按原色显示。
  lights: { type: Array, default: null },
  // 整朵花的转角，单位是度。
  turn: { type: Number, default: 0 },
  // 为 false 时花瓣散开隐去，变回 true 时落位。
  gathered: { type: Boolean, default: true },
  // 相邻两片花瓣落位的间隔（毫秒）；为 0 时同时变化。
  stagger: { type: Number, default: 0 },
});
const id = useId();
const step = computed(() => 360 / props.colors.length);
</script>

<template>
  <!-- 花瓣形状与花心镂空取自标志（colorforces.svg），只是花瓣数量随颜色个数变化。 -->
  <svg
    class="cf-petal-flower"
    :class="{ 'is-scattered': !gathered }"
    :style="{ '--cf-petal-turn': `${turn}deg` }"
    :width="size"
    :height="size"
    viewBox="0 0 44 44"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <path :id="`${id}-form`" d="M22 24C18 21 15 15 17 9C18 4 23 3 26 7C30 12 27 20 22 24Z" />
      <linearGradient
        :id="`${id}-glaze`"
        x1="17"
        y1="5"
        x2="25"
        y2="24"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="white" stop-opacity=".64" />
        <stop offset=".42" stop-color="white" stop-opacity=".04" />
        <stop offset="1" stop-color="white" stop-opacity=".5" />
      </linearGradient>
      <mask
        :id="`${id}-center`"
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="44"
        height="44"
        mask-type="luminance"
      >
        <rect width="44" height="44" fill="white" />
        <circle cx="22" cy="22" r="3.1" fill="black" />
      </mask>
    </defs>
    <g :mask="`url(#${id}-center)`">
      <g v-for="(color, index) in colors" :key="index" :transform="`rotate(${index * step} 22 22)`">
        <g
          class="cf-petal-flower-petal"
          :style="{
            '--cf-petal-light': lights ? lights[index] : 1,
            '--cf-petal-wait': `${index * stagger}ms`,
          }"
        >
          <use :href="`#${id}-form`" :fill="color" />
          <use :href="`#${id}-form`" :fill="`url(#${id}-glaze)`" />
        </g>
      </g>
    </g>
  </svg>
</template>

<style>
.cf-petal-flower {
  display: block;
  flex: none;
  overflow: visible;
  transform: rotate(var(--cf-petal-turn, 0deg));
  transition: transform 0.48s cubic-bezier(0.22, 1, 0.36, 1);
}
/* 花瓣只改变亮度和绕花心的转角，不缩放。 */
.cf-petal-flower-petal {
  opacity: var(--cf-petal-light, 1);
  transform-origin: 22px 22px;
  transition:
    opacity 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.75s cubic-bezier(0.22, 1, 0.36, 1);
}
/* 落位时按间隔从第一片起依次到位；散开时一起隐去，不排队。 */
.cf-petal-flower:not(.is-scattered) .cf-petal-flower-petal {
  transition-delay: var(--cf-petal-wait, 0ms);
}
.cf-petal-flower.is-scattered .cf-petal-flower-petal {
  opacity: 0;
  transform: rotate(-55deg);
}
@media (prefers-reduced-motion: reduce) {
  .cf-petal-flower,
  .cf-petal-flower-petal {
    transition: none;
  }
}
</style>
