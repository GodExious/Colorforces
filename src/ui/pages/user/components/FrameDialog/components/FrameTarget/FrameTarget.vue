<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { translate as t } from '../../../../../../../i18n/index.js';
import AvatarFrame from '../../../../../../components/avatars/AvatarFrame/AvatarFrame.vue';
import GroupMark from '../../../../../groups/components/GroupMark/GroupMark.vue';
import { tooltip } from '../../../../../../components/tooltips/FloatingTooltip/FloatingTooltip.vue';
import { isTruncated } from '../../../../../../../utils/text-overflow.js';
// 头像框库左栏顶上「给谁戴」：一块小卡片写着现在给谁挑，点开浮出一个列表换人。
// 列表里我自己在最上面，下面是分组（按分组的先后）；每行右边一个小圆是它现在用的头像框，选中的打勾，最下面一行灰字是先后规则。
//   options     [{ id, name, sub, picture（我自己的头像）, group（分组，画小标用）, frame（现在用的头像框） }]，第一项是我自己
//   modelValue  选中的那一项的 id
const props = defineProps({
  options: { type: Array, required: true },
  modelValue: { type: String, required: true },
});
const emit = defineEmits(['update:modelValue']);
const chosen = computed(
  () => props.options.find((option) => option.id === props.modelValue) || props.options[0],
);
const mine = computed(() => props.options[0]);
const others = computed(() => props.options.slice(1));

// 名字太长被省略时，鼠标移上去提示全名。
function showName(event, name) {
  if (isTruncated(event.currentTarget)) tooltip.show(event.currentTarget, name);
}
const open = ref(false);
const box = ref(null);
function pick(id) {
  tooltip.hide();
  open.value = false;
  if (id !== props.modelValue) emit('update:modelValue', id);
}
// 开着时点到别处、按 Esc 收起来。
function outside(event) {
  if (!box.value?.contains(event.target)) open.value = false;
}
function escape(event) {
  if (event.key !== 'Escape') return;
  event.stopPropagation();
  open.value = false;
}
watch(open, (now) => {
  const method = now ? 'addEventListener' : 'removeEventListener';
  document[method]('pointerdown', outside, true);
  document[method]('keydown', escape, true);
});
onBeforeUnmount(() => (open.value = false));
</script>
<template>
  <div ref="box" class="cf-frame-target">
    <div class="cf-frame-target-label">{{ t('frameTargetLabel') }}</div>
    <button
      type="button"
      class="cf-frame-target-card"
      :class="{ 'is-open': open }"
      :aria-expanded="open"
      @click="open = !open"
    >
      <Transition name="cf-frame-target-swap" mode="out-in">
        <span :key="chosen.id" class="cf-frame-target-now">
          <span v-if="chosen.group" class="cf-frame-target-mark"
            ><GroupMark :group="chosen.group"
          /></span>
          <span v-else class="cf-frame-target-face"
            ><img v-if="chosen.picture" :src="chosen.picture" alt=""
          /></span>
          <span class="cf-frame-target-text"
            ><b @mouseenter="showName($event, chosen.name)" @mouseleave="tooltip.hide()">{{
              chosen.name
            }}</b
            ><small>{{ chosen.sub }}</small></span
          >
        </span>
      </Transition>
      <i class="cf-frame-target-caret" aria-hidden="true"></i>
    </button>
    <Transition name="cf-frame-target-pop">
      <div v-if="open" class="cf-frame-target-pop cf-scrollbar" role="listbox">
        <button
          v-for="option in [mine, ...others]"
          :key="option.id"
          type="button"
          role="option"
          class="cf-frame-target-row cf-frame-host"
          :class="{ 'is-on': option.id === modelValue, 'is-first-group': option === others[0] }"
          :aria-selected="option.id === modelValue"
          @click="pick(option.id)"
        >
          <span v-if="option.group" class="cf-frame-target-mark"
            ><GroupMark :group="option.group"
          /></span>
          <span v-else class="cf-frame-target-face is-small"
            ><img v-if="option.picture" :src="option.picture" alt=""
          /></span>
          <span class="cf-frame-target-text"
            ><span @mouseenter="showName($event, option.name)" @mouseleave="tooltip.hide()">{{
              option.name
            }}</span
            ><small>{{ option.sub }}</small></span
          >
          <span class="cf-frame-target-thumb" :class="{ 'is-none': !option.frame }"
            ><AvatarFrame v-if="option.frame" :frame="option.frame"
          /></span>
          <svg class="cf-frame-target-check" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 6.3l2.3 2.3 4.7-5.1" />
          </svg>
        </button>
        <div v-if="others.length" class="cf-frame-target-sep">{{ t('frameTargetGroups') }}</div>
        <div class="cf-frame-target-note">{{ t('groupsFrameOrder') }}</div>
      </div>
    </Transition>
  </div>
