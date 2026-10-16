<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { magnet, springStep, settled, keepSamples, releaseVelocity } from './physics.js';
import { EDGE, paintPixels } from './pixels.js';
// 一档一档的强度条（照 Claude 的强度条做，放在幻彩弹窗里用）：浅灰的圆角条，白色圆角方块滑块，档位是小点、最后一个是紫的。
// 一档比一档浓：滑块左边填过的那段从第二档起冒出一闪一闪的像素，越往上越密、越紫、越亮，最后一档铺满整条；
// 走过的档位点慢慢被盖住，滑块外圈一圈淡紫光慢慢变浓。这些都跟着滑块的位置连续变，拖着、弹着的时候也是。
// 拖着时靠近档位被轻轻吸住，松手像弹簧一样弹到最近的档；点哪弹到哪；方向键、Home、End 也能调。
//   modelValue  现在是第几档（min～max 的整数）。拖动时一过半档就跟着变（上面的标题能跟着换）
//   moving      像素闪不闪、亮带流不流（动效关了就停在一帧上）
//   label       给读屏的名字；valueText 读出来的档位文字
// 事件 progress：滑块走了多远（0～1，连续变），用的地方拿去给标题之类的跟着变色。
const props = defineProps({
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 1 },
  max: { type: Number, default: 5 },
  moving: { type: Boolean, default: true },
  label: { type: String, default: '' },
  valueText: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'progress']);
const span = computed(() => props.max - props.min);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

// 滑块在第几档（从 0 数，可以在两档之间）。
const position = ref(props.modelValue - props.min);
const progress = computed(() => (span.value > 0 ? position.value / span.value : 0));
const level = computed(() => props.min + Math.round(position.value));
function moveTo(value) {
  position.value = Math.min(span.value, Math.max(0, value));
  dirty = true;
  schedulePaint();
}
watch(level, (value) => value !== props.modelValue && emit('update:modelValue', value));
watch(progress, (value) => emit('progress', value), { immediate: true });
// 外面改了档（恢复默认之类）：弹过去。
watch(
  () => props.modelValue,
  (value) => {
    if (value !== level.value && !dragging.value) springTo(value - props.min);
  },
);

// —— 弹簧 ——
let springFrame = 0;
function springTo(target, velocity = 0) {
  cancelAnimationFrame(springFrame);
  springFrame = 0;
  if (reduced.matches) return moveTo(target);
  let speed = velocity;
  let previous = performance.now();
  const step = (time) => {
    const delta = Math.min((time - previous) / 1000, 0.032);
    previous = time;
    const next = springStep(position.value, speed, target, delta);
    speed = next.velocity;
    moveTo(next.position);
    if (settled(position.value, speed, target)) {
      springFrame = 0;
      return moveTo(target);
    }
    springFrame = requestAnimationFrame(step);
  };
  springFrame = requestAnimationFrame(step);
}

// —— 拖动 ——
// 按下时 preventDefault：不让浏览器开始选字，接下来的拖动就不会变成「拖动选中的文字」（那样滑条收到取消，拖不动）。
// 指针捕获在滑条上，拖出去也照样跟着。按下就弹到指针那里；拖过 3px 才算拖，跟手（带吸附）；
// 松手按甩出去的速度弹到最近的档，只是点了一下就弹到点的那一档。取消（比如切走了窗口）时从最后的位置弹。
const track = ref(null);
const dragging = ref(false);
let press = null; // { startX, value, samples }
const valueAt = (x) => {
  const box = track.value.getBoundingClientRect();
  const share = (x - box.left - EDGE) / Math.max(1, box.width - EDGE * 2);
  return Math.min(1, Math.max(0, share)) * span.value;
};
function down(event) {
  if (event.button !== 0) return;
  event.preventDefault();
  track.value.focus({ preventScroll: true });
  track.value.setPointerCapture(event.pointerId);
  const value = valueAt(event.clientX);
  press = { startX: event.clientX, value, samples: [{ time: performance.now(), value }] };
  springTo(magnet(value));
}
function move(event) {
  if (!press) return;
  if (!dragging.value) {
    if (Math.abs(event.clientX - press.startX) < 3) return;
    dragging.value = true;
    cancelAnimationFrame(springFrame);
    springFrame = 0;
  }
  const value = magnet(valueAt(event.clientX));
  press.samples = keepSamples(press.samples, performance.now(), value);
  moveTo(value);
}
function up() {
  if (!press) return;
  const { value, samples } = press;
  const moved = dragging.value;
  press = null;
  dragging.value = false;
  springTo(Math.round(moved ? position.value : value), moved ? releaseVelocity(samples) : 0);
}
function key(event) {
  const now = Math.round(position.value);
  const steps = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 };
  let target;
  if (event.key in steps) target = now + steps[event.key];
  else if (event.key === 'Home') target = 0;
  else if (event.key === 'End') target = span.value;
  else return;
  event.preventDefault();
  springTo(Math.min(span.value, Math.max(0, target)));
}

