<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import { translate as t } from '../../../../../../../i18n/index.js';
import * as assets from '../../../../../../../assets/index.js';
import InlineSvg from '../../../../../../components/icons/InlineSvg/InlineSvg.vue';
import EffortSlider from '../../../../../../components/forms/EffortSlider/EffortSlider.vue';
import { MAX_DESIGNS } from '../../../../../../../features/user/frames/custom/prompt/index.js';
// 编辑区第一步「复制提示词」左边：让 AI 一次给几个方案、要不要动效。
// 平时是一颗药丸「✦ 3 个方案 ⌄」，点开往下弹出一块：左上角是动效开关（一颗星星，开着时亮、一直轻轻闪），
// 中间写几个方案，右上角恢复默认（1 个方案、有动效），下面是强度条（见 EffortSlider，一档比一档浓）。
// 药丸上也有那颗星星：动效关了变灰、不动，不点开也看得出来。点别处、按 Esc 收起。
//   count   几个方案（1～MAX_DESIGNS）；motion 要不要动效。都用 v-model。
const props = defineProps({
  count: { type: Number, required: true },
  motion: { type: Boolean, required: true },
});
const emit = defineEmits(['update:count', 'update:motion']);
const icons = assets.FRAME_EDITOR_ICONS;

const open = ref(false);
const box = ref(null);
const pill = ref(null);
const slider = ref(null);
// 强度条的滑块走了多远（0～1）：标题跟着从蓝变紫。
const progress = ref(0);
// 数字换了往哪边滚：变大从下面上来，变小从上面下来。刚打开时不滚。
const direction = ref('');
watch(
  () => props.count,
  (now, before) => (direction.value = now > before ? 'is-up' : 'is-down'),
);

function outside(event) {
  if (!box.value?.contains(event.target)) open.value = false;
}
watch(open, (value) => {
  if (!value) return document.removeEventListener('pointerdown', outside, true);
  // 弹出层里的标题是新画的：不带上一次换数时的滚动，不然每次打开数字都滚一下。
  direction.value = '';
  document.addEventListener('pointerdown', outside, true);
  nextTick(() => slider.value?.focus());
});
// Esc 只收起这一块，不往外传（头像框库不会因此有别的动作），焦点回到药丸上。
function escape(event) {
  if (event.key !== 'Escape') return;
  event.stopPropagation();
  open.value = false;
  pill.value?.focus();
}
// 恢复默认：箭头转一圈，滑块弹回第一档，动效打开。
const spinning = ref(false);
function reset() {
  spinning.value = false;
  nextTick(() => (spinning.value = true));
  emit('update:count', 1);
  if (!props.motion) emit('update:motion', true);
}
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside, true));
</script>
<template>
  <span ref="box" class="cf-frame-count" :class="{ 'is-moving': motion }">
    <button
      ref="pill"
      type="button"
      class="cf-frame-count-pill"
      :class="{ 'is-open': open }"
      :aria-expanded="open"
      @click="open = !open"
    >
      <InlineSvg
        class="cf-frame-count-spark"
        :class="{ 'is-off': !motion }"
        :source="icons.motion"
      />
      <span
        ><span :key="count" class="cf-frame-count-num" :class="direction">{{ count }}</span>
        {{ t('frameCountUnit', count) }}</span
      >
      <i class="cf-frame-count-caret" aria-hidden="true"></i>
    </button>
    <Transition name="cf-frame-count-pop">
      <div
        v-if="open"
        class="cf-frame-count-pop"
        role="dialog"
        :aria-label="t('frameCountTitle')"
        :style="{ '--cf-frame-count-p': progress }"
        @keydown="escape"
      >
        <div class="cf-frame-count-top">
          <button
            type="button"
            class="cf-frame-count-icon cf-frame-count-motion"
            :class="{ 'is-on': motion }"
            :aria-pressed="motion"
            :aria-label="t(motion ? 'frameMotionOn' : 'frameMotionOff')"
            :data-tooltip="t(motion ? 'frameMotionOn' : 'frameMotionOff')"
            @click="emit('update:motion', !motion)"
          >
            <InlineSvg :source="icons.motion" />
          </button>
          <div class="cf-frame-count-title">
            <span :key="count" class="cf-frame-count-num" :class="direction">{{ count }}</span>
            {{ t('frameCountUnit', count) }}
          </div>
          <button
            type="button"
            class="cf-frame-count-icon cf-frame-count-reset"
            :class="{ 'is-spin': spinning }"
            :aria-label="t('frameCountReset')"
            :data-tooltip="t('frameCountReset')"
            @click="reset"
            @animationend="spinning = false"
          >
            <InlineSvg :source="icons.reset" />
          </button>
        </div>
        <EffortSlider
          ref="slider"
          :model-value="count"
          :max="MAX_DESIGNS"
          :moving="motion"
          :label="t('frameCountTitle')"
          :value-text="`${count} ${t('frameCountUnit', count)}`"
          @update:model-value="emit('update:count', $event)"
          @progress="progress = $event"
        />
      </div>
    </Transition>
  </span>
