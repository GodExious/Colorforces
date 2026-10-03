<script setup>
import { ref, nextTick, watch, onBeforeUnmount, useId } from 'vue';
import { translate as t } from '../../../../../i18n/index.js';
import InlineSvg from '../../../../components/icons/InlineSvg/InlineSvg.vue';
const props = defineProps({ links: { type: Array, required: true }, active: Boolean });
const root = ref(null);
const trigger = ref(null);
const panel = ref(null);
const open = ref(false);
const above = ref(false);
const panelId = `cf-project-links-${useId()}`;
let closeTimer;
let pinned = false;

// 仅展开时检查可视边界，靠近内容底部时向上展开，避免被滚动容器裁切。
function placePanel() {
  if (!panel.value || !trigger.value) return;
  let top = 8;
  let bottom = innerHeight - 8;
  for (let node = root.value.parentElement; node; node = node.parentElement) {
    if (!['hidden', 'auto', 'scroll', 'clip'].includes(getComputedStyle(node).overflowY)) continue;
    const rect = node.getBoundingClientRect();
    top = Math.max(top, rect.top);
    bottom = Math.min(bottom, rect.bottom);
  }
  const rect = trigger.value.getBoundingClientRect();
  above.value =
    bottom - rect.bottom < panel.value.offsetHeight + 6 && rect.top - top > bottom - rect.bottom;
}
// 鼠标悬停、点击与键盘打开共用入口，重复经过不会重新播放动画。
async function show() {
  clearTimeout(closeTimer);
  if (!props.active) return;
  open.value = true;
  await nextTick();
  if (open.value) placePanel();
}
// 关闭浮层时取消延迟，不影响真实链接的默认跳转行为。
function hide() {
  clearTimeout(closeTimer);
  pinned = false;
  open.value = false;
}
// 悬停只预览，点击固定或收起，避免鼠标进入后紧接的单击把面板关掉。
function toggle() {
  if (!props.active) return;
  if (pinned) hide();
  else {
    pinned = true;
    show();
  }
}
// 键盘离开整组控件后解除固定，让 Tab 可以正常退出浮层。
function leaveFocus(event) {
  if (!root.value?.contains(event.relatedTarget)) {
    pinned = false;
    scheduleClose();
  }
}
// 给鼠标跨过按钮和面板的间距留出时间，键盘焦点仍在内部时保持展开。
function scheduleClose() {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    if (!pinned && !root.value?.matches(':hover') && !panel.value?.contains(document.activeElement))
      hide();
  }, 120);
}
// 点击外部时收起面板；中键和 Ctrl 点击内部链接仍走浏览器原生行为。
function outside(event) {
  if (!root.value?.contains(event.target)) hide();
}
// 方向键依次访问原生链接，Tab 可自然离开而不会陷入焦点循环。
async function moveFocus(direction) {
  await show();
  const links = [...(panel.value?.querySelectorAll('a') || [])];
  if (!links.length) return;
  const index = links.indexOf(document.activeElement);
  links[
    index < 0
      ? direction > 0
        ? 0
        : links.length - 1
      : (index + direction + links.length) % links.length
  ].focus();
}
// Escape 返回触发按钮，避免关闭后焦点留在已移除的链接上。
function escape() {
  hide();
  trigger.value?.focus();
}
watch(open, (shown) => {
  if (shown) {
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', placePanel);
    window.addEventListener('blur', hide);
  } else {
    document.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('resize', placePanel);
    window.removeEventListener('blur', hide);
  }
});
watch(
  () => props.active,
  (active) => {
    if (!active) hide();
  },
);
onBeforeUnmount(() => {
  clearTimeout(closeTimer);
  document.removeEventListener('pointerdown', outside, true);
  window.removeEventListener('resize', placePanel);
  window.removeEventListener('blur', hide);
});
</script>

<template>
  <div
    ref="root"
    class="cf-project-links"
    @mouseenter="show"
    @mouseleave="scheduleClose"
    @focusout="leaveFocus"
    @keydown.down.prevent="moveFocus(1)"
    @keydown.up.prevent="moveFocus(-1)"
    @keydown.esc.stop.prevent="escape"
  >
    <button
      ref="trigger"
      type="button"
      class="cf-ack-link-btn cf-project-links-trigger"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="toggle"
    >
      <span data-cf-language-text>{{ t('ackVisitProject') }}</span
      ><span
        class="cf-project-links-chevron"
        :class="{ 'is-open': open }"
        aria-hidden="true"
      ></span>
    </button>
    <Transition name="cf-project-links">
      <ul
        v-if="open"
        :id="panelId"
        ref="panel"
        class="cf-project-link-panel"
        :class="{ 'is-above': above }"
        :aria-label="t('ackChoosePlatform')"
      >
        <li v-for="link in links" :key="link.id">
          <a
            class="cf-project-link-option"
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
          >
            <InlineSvg :source="link.icon" /><span data-cf-language-text>{{
              t(link.labelKey)
            }}</span>
          </a>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style>
.cf-project-links {
  position: relative;
  display: inline-flex;
}
.cf-project-links-chevron {
  width: 6px;
  height: 6px;
  margin: 0 2px 3px 4px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg);
  transition: transform 170ms ease;
}
.cf-project-links-chevron.is-open {
  transform: translateY(3px) rotate(225deg);
}
.cf-project-link-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  width: 214px;
  max-width: calc(100vw - 32px);
  margin: 0;
  padding: 5px;
  list-style: none;
  border: 1px solid color-mix(in srgb, var(--cf-ack-accent) 42%, var(--cf-card-surface));
  border-radius: var(--cf-radius-lg);
  background: var(--cf-card-surface);
  box-shadow: 0 6px 20px #26374b26;
  transform-origin: top right;
}
.cf-project-link-panel.is-above {
  top: auto;
  bottom: calc(100% + 6px);
  transform-origin: bottom right;
}
.cf-project-link-panel li {
  margin: 0;
  padding: 0;
  list-style: none;
}
.cf-settings-modal .cf-project-link-option:any-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--cf-radius-sm);
  color: var(--cf-ack-ink);
  text-decoration: none;
  font-size: var(--cf-font-size-base);
  line-height: 20px;
  font-weight: var(--cf-font-weight-medium);
  white-space: nowrap;
  transition: background-color 160ms ease;
}
.cf-settings-modal .cf-project-link-option:is(:hover, :focus-visible) {
  background: color-mix(in srgb, var(--cf-ack-accent) 18%, var(--cf-card-surface));
  outline: 2px solid color-mix(in srgb, var(--cf-ack-accent) 38%, transparent);
  outline-offset: -2px;
}
.cf-project-link-option svg {
  width: 17px;
  height: 17px;
  flex: none;
}
.cf-project-links-enter-active,
.cf-project-links-leave-active {
  transition:
    opacity 160ms ease,
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
.cf-project-links-enter-from,
.cf-project-links-leave-to {
  opacity: 0;
  transform: translateY(-5px) scale(0.98);
}
.cf-project-link-panel.is-above.cf-project-links-enter-from,
.cf-project-link-panel.is-above.cf-project-links-leave-to {
  transform: translateY(5px) scale(0.98);
}
@media (prefers-reduced-motion: reduce) {
  .cf-project-links-chevron,
  .cf-project-links-enter-active,
  .cf-project-links-leave-active {
    transition: none;
  }
}
</style>
