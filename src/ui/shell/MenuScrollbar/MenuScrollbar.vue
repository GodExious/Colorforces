<script setup>
import { ref, reactive, watch, onBeforeUnmount } from 'vue';
import { translate as t } from '../../../i18n/index.js';

const props = defineProps({ viewport: Object, content: Object, visible: Boolean });
const track = ref(null),
  thumb = ref(null);
const state = reactive({ max: 0, value: 0, dragging: false });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let animation,
  fadeTarget,
  observer,
  observedViewport,
  frame,
  drag,
  targetFrame,
  lastScrollTop = 0;

// 从原生滚动范围计算滑块，短页面以整轨淡出衔接无滚动条状态。
function sync(animate = true) {
  const area = props.viewport;
  if (!area || !thumb.value || !track.value || !props.visible) return;
  const length = track.value.clientHeight;
  if (!length || !area.clientHeight) return;
  const max = Math.max(0, area.scrollHeight - area.clientHeight);
  const height =
    max > 1
      ? Math.min(length, Math.max(24, (length * area.clientHeight) / area.scrollHeight))
      : length;
  const offset =
    max > 1 ? (Math.min(max, Math.max(0, area.scrollTop)) / max) * (length - height) : 0;
  const target = {
    height: height + 'px',
    transform: `translateY(${offset}px)`,
    opacity: max > 1 ? '1' : '0',
  };
  state.max = max > 1 ? Math.ceil(max) : 0;
  state.value = Math.round(area.scrollTop);
  lastScrollTop = area.scrollTop;
  // 页面收尾也会触发尺寸观察，目标不变时不要重新播放同一段动画。
  if (
    animate &&
    targetFrame?.height === target.height &&
    targetFrame?.transform === target.transform &&
    targetFrame?.opacity === target.opacity
  )
    return;
  targetFrame = target;
  const followingContent = props.content?.querySelector(
    '.cf-tab-panel.active:not([aria-hidden="true"]) [data-cf-expanding]',
  );
  // 展开期间只更新滑块尺寸，不要每帧重启同一次淡入或淡出。
  if (animate && followingContent && animation && fadeTarget === target.opacity) {
    Object.assign(thumb.value.style, target);
    return;
  }
  const computed = getComputedStyle(thumb.value);
  const current = {
    height: computed.height,
    transform: computed.transform,
    opacity: computed.opacity,
  };
  animation?.cancel();
  animation = null;
  fadeTarget = null;
  Object.assign(thumb.value.style, target);
  if (
    !animate ||
    reducedMotion.matches ||
    state.dragging ||
    typeof thumb.value.animate !== 'function'
  )
    return;
  // 展开中的尺寸已经平滑变化，仅为有无滚动条保留独立淡入淡出。
  if (followingContent && current.opacity === target.opacity) return;
  const frames = followingContent
    ? [{ opacity: current.opacity }, { opacity: target.opacity }]
    : [current, target];
  const running = thumb.value.animate(frames, {
    duration: followingContent ? 160 : 300,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  });
  animation = running;
  fadeTarget = followingContent ? target.opacity : null;
  running.onfinish = () => {
    if (animation === running) {
      animation = null;
      fadeTarget = null;
    }
  };
}

// 内容或窗口尺寸变化时合并测量，从当前视觉位置平滑衔接新范围。
function scheduleMeasure() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => sync(true));
}

// 用户滚动立即跟手；忽略切页归零产生的重复事件，避免打断尺寸动画。
function onScroll() {
  if (animation && props.viewport?.scrollTop === lastScrollTop) return;
  sync(false);
}

// 轨道与正文是同级元素，将轨道上的滚轮输入交回正文，避免滚动失效。
function onWheel(event) {
  const area = props.viewport;
  if (!area || event.ctrlKey) return;
  event.preventDefault();
  event.stopPropagation();
  const unit =
    event.deltaMode === 2
      ? area.clientHeight
      : event.deltaMode === 1
        ? parseFloat(getComputedStyle(area).lineHeight) || 16
        : 1;
  area.scrollTop += event.deltaY * unit;
}

// 中止旧观察和交互，避免隐藏或卸载后仍保留监听。
function disconnect() {
  observer?.disconnect();
  observedViewport?.removeEventListener('scroll', onScroll);
  cancelAnimationFrame(frame);
  animation?.cancel();
  animation = null;
  fadeTarget = null;
  endDrag();
}