</template>
<style>
.cf-frame-target {
  position: relative;
  margin: 0 0 8px;
}
.cf-frame-target-label {
  padding: 0 8px 4px;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-2xs);
}
/* 卡片：很淡的半透明白，悬停、点开时才亮一点。 */
.cf-frame-target-card {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 8px;
  border: 1px solid #ffffff8c;
  border-radius: var(--cf-radius-lg);
  background: #ffffff4d;
  color: var(--cf-control-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--cf-duration-fast) ease,
    background-color var(--cf-duration-fast) ease,
    box-shadow var(--cf-duration-fast) ease;
}
.cf-frame-target-card:hover,
.cf-frame-target-card.is-open {
  border-color: #ffffffc2;
  background: #ffffff85;
  box-shadow: 0 3px 10px -6px #5a6a8f4d;
}
.cf-frame-target-card:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--cf-menu-accent) 50%, transparent);
  outline-offset: 1px;
}
.cf-frame-target-now {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.cf-frame-target-face {
  flex: none;
  width: 26px;
  height: 26px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--cf-gray-100);
}
.cf-frame-target-face.is-small {
  width: 20px;
  height: 20px;
}
.cf-frame-target-face > img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cf-frame-target-mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 26px;
}
.cf-frame-target-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  line-height: 1.3;
}
.cf-frame-target-text > b,
.cf-frame-target-text > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cf-frame-target-text > b {
  font-weight: var(--cf-font-weight-semibold);
}
/* 点开的列表里的名字（我自己、各个分组）稍微加粗，和下面一行灰色的小字分开。 */
.cf-frame-target-row .cf-frame-target-text > span {
  font-weight: var(--cf-font-weight-medium);
}
.cf-frame-target-text > small {
  overflow: hidden;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-2xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cf-frame-target-caret {
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
.cf-frame-target-card.is-open .cf-frame-target-caret {
  margin: 3px 2px 0;
  transform: rotate(225deg);
}
.cf-frame-target-swap-enter-active,
.cf-frame-target-swap-leave-active {
  transition: opacity var(--cf-duration-fast) ease;
}
.cf-frame-target-swap-enter-from,
.cf-frame-target-swap-leave-to {
  opacity: 0;
}
/* 点开的列表：浮在卡片下面，比左栏宽，盖住下面的分类。 */
.cf-frame-target-pop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  width: 250px;
  max-height: 320px;
  padding: 6px;
  overflow-y: auto;
  border: 1px solid var(--cf-aurora-glass-border);
  border-radius: var(--cf-radius-lg);
  background: #fbfcff;
  box-shadow: 0 14px 34px -12px #26345366;
  box-sizing: border-box;
  font-size: var(--cf-font-size-base);
}
/* 滚动条用公共的 cf-scrollbar（styles/scrollbar.css）。 */
.cf-frame-target-pop-enter-active,
.cf-frame-target-pop-leave-active {
  transition:
    opacity 160ms ease,
    transform 200ms var(--cf-ease-out);
}
.cf-frame-target-pop-enter-from,
.cf-frame-target-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.cf-frame-target-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  margin: 0;
  padding: 0 8px;
  border: 0;
  border-radius: var(--cf-radius-md);
  background: none;
  color: var(--cf-aurora-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background-color var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease;
}
.cf-frame-target-row:hover {
  background: var(--cf-card-hover);
}
.cf-frame-target-row.is-on {
  background: var(--cf-control-active);
  color: var(--cf-control-ink);
}
/* 分组和我自己之间的那一道：「分组」两个字放在第一个分组上面（用 order 挪过去）。 */
.cf-frame-target-sep {
  order: 1;
  margin: 6px 8px 2px;
  padding-top: 6px;
  border-top: 1px solid var(--cf-surface-border);
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-2xs);
}
.cf-frame-target-row.is-first-group,
.cf-frame-target-row.is-first-group ~ .cf-frame-target-row {
  order: 2;
}
.cf-frame-target-note {
  order: 3;
  margin: 6px 8px 2px;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-2xs);
  line-height: 1.5;
}
/* 现在用的头像框：一个 11px 的灰圆套上头像框；没有时是一个虚线圆。 */
.cf-frame-target-thumb {
  position: relative;
  flex: none;
  width: 11px;
  height: 11px;
  margin: 0 5px;
  border-radius: 50%;
  background: var(--cf-gray-200);
}
.cf-frame-target-thumb.is-none {
  width: 14px;
  height: 14px;
  margin: 0 4px;
  border: 1px dashed var(--cf-gray-300);
  background: none;
  box-sizing: border-box;
}
.cf-frame-target-check {
  flex: none;
  width: 12px;
  height: 12px;
  fill: none;
  stroke: var(--cf-control-ink);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
  transition: opacity var(--cf-duration-fast) ease;
}
.cf-frame-target-row.is-on .cf-frame-target-check {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .cf-frame-target-pop-enter-active,
  .cf-frame-target-pop-leave-active,
  .cf-frame-target-swap-enter-active,
  .cf-frame-target-swap-leave-active {
    transition: none;
  }
}
</style>
