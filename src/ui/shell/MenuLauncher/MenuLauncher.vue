<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { colorforcesMark, colorforcesAuroraMark } from '../../../assets/index.js';
import { translate as t } from '../../../i18n/index.js';
import InlineSvg from '../../components/icons/InlineSvg/InlineSvg.vue';
import { tooltip } from '../../components/tooltips/FloatingTooltip/FloatingTooltip.vue';
import { PETAL_COLORS, petalColor } from '../../../utils/petal-palette.js';
// 旧版轻纱效果保留为 aurora；默认是花瓣聚光，不新增用户设置。
const props = defineProps({
  open: Boolean,
  dragging: Boolean,
  // 当前页在花瓣色环上的位置（第几片花瓣，可以是小数）。
  spot: { type: Number, default: 0 },
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
let motionPreference;
// 窄扇形聚光：亮度向两侧延伸约一片半花瓣，其余花瓣只留一成多的不透明度，紧邻的两片也压得较暗。
const FAN_SPREAD = 1.4;
const FAN_FLOOR = 0.13;
const FAN_CURVE = 1.5;
/*
 * 花的转角（度），由这里记着、写进一个变量，样式只管照着转。
 * 规矩：收起时花总是正的（转角是整圈数）。鼠标移上来正着转一整圈，移开倒着转回去；
 * rest 是鼠标不在按钮上时该停的那个整圈，悬停着就停在它后面一圈。
 * 展开时从悬停的那一圈接着往前转到指向当前页的角度，收起时再往前转回正的，都不倒转。
 * 原来悬停是靠样式在 0 和 360 度之间切换的，悬停着点开时会先倒转一圈再转过来。
 */
let angle = 0;
let rest = 0;
let hovered = false;
const sector = () => 360 / PETAL_COLORS.length;
function turnTo(value) {
  angle = value;
  button.value?.style.setProperty('--cf-launcher-angle', `${angle}deg`);
}
// 从 from 往前转，转到最亮的那片朝正上方为止。
function aimFrom(from) {
  const target = -props.spot * sector();
  return target + Math.ceil((from - target) / 360) * 360;
}
function hoverIn() {
  hovered = true;
  if (!props.open && !props.dragging) turnTo(rest + 360);
  showHint();
}
function hoverOut() {
  hovered = false;
  if (!props.open) turnTo(rest);
  tooltip.hide();
}
// 收起：往前转到最近的整圈。鼠标还在按钮上就算停在悬停的那一圈，移开时照常倒转一圈回去。
function settle() {
  const upright = Math.ceil(angle / 360) * 360;
  rest = hovered ? upright - 360 : upright;
  turnTo(upright);
}
// 菜单展开时，花用明暗指出当前页：离当前位置最近的那片最亮，并直接换成当前页的准确颜色；
// 整朵花再转动，把最亮的那片转到正上方。这里算好每片的亮度；展开着换页时顺带把花转过去。
function lightPetals() {
  const root = button.value;
  if (!root) return;
  const size = PETAL_COLORS.length;
  const lead = Math.round(props.spot) % size;
  root.querySelectorAll('.cf-flower-petal').forEach((petal, index) => {
    const gap = Math.abs(index - props.spot) % size;
    const lit = Math.max(0, 1 - Math.min(gap, size - gap) / FAN_SPREAD);
    const light = index === lead ? 1 : FAN_FLOOR + (1 - FAN_FLOOR) * Math.pow(lit, FAN_CURVE);
    petal.style.setProperty('--cf-petal-light', light.toFixed(3));
    // 最亮的那片用当前页的准确颜色，是个固定值，不取正在渐变的主题色，免得两段过渡叠在一起。
    if (index === lead) petal.style.setProperty('--cf-petal-lit', petalColor(props.spot));
    else petal.style.removeProperty('--cf-petal-lit');
    petal.toggleAttribute('data-cf-lead', index === lead);
  });
  // 展开着换页：走最近的方向，避免从最后一页回到第一页时倒转一整圈。
  if (props.open) {
    const target = -props.spot * sector();
    turnTo(target + Math.round((angle - target) / 360) * 360);
  }
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
// 提示在鼠标停在按钮上（或键盘焦点在按钮上）时一直留着：点一下不收起，只把「打开」换成「收起」（见下面对 open 的监听）。
function toggle() {
  emit('toggle');
}
// 鼠标点按钮之后焦点会被放掉（见 App.vue）。鼠标还停在按钮上时提示留着。
function blurred() {
  if (!hovered) tooltip.hide();
}
// 后台标签页暂停所有循环，不增加逐帧 JavaScript 工作。
function updateVisibility() {
  resting.value = document.hidden;
  if (resting.value) {
    stopPetalTransition();
    tooltip.hide();
  }
}
// 换页或换图案后重新计算花瓣的明暗和转角；换图案后要等新的花瓣节点渲染出来。
watch(() => [props.spot, props.appearance], lightPetals, { flush: 'post' });
watch(
  () => [props.open, props.appearance],
  ([open, appearance], previous) => {
    // 鼠标或焦点还在按钮上：提示留着，换成现在该说的那一句。否则（比如用快捷键开关菜单）收起。
    if (hovered || document.activeElement === button.value)
      tooltip.retext(button.value, t(open ? 'launcherCloseHint' : 'launcherOpenHint'), {
        variant: 'launcher',
      });
    else tooltip.hide();
    // 展开：从悬停的那一圈接着转到指向当前页（没悬停着，比如用快捷键打开，也先转过这一圈）。
    if (open && !previous?.[0]) turnTo(aimFrom(rest + 360));
    else if (!open && previous?.[0]) settle();
    if (appearance === 'aurora') animatePetals(open);
    else stopPetalTransition();
  },
  { flush: 'post' },
);
onMounted(() => {
  motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  motionPreference.addEventListener('change', stopPetalTransition);
  document.addEventListener('visibilitychange', updateVisibility);
  lightPetals();
});
onBeforeUnmount(() => {
  stopPetalTransition();
  motionPreference?.removeEventListener('change', stopPetalTransition);
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
    @mouseenter="hoverIn"
    @mouseleave="hoverOut"
    @focus="showHint"
    @blur="blurred"
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
    --cf-launcher-accent 480ms var(--cf-ease-out-strong),
    transform var(--cf-duration-moderate) ease,
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
    transform 780ms var(--cf-ease-out),
    opacity 420ms ease;
}
/* 转角由脚本写在 --cf-launcher-angle 里（见上面的说明）。各种状态下变换的写法保持一样，
   整圈的旋转才会被当成真的转了一圈，而不是「前后一样、不用动」。 */
.cf-launcher-flower {
  transform: scale(1) rotate(var(--cf-launcher-angle, 0deg));
  opacity: 1;
}
.cf-launcher-current {
  transform: scale(0.96) rotate(-6deg);
  opacity: 0;
}
#cf-ratings-settings-btn.is-open .cf-launcher-flower {
  opacity: 0;
  transition:
    transform 580ms var(--cf-ease-out),
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
/*
 * 花瓣聚光：收起时是原样的花。展开后用明暗指出当前页——
 * 对应的那片花瓣最亮，并换成当前页的准确颜色；紧邻的两片稍亮，其余很淡；
 * 整朵花转动，把最亮的那片转到正上方，换页时跟着转过去。花瓣的大小始终不变。
 * 每片的亮度（--cf-petal-light）、最亮那片的颜色（--cf-petal-lit）和转角（--cf-launcher-angle）由脚本算好。
 */
#cf-ratings-settings-btn.is-flower .cf-launcher-motion {
  animation: none;
  transform: none;
}
#cf-ratings-settings-btn.is-flower .cf-flower-petal {
  opacity: 1;
  transition: opacity 480ms ease;
}
#cf-ratings-settings-btn.is-flower .cf-flower-petal > use:first-child {
  fill: var(--cf-petal-color);
  transition: fill 480ms ease;
}
#cf-ratings-settings-btn.is-flower.is-open .cf-flower-petal {
  opacity: var(--cf-petal-light, 1);
}
#cf-ratings-settings-btn.is-flower.is-open .cf-flower-petal[data-cf-lead] > use:first-child {
  fill: var(--cf-petal-lit, var(--cf-petal-color));
}
/* 展开时花留着，转到指向当前页的角度；之后换页只转过相差的那一段。 */
#cf-ratings-settings-btn.is-flower.is-open .cf-launcher-flower {
  opacity: 1;
  transition: transform 780ms var(--cf-ease-out);
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
  #cf-ratings-settings-btn.is-flower,
  #cf-ratings-settings-btn.is-flower .cf-flower-petal,
  #cf-ratings-settings-btn.is-flower .cf-flower-petal > use:first-child,
  #cf-ratings-settings-btn.is-flower.is-open .cf-launcher-flower {
    transition: none;
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
}
</style>