// 拖动只改变原生 scrollTop，不另建一套滚动状态或惯性系统。
function startDrag(event) {
  if (event.button !== 0 || !state.max) return;
  event.preventDefault();
  event.stopPropagation();
  sync(false);
  state.dragging = true;
  thumb.value.focus({ preventScroll: true });
  drag = {
    pointer: event.pointerId,
    y: event.clientY,
    top: props.viewport.scrollTop,
    travel: track.value.clientHeight - thumb.value.getBoundingClientRect().height,
  };
  thumb.value.setPointerCapture(event.pointerId);
}

// 将指针位移映射到当前页面的实际可滚动距离。
function moveDrag(event) {
  if (!drag || event.pointerId !== drag.pointer || !drag.travel) return;
  props.viewport.scrollTop = drag.top + ((event.clientY - drag.y) / drag.travel) * state.max;
}

// 松手或丢失指针捕获时恢复普通滚动条状态。
function endDrag() {
  const pointer = drag?.pointer;
  drag = null;
  state.dragging = false;
  if (pointer !== undefined && thumb.value?.hasPointerCapture(pointer))
    thumb.value.releasePointerCapture(pointer);
}

// 点击轨道时使用浏览器自身的平滑滚动定位。
function jumpTo(event) {
  if (event.button !== 0 || !state.max || event.target !== track.value) return;
  const rect = track.value.getBoundingClientRect();
  const height = Math.min(
    rect.height,
    Math.max(24, (rect.height * props.viewport.clientHeight) / props.viewport.scrollHeight),
  );
  const ratio = Math.max(
    0,
    Math.min(1, (event.clientY - rect.top - height / 2) / (rect.height - height)),
  );
  props.viewport.scrollTo({
    top: ratio * state.max,
    behavior: reducedMotion.matches ? 'instant' : 'smooth',
  });
}

// 为聚焦的滚动条提供方向键、翻页及首尾定位，正文仍保留原生键盘滚动。
function onKeydown(event) {
  const area = props.viewport;
  const destinations = {
    ArrowUp: area.scrollTop - 40,
    ArrowDown: area.scrollTop + 40,
    PageUp: area.scrollTop - area.clientHeight * 0.9,
    PageDown: area.scrollTop + area.clientHeight * 0.9,
    Home: 0,
    End: state.max,
  };
  if (!(event.key in destinations)) return;
  event.preventDefault();
  event.stopPropagation();
  area.scrollTop = destinations[event.key];
}

watch(
  () => [props.viewport, props.content, props.visible],
  () => {
    disconnect();
    observedViewport = props.viewport;
    if (!props.visible || !observedViewport || !props.content) return;
    observedViewport.addEventListener('scroll', onScroll, { passive: true });
    observer = new ResizeObserver(scheduleMeasure);
    observer.observe(observedViewport);
    observer.observe(props.content);
    sync(false);
  },
  { flush: 'post' },
);
onBeforeUnmount(disconnect);
defineExpose({ sync });
</script>
<template>
  <div
    ref="track"
    class="cf-menu-scrollbar"
    :class="{ 'is-scrollable': state.max > 0, 'is-dragging': state.dragging }"
    @pointerdown="jumpTo"
    @wheel="onWheel"
  >
    <div
      ref="thumb"
      class="cf-menu-scrollbar-thumb"
      role="scrollbar"
      aria-orientation="vertical"
      aria-controls="cf-menu-content"
      :aria-label="t('menuScrollbarLabel')"
      :aria-valuemin="0"
      :aria-valuemax="state.max"
      :aria-valuenow="Math.min(state.max, state.value)"
      :aria-hidden="!state.max"
      :tabindex="state.max ? 0 : -1"
      @pointerdown="startDrag"
      @pointermove="moveDrag"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @lostpointercapture="endDrag"
      @keydown="onKeydown"
    ></div>
  </div>
</template>
<style scoped>
.cf-menu-scrollbar {
  position: absolute;
  top: 6px;
  bottom: 6px;
  right: 0;
  width: 10px;
  z-index: 3;
  pointer-events: none;
  touch-action: none;
}
.cf-menu-scrollbar.is-scrollable {
  pointer-events: auto;
}
.cf-menu-scrollbar-thumb {
  position: absolute;
  top: 0;
  right: 1px;
  width: 5px;
  height: 100%;
  border-radius: var(--cf-radius-xs);
  background: var(--cf-gray-300);
  opacity: 0;
  cursor: grab;
  touch-action: none;
}
.cf-menu-scrollbar-thumb:hover,
.is-dragging .cf-menu-scrollbar-thumb {
  background: var(--cf-gray-400);
}
.is-dragging .cf-menu-scrollbar-thumb {
  cursor: grabbing;
}
.cf-menu-scrollbar-thumb:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 1px;
}
</style>