</template>
<style>
.cf-frame-count {
  position: relative;
  display: inline-flex;
}
/* 药丸：照左上角「给谁戴」那张卡片的样子（半透明白、悬停浮起），点开时小三角翻过来。 */
.cf-frame-count-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  margin: 0;
  padding: 0 10px 0 9px;
  border: 1px solid #ffffff8c;
  border-radius: 999px;
  background: #ffffff4d;
  box-sizing: border-box;
  color: var(--cf-control-ink);
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition:
    border-color var(--cf-duration-fast) ease,
    background-color var(--cf-duration-fast) ease,
    box-shadow var(--cf-duration-fast) ease;
}
.cf-frame-count-pill:hover,
.cf-frame-count-pill.is-open {
  border-color: #ffffffc2;
  background: #ffffff85;
  box-shadow: 0 3px 10px -6px #5a6a8f4d;
}
.cf-frame-count-pill:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--cf-menu-accent) 50%, transparent);
  outline-offset: 1px;
}
.cf-frame-count-spark {
  flex: none;
  width: 14px;
  height: 14px;
  color: #5b6fd8;
  transition:
    color var(--cf-duration-base) ease,
    opacity var(--cf-duration-base) ease;
}
.cf-frame-count-spark.is-off {
  color: var(--cf-gray-400);
  opacity: 0.7;
}
.cf-frame-count-caret {
  flex: none;
  width: 5px;
  height: 5px;
  margin: 0 2px 3px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  opacity: 0.55;
  transform: rotate(45deg);
  transition:
    transform var(--cf-duration-base) ease,
    margin var(--cf-duration-base) ease;
}
.cf-frame-count-pill.is-open .cf-frame-count-caret {
  margin: 3px 2px 0;
  transform: rotate(225deg);
}
/* 数字：换的时候按方向滚一下，带一点模糊。 */
.cf-frame-count-num {
  display: inline-block;
  min-width: 0.6em;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.cf-frame-count-num.is-up {
  animation: cf-frame-count-up 180ms cubic-bezier(0.2, 0, 0, 1);
}
.cf-frame-count-num.is-down {
  animation: cf-frame-count-down 180ms cubic-bezier(0.2, 0, 0, 1);
}
@keyframes cf-frame-count-up {
  from {
    opacity: 0;
    transform: translateY(3px);
    filter: blur(2px);
  }
}
@keyframes cf-frame-count-down {
  from {
    opacity: 0;
    transform: translateY(-3px);
    filter: blur(2px);
  }
}
/* 动效的星星：开着时一直在动——大星星慢慢呼吸、转一点，小星星一闪一闪；关了就停在原样。
   药丸上的和弹出层里的是同一个图标，一起动、一起停。 */
.cf-frame-count .cf-sparkle-big,
.cf-frame-count .cf-sparkle-small {
  transform-box: fill-box;
  transform-origin: center;
}
.cf-frame-count.is-moving .cf-sparkle-big {
  animation: cf-frame-count-sparkle-big 2.6s ease-in-out infinite;
}
.cf-frame-count.is-moving .cf-sparkle-small {
  animation: cf-frame-count-sparkle-small 2.6s ease-in-out infinite;
}
@keyframes cf-frame-count-sparkle-big {
  0%,
  100% {
    transform: scale(0.92) rotate(0deg);
  }
  50% {
    transform: scale(1.06) rotate(12deg);
  }
}
@keyframes cf-frame-count-sparkle-small {
  0%,
  30%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  15% {
    opacity: 0.25;
    transform: scale(0.55);
  }
  65% {
    opacity: 0.6;
    transform: scale(0.8);
  }
}

/* 弹出来的那一块：照「给谁戴」点开的列表（底色、边、阴影），往下展开、淡入。整块不让选字。 */
.cf-frame-count-pop {
  position: absolute;
  z-index: 10;
  top: calc(100% + 8px);
  left: 0;
  width: 268px;
  padding: 10px 12px 14px;
  border: 1px solid var(--cf-aurora-glass-border);
  border-radius: 16px;
  background: #fbfcff;
  box-shadow:
    0 16px 38px -12px #26345370,
    0 2px 6px -2px #2634531f;
  box-sizing: border-box;
  color: var(--cf-control-ink);
  -webkit-user-select: none;
  user-select: none;
  transform-origin: 24px top;
  /* 一直放在单独的一层上：展开的动画里它本来就在单独的一层，动画一结束合回去重画，文字会跳 1px（弹窗的位置不一定是整像素）。 */
  will-change: transform, opacity;
}
.cf-frame-count-pop-enter-active,
.cf-frame-count-pop-leave-active {
  transition:
    opacity 160ms ease,
    transform 220ms var(--cf-ease-out);
}
.cf-frame-count-pop-enter-from,
.cf-frame-count-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
.cf-frame-count-top {
  display: grid;
  grid-template-columns: 28px 1fr 28px;
  align-items: center;
  margin-bottom: 10px;
}
/* 标题：从这个弹窗的蓝慢慢变紫（跟着强度条走了多远）。 */
.cf-frame-count-title {
  color: color-mix(in srgb, #8a6fd0 calc(var(--cf-frame-count-p) * 100%), #5163cf);
  font-size: var(--cf-font-size-base);
  font-weight: var(--cf-font-weight-semibold);
  line-height: 20px;
  text-align: center;
}
.cf-frame-count-title .cf-frame-count-num {
  font-size: 15px;
  font-weight: var(--cf-font-weight-bold);
}
.cf-frame-count-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 9px;
  background: none;
  cursor: pointer;
  transition:
    color var(--cf-duration-base) ease,
    background-color var(--cf-duration-base) ease,
    box-shadow var(--cf-duration-base) ease;
}
.cf-frame-count-icon:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--cf-menu-accent) 50%, transparent);
  outline-offset: 1px;
}
/* 动效开关：像 Codex 的快速模式那种图标按钮。开着时星星是亮的蓝、垫一层淡光；关着是灰的。 */
.cf-frame-count-motion {
  color: var(--cf-gray-400);
}
.cf-frame-count-motion:hover {
  background: color-mix(in srgb, var(--cf-menu-accent) 12%, transparent);
}
.cf-frame-count-motion.is-on {
  color: #5b6fd8;
  background: color-mix(in srgb, #5b6fd8 12%, transparent);
  box-shadow: 0 0 14px -4px color-mix(in srgb, #5b6fd8 70%, transparent);
}
.cf-frame-count-motion svg {
  width: 16px;
  height: 16px;
}
/* 恢复默认：平时淡，悬停变深；点了转一圈。 */
.cf-frame-count-reset {
  color: #9aa3bd;
}
.cf-frame-count-reset:hover {
  color: var(--cf-control-ink);
  background: color-mix(in srgb, var(--cf-menu-accent) 12%, transparent);
}
.cf-frame-count-reset.is-spin svg {
  animation: cf-frame-count-spin 420ms var(--cf-ease-out);
}
@keyframes cf-frame-count-spin {
  to {
    transform: rotate(-360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .cf-frame-count-pill,
  .cf-frame-count-spark,
  .cf-frame-count-caret,
  .cf-frame-count-icon,
  .cf-frame-count-pop-enter-active,
  .cf-frame-count-pop-leave-active {
    transition: none;
  }
  .cf-frame-count-num,
  .cf-frame-count.is-moving .cf-sparkle-big,
  .cf-frame-count.is-moving .cf-sparkle-small,
  .cf-frame-count-reset.is-spin svg {
    animation: none;
  }
}
</style>
