<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
// 数值变化时从旧值滚到新值，而不是直接跳变。format 决定怎么把数值写成文字。
const props = defineProps({
  value: { type: Number, default: null },
  format: { type: Function, default: (value) => String(Math.round(value)) },
  // 没有数值时显示的文字。
  empty: { type: String, default: '' },
});
const DURATION = 420;
const shown = ref(props.value);
let frame = 0;
function stop() {
  cancelAnimationFrame(frame);
  frame = 0;
}
watch(
  () => props.value,
  (to) => {
    stop();
    const from = shown.value;
    // 从无到有、从有到无，或用户要求减少动效时，直接显示结果。
    if (
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      document.hidden ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      shown.value = to;
      return;
    }
    // 起点取第一帧自己的时间戳，不用这里的当前时间。
    // 帧的时间戳是这一帧「该开始」的时刻，页面忙的时候它会比当前时间早很多；
    // 两者相减得到的进度是负数，代入缓动公式会让数字先朝反方向冲出去一大截（能冲到范围之外），再折回来。
    let start = null;
    const step = (now) => {
      start ??= now;
      const progress = Math.min(1, Math.max(0, (now - start) / DURATION));
      shown.value = progress === 1 ? to : from + (to - from) * (1 - (1 - progress) ** 3);
      frame = progress === 1 ? 0 : requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  },
);
onBeforeUnmount(stop);
</script>

<template>
  <span class="cf-analytics-number">{{ Number.isFinite(shown) ? format(shown) : empty }}</span>
</template>

<style>
.cf-analytics-number {
  font-variant-numeric: tabular-nums;
}
</style>