// —— 像素 ——
// 动效开着：一直画，每秒 30 次左右，各格的闪和亮带往前走；关着：只在位置变了、大小变了时画一次，停在那一帧上。
// 亮带的速度跟着档位变，所以按帧累加，换档时不会跳。
const canvas = ref(null);
let paintFrame = 0;
let lastPaint = 0;
let clock = 1600;
let flow = 0;
let dirty = true;
const animating = () => props.moving && !reduced.matches;
function schedulePaint() {
  if (!paintFrame && canvas.value) paintFrame = requestAnimationFrame(paint);
}
function paint(time) {
  paintFrame = 0;
  const element = canvas.value;
  if (!element) return;
  if (animating() && time - lastPaint < 33 && !dirty) return schedulePaint();
  const delta = lastPaint && animating() ? Math.min(time - lastPaint, 100) : 0;
  lastPaint = time;
  clock += delta;
  flow += (delta / 4000) * (0.4 + 0.6 * progress.value);
  // 按布局的大小量（弹出层刚出现时缩着一点，getBoundingClientRect 会量小）。
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  if (element.width !== Math.round(width * ratio)) element.width = Math.round(width * ratio);
  if (element.height !== Math.round(height * ratio)) element.height = Math.round(height * ratio);
  const context = element.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  paintPixels(context, { width, height, progress: progress.value, elapsed: clock, flow });
  dirty = false;
  if (animating()) schedulePaint();
}
watch(
  () => props.moving,
  () => {
    dirty = true;
    schedulePaint();
  },
);

defineExpose({ focus: () => track.value?.focus({ preventScroll: true }) });
onMounted(schedulePaint);
onBeforeUnmount(() => {
  cancelAnimationFrame(springFrame);
  cancelAnimationFrame(paintFrame);
  springFrame = paintFrame = 0;
});
</script>
<template>
  <div
    ref="track"
    class="cf-effort"
    :class="{ 'is-max': progress >= 0.999, 'is-dragging': dragging, 'is-moving': moving }"
    role="slider"
    tabindex="0"
    :aria-label="label || null"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuenow="level"
    :aria-valuetext="valueText || null"
    :style="{ '--cf-effort-p': progress }"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="up"
    @pointercancel="up"
    @lostpointercapture="up"
    @keydown="key"
    @dragstart.prevent
  >
    <span
      v-for="index in span + 1"
      :key="index"
      class="cf-effort-stop"
      :class="{ 'is-passed': index - 1 <= position + 0.001, 'is-last': index === span + 1 }"
      :style="{ left: `calc(${EDGE}px + (100% - ${EDGE * 2}px) * ${(index - 1) / span})` }"
    ></span>
    <span class="cf-effort-layer cf-effort-fill"></span>
    <span class="cf-effort-layer cf-effort-tint"></span>
    <span class="cf-effort-layer cf-effort-sheen"></span>
    <canvas ref="canvas" class="cf-effort-canvas" aria-hidden="true"></canvas>
    <span class="cf-effort-thumb"></span>
  </div>
</template>
<style>
/* 滑条：圆角 10px 的浅灰条；滑块圆心和档位点都按 13px + (宽 - 26px) × 进度摆，填过的部分到滑块圆心为止。
   --cf-effort-p 是滑块走了多远（0～1），各层按它裁、按它变浓。整条不让选字（拖的时候不会先选中文字）。 */
.cf-effort {
  --cf-effort-cut: calc((100% - 26px) * (1 - var(--cf-effort-p)) + 13px);
  position: relative;
  height: 28px;
  border-radius: var(--cf-radius-lg);
  outline: none;
  background: #eceef6;
  box-shadow: inset 0 1px 1px #3a43660f;
  cursor: pointer;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}
