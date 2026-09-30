<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { colorforcesMark, colorforcesAuroraMark } from '../../../assets/index.js';
import { translate as t } from '../../../i18n/index.js';
import InlineSvg from '../../components/icons/InlineSvg/InlineSvg.vue';
import { tooltip } from '../../components/tooltips/FloatingTooltip/FloatingTooltip.vue';
// 旧版轻纱效果保留为 aurora；默认同色花瓣，不新增用户设置。
const props = defineProps({
  open: Boolean,
  dragging: Boolean,
  appearance: {
    type: String,
    default: 'flower',
    validator: (value) => ['flower', 'aurora'].includes(value),
  },
});
const emit = defineEmits(['toggle']);
const button = ref(null);
const resting = ref(document.hidden);
const transitions = new Set();
const flowerReturns = new Set();
let motionPreference;
// 清理尚未结束的归位动画，避免连续开合叠加旧角度。
function stopFlowerReturn() {
  flowerReturns.forEach((animation) => animation.cancel());
  flowerReturns.clear();
}
// 收起后恢复 Logo 原姿态；归位中再次展开则从当前角度继续转动。
function restoreFlowerPose(open) {
  const art = button.value?.querySelector('.cf-launcher-art');
  if (!art) return;
  const layers = [art, ...art.querySelectorAll('.cf-launcher-motion')];
  const poses = layers.map((layer) => getComputedStyle(layer).transform);
  stopFlowerReturn();
  if (open) {
    const matrix = new DOMMatrixReadOnly(poses[0] === 'none' ? undefined : poses[0]);
    const angle = (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
    art.style.setProperty('--cf-launcher-turn-start', `${angle}deg`);
    return;
  }
  if (document.hidden || motionPreference?.matches) return;
  layers.forEach((layer, index) => {
    if (poses[index] === 'none') return;
    const animation = layer.animate([{ transform: poses[index] }, { transform: 'none' }], {
      duration: 780,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    });
    flowerReturns.add(animation);
    animation.finished.then(
      () => {
        animation.cancel();
        flowerReturns.delete(animation);
      },
      () => {},
    );
  });
}
// 取消尚未结束的收放动画，释放动画对节点样式的占用。
function stopPetalTransition() {
  transitions.forEach((animation) => animation.cancel());
  transitions.clear();
}
// 出发与循环分属两层，连续点击时从当前姿态接续，不在末帧跳回。
function animatePetals(open) {
  if (!button.value) return;
  const petals = [...button.value.querySelectorAll('.cf-flower-launch, .cf-current-entry')];
  const interrupted = transitions.size > 0;
  const before = petals.map((petal) => {
    const style = getComputedStyle(petal);
    return { transform: style.transform, opacity: style.opacity };
  });
  stopPetalTransition();
  if (document.hidden || motionPreference?.matches) return;
  petals.forEach((petal, index) => {
    const arriving = petal.classList.contains('cf-flower-launch') !== open;
    const neutral = { transform: 'none', opacity: 1 };
    let frames;
    if (arriving) {
      frames = [
        interrupted
          ? before[index]
          : { transform: `translateY(${open ? 5 : -4}px) scale(0.76)`, opacity: 0 },
        { transform: 'translateY(-0.8px) scale(1.035)', opacity: 1, offset: 0.74 },
        neutral,
      ];
    } else {
      frames = [
        interrupted ? before[index] : neutral,
        { transform: 'translateY(1px) scale(0.94)', opacity: 0.9, offset: 0.18 },
        {
          transform: open ? 'translateY(-6px) scale(0.97, 0.9)' : 'translateY(4px) scale(0.78)',
          opacity: 0,
        },
      ];
    }
    // 离场填充保留到父层完全隐藏，防止清理时在最后几帧闪回。
    const animation = petal.animate(frames, {
      duration: arriving ? (open ? 660 : 480) : open ? 540 : 480,
      delay: (index % 8) * (arriving ? 16 : 8),
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'both',
    });
    transitions.add(animation);
    animation.finished.then(
      () => {
        animation.cancel();
        transitions.delete(animation);
      },
      () => {},
    );
  });
}
// 复用现有提示控制器，仅给入口使用轻量侧边胶囊。
function showHint() {
  if (props.dragging) return;
  tooltip.show(button.value, t(props.open ? 'launcherCloseHint' : 'launcherOpenHint'), {
    variant: 'launcher',
  });
}
// 点击或键盘展开前收起提示，避免指引遮住刚打开的菜单。
function toggle() {
  tooltip.hide();
  emit('toggle');
}
// 后台标签页暂停所有循环，不增加逐帧 JavaScript 工作。
function updateVisibility() {
  resting.value = document.hidden;
  if (resting.value) {
    stopPetalTransition();
    stopFlowerReturn();
    tooltip.hide();
  }
}
// 在开合类名更新前读取旧姿态，避免先归零再补动画造成闪跳。
watch(
  () => [props.open, props.appearance],
  ([open, appearance]) => {
    if (appearance === 'flower') restoreFlowerPose(open);
    else stopFlowerReturn();
  },
  { flush: 'pre' },
);
watch(
  () => [props.open, props.appearance],
  ([open, appearance]) => {
    tooltip.hide();
    if (appearance === 'aurora') animatePetals(open);
    else stopPetalTransition();
  },
  { flush: 'post' },
);
onMounted(() => {
  motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  motionPreference.addEventListener('change', stopPetalTransition);
  motionPreference.addEventListener('change', stopFlowerReturn);
  document.addEventListener('visibilitychange', updateVisibility);
});
onBeforeUnmount(() => {
  stopPetalTransition();
  stopFlowerReturn();
  motionPreference?.removeEventListener('change', stopPetalTransition);
  motionPreference?.removeEventListener('change', stopFlowerReturn);
  document.removeEventListener('visibilitychange', updateVisibility);
});
</script>
<template>
  <div
    id="cf-ratings-settings-btn"
    ref="button"
    :class="{ 'is-open': open, 'is-resting': resting, 'is-flower': appearance === 'flower' }"
    role="button"
    tabindex="0"
    :aria-expanded="open"
    :aria-label="t(open ? 'launcherCloseHint' : 'launcherOpenHint')"
    :aria-describedby="
      tooltip.state.visible && tooltip.state.variant === 'launcher'
        ? 'cf-floating-tooltip'
        : undefined
    "
    @mouseenter="showHint"
    @mouseleave="tooltip.hide()"
    @focus="showHint"
    @blur="tooltip.hide()"
    @keydown.escape="tooltip.hide()"
    @click="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <InlineSvg
      :source="appearance === 'aurora' ? colorforcesAuroraMark : colorforcesMark"
      id-prefix="cf-launcher"
    />
  </div>
</template>
<style>
@property --cf-launcher-open {
  syntax: '<percentage>';
  inherits: true;
  initial-value: 0%;
}
@property --cf-wind-phase {
  syntax: '<angle>';
  inherits: true;
  initial-value: 0deg;
}
@property --cf-launcher-accent {
  syntax: '<color>';
  inherits: true;
  initial-value: #5576df;
}
#cf-ratings-settings-btn {
  --cf-launcher-accent: var(--cf-menu-accent);
  --cf-aurora-color: var(--cf-launcher-accent);
  --cf-aurora-light: color-mix(in srgb, var(--cf-launcher-accent) 46%, #e9f5fb);
  --cf-aurora-deep: color-mix(in srgb, var(--cf-launcher-accent) 74%, #192849);
  --cf-aurora-glow: color-mix(in srgb, var(--cf-launcher-accent) 65%, var(--cf-menu-secondary));
  width: 44px !important;
  height: 44px !important;
  position: relative;
  overflow: visible;
  display: grid !important;
  place-items: center;
  box-sizing: border-box !important;
  isolation: isolate;
  border: 0 !important;
  border-radius: 50% !important;
  background: conic-gradient(
    from -35deg,
    #ffd7e8,
    #ffe6c5,
    #d8f0e0,
    #cfeaf7,
    #e1d8f8,
    #ffd7e8
  ) !important;
  box-shadow:
    0 2px 8px #71669324,
    0 1px 2px #7166931f;
  cursor: pointer !important;
  user-select: none !important;
  transition:
    --cf-launcher-accent 480ms ease,
    transform 240ms ease,
    box-shadow 480ms ease;
}
/* 外圈保留纤细玻璃高光，颜色过渡沿用菜单主题，不再额外混入异色。 */
#cf-ratings-settings-btn::before,
#cf-ratings-settings-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}
#cf-ratings-settings-btn::before {
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--cf-launcher-accent) 12%, #f7fbff),
    color-mix(in srgb, var(--cf-launcher-accent) 28%, #eaf0fa)
  );
  opacity: 0;
  transition: opacity 480ms ease;
}
#cf-ratings-settings-btn::after {
  z-index: 2;
  background: radial-gradient(ellipse at 26% 9%, #ffffff78, transparent 43%);
  box-shadow:
    inset 0 0 0 1px #ffffff85,
    inset 0 -1px 2px #4e517521;
}
#cf-ratings-settings-btn:hover {
  transform: translateY(-0.5px);
  box-shadow: 0 3px 11px #71669330;
}
#cf-ratings-settings-btn:not(.is-open):is(:hover, :focus-visible) .cf-launcher-flower {
  /* 与初态保持相同变换列表，避免整圈旋转被矩阵插值视作静止。 */
  transform: scale(1) rotate(360deg);
}
#cf-ratings-settings-btn.is-open {
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--cf-menu-accent) 25%, transparent),
    0 3px 13px color-mix(in srgb, var(--cf-menu-accent) 27%, transparent);
}
#cf-ratings-settings-btn.is-open::before {
  opacity: 1;
}
#cf-ratings-settings-btn.is-open::after {
  background: radial-gradient(ellipse at 26% 9%, #ffffff30, transparent 43%);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--cf-launcher-accent) 36%, transparent),
    inset 0 -1px 2px color-mix(in srgb, var(--cf-launcher-accent) 18%, transparent);
}
#cf-ratings-settings-btn:active {
  transform: scale(0.96);
}
#cf-ratings-settings-btn:focus-visible {
  outline: 2px solid var(--cf-menu-accent);
  outline-offset: 3px;
}
.cf-launcher-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
  overflow: visible;
}
.cf-launcher-flower,
.cf-launcher-current,
.cf-flower-launch,
.cf-current-entry,
.cf-launcher-motion {
  transform-box: view-box;
  transform-origin: 22px 22px;
}
.cf-launcher-flower,
.cf-launcher-current {
  transition:
    transform 780ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 420ms ease;
}
.cf-launcher-flower {
  transform: scale(1) rotate(0deg);
  opacity: 1;
}
.cf-launcher-current {
  transform: scale(0.96) rotate(-6deg);
  opacity: 0;
}
#cf-ratings-settings-btn.is-open .cf-launcher-flower {
  transform: scale(1) rotate(360deg);
  opacity: 0;
  transition:
    transform 580ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 380ms ease 80ms;
}
#cf-ratings-settings-btn.is-open .cf-launcher-current {
  transform: scale(1) rotate(0deg);
  opacity: 1;
}
/* 八瓣保持可辨识的轮廓，只轻微错峰呼吸，不把花朵转成加载图标。 */
.cf-flower-sway {
  animation: cf-flower-sway 16s ease-in-out infinite;
}
.cf-flower-petal {
  animation: cf-flower-breathe 6s ease-in-out var(--cf-petal-delay) infinite;
}
.cf-flower-petal use {
  stroke: #ffffff60;
  stroke-width: 0.35;
}
/* 所有花瓣共享全局风向；只有受风强度不同，不再各自反向摆动。 */
.cf-current-petals {
  /* 连续主风叠加轻微阵风，转向和循环处速度连续，避免逐段缓停。 */
  --cf-wind-x: calc(3.2 * sin(var(--cf-wind-phase)) + 0.45 * sin(var(--cf-wind-phase) * 2));
  --cf-wind-y: calc(
    -0.85 * sin(var(--cf-wind-phase)) + 0.8 * sin(var(--cf-wind-phase) * 2) + 0.25 *
      sin(var(--cf-wind-phase) * 3)
  );
  animation: cf-current-wind 6.6s linear infinite;
}
.cf-current-petals > g:nth-child(1) {
  --cf-wind-cos: 1;
  --cf-wind-sin: 0;
  --cf-wind-response: 1;
}
.cf-current-petals > g:nth-child(2) {
  --cf-wind-cos: 0.70710678;
  --cf-wind-sin: 0.70710678;
  --cf-wind-response: 0.94;
}
.cf-current-petals > g:nth-child(3) {
  --cf-wind-cos: 0;
  --cf-wind-sin: 1;
  --cf-wind-response: 1.08;
}
.cf-current-petals > g:nth-child(4) {
  --cf-wind-cos: -0.70710678;
  --cf-wind-sin: 0.70710678;
  --cf-wind-response: 0.88;
}
.cf-current-petals > g:nth-child(5) {
  --cf-wind-cos: -1;
  --cf-wind-sin: 0;
  --cf-wind-response: 0.92;
}
.cf-current-petals > g:nth-child(6) {
  --cf-wind-cos: -0.70710678;
  --cf-wind-sin: -0.70710678;
  --cf-wind-response: 1.02;
}
.cf-current-petals > g:nth-child(7) {
  --cf-wind-cos: 0;
  --cf-wind-sin: -1;
  --cf-wind-response: 0.9;
}
.cf-current-petals > g:nth-child(8) {
  --cf-wind-cos: 0.70710678;
  --cf-wind-sin: -0.70710678;
  --cf-wind-response: 1.05;
}
/* 反向投影抵消 SVG 各瓣的旋转，使瓣尖沿同一屏幕方向受风，根部保持固定。 */
.cf-current-petal {
  animation: none;
  --cf-local-wind-x: calc(
    (var(--cf-wind-x) * var(--cf-wind-cos) + var(--cf-wind-y) * var(--cf-wind-sin)) *
      var(--cf-wind-response)
  );
  --cf-local-wind-y: calc(
    (var(--cf-wind-y) * var(--cf-wind-cos) - var(--cf-wind-x) * var(--cf-wind-sin)) *
      var(--cf-wind-response)
  );
  transform-origin: 22px 24px;
  transform: matrix(
    1,
    0,
    calc(var(--cf-local-wind-x) / -18),
    calc(1 - var(--cf-local-wind-y) / 18),
    0,
    0
  );
}
.cf-current-sheet {
  animation: none;
  transform-origin: 22px 24px;
  transform: matrix(
    1,
    0,
    calc(var(--cf-local-wind-x) * -0.28 / 18),
    calc(1 - var(--cf-local-wind-y) * 0.28 / 18),
    0,
    0
  );
}
.cf-current-glint {
  animation: cf-current-glint 3.8s ease-in-out var(--cf-flow-delay) infinite;
}
.cf-current-glow,
.cf-current-core {
  animation: cf-current-breathe 3.8s ease-in-out infinite;
}
#cf-ratings-settings-btn:not(.is-open) .cf-launcher-current .cf-launcher-motion,
#cf-ratings-settings-btn.is-open .cf-launcher-flower .cf-launcher-motion,
#cf-ratings-settings-btn.is-resting .cf-launcher-motion {
  animation-play-state: paused;
}
/* 新版只给原八瓣染色，不交叉淡化，也不切换成另一套图案。 */
#cf-ratings-settings-btn.is-flower {
  --cf-launcher-open: 0%;
  transition:
    --cf-launcher-open 680ms cubic-bezier(0.22, 0.7, 0.2, 1),
    --cf-launcher-accent 480ms ease,
    transform 240ms ease,
    box-shadow 480ms ease;
}
#cf-ratings-settings-btn.is-flower.is-open {
  --cf-launcher-open: 100%;
}
#cf-ratings-settings-btn.is-flower .cf-flower-petal > use:first-child {
  fill: color-mix(
    in srgb,
    var(--cf-petal-color),
    var(--cf-launcher-accent) var(--cf-launcher-open)
  );
}
#cf-ratings-settings-btn.is-flower.is-open .cf-launcher-flower {
  opacity: 1;
  transform: scale(1) rotate(360deg);
  transition: transform 780ms cubic-bezier(0.22, 1, 0.36, 1);
}
#cf-ratings-settings-btn.is-flower.is-open .cf-launcher-flower .cf-launcher-motion {
  animation-play-state: running;
}
/* 外层只在展开时慢转；收起后回到标准姿态，不累积到内层悬停旋转。 */
#cf-ratings-settings-btn.is-flower .cf-launcher-art {
  transform-origin: 50% 50%;
  transform: rotate(0deg);
}
#cf-ratings-settings-btn.is-flower.is-open .cf-launcher-art {
  animation: cf-launcher-flower-turn 24s linear infinite;
}
#cf-ratings-settings-btn.is-flower:not(.is-open) .cf-launcher-motion {
  animation: none;
  transform: none;
}
#cf-ratings-settings-btn.is-flower.is-resting .cf-launcher-art,
#cf-ratings-settings-btn.is-flower.is-resting .cf-launcher-flower .cf-launcher-motion {
  animation-play-state: paused;
}
@keyframes cf-launcher-flower-turn {
  from {
    transform: rotate(var(--cf-launcher-turn-start, 0deg));
  }
  to {
    transform: rotate(calc(var(--cf-launcher-turn-start, 0deg) + 360deg));
  }
}
@keyframes cf-flower-sway {
  0%,
  100% {
    transform: rotate(-5deg);
  }
  50% {
    transform: rotate(5deg);
  }
}
@keyframes cf-flower-breathe {
  0%,
  100% {
    transform: scale(0.96, 0.97);
  }
  50% {
    transform: scale(1, 1.025);
  }
}
@keyframes cf-current-wind {
  from {
    --cf-wind-phase: 0deg;
  }
  to {
    --cf-wind-phase: 360deg;
  }
}
@keyframes cf-current-glint {
  0%,
  100% {
    opacity: 0.2;
  }
  50% {
    opacity: 0.75;
  }
}
@keyframes cf-current-breathe {
  0%,
  100% {
    transform: scale(0.88);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  #cf-ratings-settings-btn.is-flower .cf-launcher-art,
  #cf-ratings-settings-btn.is-flower.is-open .cf-launcher-art {
    animation: none;
  }
  #cf-ratings-settings-btn.is-flower,
  #cf-ratings-settings-btn.is-flower.is-open .cf-launcher-flower {
    transition: none;
  }
  #cf-ratings-settings-btn.is-flower.is-open .cf-launcher-flower {
    transform: none;
  }
  #cf-ratings-settings-btn .cf-launcher-motion {
    animation: none;
  }
  #cf-ratings-settings-btn,
  #cf-ratings-settings-btn::before,
  .cf-launcher-flower,
  .cf-launcher-current,
  #cf-ratings-settings-btn.is-open .cf-launcher-flower {
    transition: none;
  }
  #cf-ratings-settings-btn:not(.is-open):is(:hover, :focus-visible) .cf-launcher-flower {
    transform: none;
  }
}
</style>