.cf-effort.is-dragging {
  cursor: grabbing;
}
.cf-effort:focus-visible {
  box-shadow:
    inset 0 1px 1px #3a43660f,
    0 0 0 3px color-mix(in srgb, #9d8be0 35%, transparent);
}
/* 到最后一档：整条连同滑块后面那一点都换成浅灰到淡紫的底。 */
.cf-effort::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    #eceef6 0%,
    #e0ddf0 32%,
    #d7d0ec 48%,
    #cec2e6 68%,
    #c8b9e3 100%
  );
  opacity: 0;
  transition: opacity 340ms ease-in;
}
.cf-effort.is-max::before {
  opacity: 1;
}
/* 档位点：小灰点，最后一个是紫的；走过的跟着档数一起淡（被像素盖住），到最后一档全没了。 */
.cf-effort-stop {
  position: absolute;
  z-index: 1;
  top: 50%;
  width: 4px;
  height: 4px;
  margin: -2px 0 0 -2px;
  border-radius: 50%;
  background: #b4b9cc;
  opacity: 0.82;
  transition: opacity var(--cf-duration-fast) var(--cf-ease-out);
}
.cf-effort-stop.is-last {
  background: #9d8be0;
  opacity: 1;
}
.cf-effort-stop.is-passed {
  opacity: calc(0.82 * (1 - var(--cf-effort-p)));
}
/* 填过的那段：灰的底，上面一层浅灰到淡紫（整条宽的渐变按填充裁出来，越往后越显），再一层隔一会儿扫过的淡光
   （只在像素还很少时有，之后让给像素）。 */
.cf-effort-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  clip-path: inset(
    0 var(--cf-effort-cut) 0 0 round calc(var(--cf-radius-lg) - 1px) 0 0
      calc(var(--cf-radius-lg) - 1px)
  );
  pointer-events: none;
}
.cf-effort-fill {
  background: #dfe2ef;
}
.cf-effort-tint {
  background: linear-gradient(
    90deg,
    #e2e3f1 0%,
    #ddd9f0 30%,
    #d4cbec 60%,
    #cbbde6 85%,
    #c8b9e3 100%
  );
  opacity: calc(var(--cf-effort-p) * 0.9 + 0.1 * var(--cf-effort-p) * var(--cf-effort-p));
}
.cf-effort-sheen {
  opacity: calc(1 - var(--cf-effort-p) * 2);
}
.cf-effort-sheen::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -40%;
  width: 40%;
  background: linear-gradient(100deg, transparent, #ffffffa6, transparent);
  opacity: 0;
}
.cf-effort.is-moving .cf-effort-sheen::before {
  opacity: 1;
  animation: cf-effort-sheen 4.2s ease-in-out infinite;
}
@keyframes cf-effort-sheen {
  0%,
  55% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(360%);
  }
}
.cf-effort-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  pointer-events: none;
}
/* 滑块：白色圆角方块，细边、轻影；外圈一圈淡紫光跟着档数变浓。悬停时光圈稍大，按住时缩一点。 */
.cf-effort-thumb {
  position: absolute;
  z-index: 2;
  top: 50%;
  left: calc(13px + (100% - 26px) * var(--cf-effort-p));
  width: 24px;
  height: 26px;
  margin: -13px 0 0 -12px;
  border: 1px solid #3a436621;
  border-radius: var(--cf-radius-md);
  background: var(--cf-white-surface);
  box-sizing: border-box;
  box-shadow:
    0 1px 2px #3a436614,
    0 4px 10px #3a43660e,
    0 0 0 calc(var(--cf-effort-p) * 3px)
      color-mix(in srgb, #9d8be0 calc(var(--cf-effort-p) * 32%), transparent);
  pointer-events: none;
  transition:
    box-shadow var(--cf-duration-base) ease,
    transform var(--cf-duration-base) var(--cf-ease-out);
}
.cf-effort:hover .cf-effort-thumb {
  box-shadow:
    0 1px 2px #3a436614,
    0 4px 10px #3a43660e,
    0 0 0 3px color-mix(in srgb, #9d8be0 calc(22% + var(--cf-effort-p) * 14%), transparent);
}
.cf-effort.is-dragging .cf-effort-thumb {
  transform: scale(0.96);
}
@media (prefers-reduced-motion: reduce) {
  .cf-effort::before,
  .cf-effort-stop,
  .cf-effort-thumb {
    transition: none;
  }
  .cf-effort.is-moving .cf-effort-sheen::before {
    animation: none;
    opacity: 0;
  }
}
</style>
