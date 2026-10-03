<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { appSettings } from '../../../settings.js';
import { translate as t } from '../../../i18n/index.js';
import * as assets from '../../../assets/index.js';
import InlineSvg from '../../components/icons/InlineSvg/InlineSvg.vue';
import { MENU_TAB_IDS } from '../../../config/menu-tabs.js';
const props = defineProps({ active: String });
const emit = defineEmits(['select', 'theme']);
const root = ref(null),
  indicator = ref(null);
let observer, frame;
let lastGeometry, lastTheme;
const labels = {
  general: 'tabGeneral',
  appearance: 'tabAppearance',
  ratings: 'tabRatings',
  prediction: 'tabPrediction',
  user: 'tabUser',
  shortcuts: 'tabShortcuts',
  storage: 'tabStorage',
  changelog: 'changelogTitle',
  roadmap: 'tabRoadmap',
  acknowledgments: 'ackSectionTitle',
};
// 顺序以统一的页签清单为准，这里只补上各页的标题文案。
const tabs = MENU_TAB_IDS.map((id) => ({ id, label: labels[id] }));
// 指示条的位移与主题色的变化共用这个时长和缓动：指示条停下时，颜色也正好变完。
const SWITCH_TIMING = '0.48s cubic-bezier(0.16,1,0.3,1)';
// 指示条只做合成位移；相同尺寸的重复通知不打断正在进行的切换。
function updateIndicator(animate = true) {
  const target = root.value?.querySelector('[data-tab=' + props.active + ']');
  if (!target) return;
  const style = indicator.value.style;
  // 从图标读取主题色，避免导航和资源分别维护两套配色。
  const icon = target.querySelector('svg');
  const accent =
    (icon && getComputedStyle(icon).getPropertyValue('--cf-icon-primary').trim()) || '#1677ff';
  const secondary =
    (icon && getComputedStyle(icon).getPropertyValue('--cf-icon-secondary').trim()) || accent;
  const top = target.offsetTop;
  const height = target.offsetHeight;
  if (!height) return;
  if (lastTheme?.accent !== accent || lastTheme?.secondary !== secondary) {
    emit('theme', { '--cf-menu-accent': accent, '--cf-menu-secondary': secondary });
    lastTheme = { accent, secondary };
  }
  target.style.setProperty('--cf-tab-accent', accent);
  style.setProperty('--cf-tab-accent', accent);
  if (lastGeometry?.top === top && lastGeometry?.height === height) return;
  lastGeometry = { top, height };
  const transition = `transform ${SWITCH_TIMING},opacity 0.2s ease,background-color ${SWITCH_TIMING}`;
  const moving = animate && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  style.transition = moving ? transition : 'none';
  style.transform = `translate3d(0, ${top}px, 0)`;
  style.height = height + 'px';
  style.opacity = '1';
  if (!moving) {
    void indicator.value.offsetHeight;
    style.transition = transition;
  }
}
watch(
  () => [props.active, appSettings.lang],
  () => nextTick(() => updateIndicator()),
);
defineExpose({ updateIndicator });
// 缩放、跨屏和字体加载后重新测量，不把旧屏幕的选中位置带过去。
function measureIndicator() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => updateIndicator(false));
}
onMounted(() => {
  updateIndicator(false);
  observer = new ResizeObserver(measureIndicator);
  observer.observe(root.value);
  root.value.querySelectorAll('.cf-nav-tab').forEach((tab) => observer.observe(tab));
  window.addEventListener('resize', measureIndicator);
  window.visualViewport?.addEventListener('resize', measureIndicator);
  document.fonts?.addEventListener('loadingdone', measureIndicator);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  cancelAnimationFrame(frame);
  window.removeEventListener('resize', measureIndicator);
  window.visualViewport?.removeEventListener('resize', measureIndicator);
  document.fonts?.removeEventListener('loadingdone', measureIndicator);
});
</script>
<template>
  <div class="cf-sidebar-nav" ref="root">
    <div ref="indicator" class="cf-nav-indicator"></div>
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      class="cf-nav-tab"
      :class="{ active: active === tab.id }"
      :data-tab="tab.id"
      @click="$emit('select', tab.id)"
    >
      <span class="cf-tab-icon"><inline-svg :source="assets.TAB_ICONS[tab.id]"></inline-svg></span
      ><span class="cf-tab-text" data-cf-language-text>{{ t(tab.label) }}</span>
    </button>
  </div>
</template>
<style>
.cf-sidebar-nav {
  width: 200px;
  min-width: 200px;
  max-width: 200px;
  flex-shrink: 0;
  /* 侧栏与标题栏、页脚一样是玻璃：半透明的淡主题色，并模糊底下的页面。 */
  background: color-mix(in srgb, var(--cf-paint-accent) 9%, #ffffffb8);
  -webkit-backdrop-filter: blur(9px) saturate(155%);
  backdrop-filter: blur(9px) saturate(155%);
  border-right: 1px solid color-mix(in srgb, var(--cf-paint-accent) 18%, #dde5ee);
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-sizing: border-box;
  overflow-y: auto;
  overflow-y: overlay;
  scrollbar-width: thin;
  scrollbar-color: var(--cf-gray-300) transparent;
  overscroll-behavior: contain;
  position: relative;
}

/* 不支持背景模糊时退回不透明的淡主题色，保证文字底下是纯色。 */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .cf-sidebar-nav {
    background: color-mix(in srgb, var(--cf-paint-accent) 11%, #f5f8fc);
  }
}

.cf-sidebar-nav::-webkit-scrollbar {
  width: 4px;
}

.cf-sidebar-nav::-webkit-scrollbar-track {
  background: transparent;
}

.cf-sidebar-nav::-webkit-scrollbar-thumb {
  background: var(--cf-gray-300);
  border-radius: var(--cf-radius-xs);
}

.cf-sidebar-nav::-webkit-scrollbar-thumb:hover {
  background: var(--cf-gray-400);
}

.cf-nav-indicator {
  position: absolute;
  top: 0;
  left: 8px;
  width: calc(100% - 16px);
  height: 36px;
  background-color: #e6f4ff;
  background-color: color-mix(in srgb, var(--cf-tab-accent, #1677ff) 18%, white);
  border-radius: var(--cf-radius-md);
  pointer-events: none;
  z-index: 1;
  box-sizing: border-box;
  will-change: transform;
  /* 位移与换色同一个时长、同一条缓动，与脚本里的 SWITCH_TIMING 保持一致。 */
  transition:
    transform 0.48s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease,
    background-color 0.48s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 0;
}

.cf-nav-indicator::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 3.5px;
  height: 18px;
  background-color: var(--cf-tab-accent, #1677ff);
  border-radius: 3px;
  transition: background-color 0.48s cubic-bezier(0.16, 1, 0.3, 1);
}

.cf-nav-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 16px;
  flex: 0 1 36px;
  min-height: 28px;
  height: 36px;
  line-height: 20px;
  border-radius: var(--cf-radius-md);
  font-size: var(--cf-font-size-lg);
  font-weight: var(--cf-font-weight-medium);
  color: var(--cf-gray-600);
  cursor: pointer;
  position: relative;
  z-index: 2;
  transition:
    color 0.48s cubic-bezier(0.16, 1, 0.3, 1),
    background-color 0.18s ease,
    transform 0.12s ease;
  user-select: none;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  box-sizing: border-box;
  white-space: nowrap;
  overflow: hidden;
}

.cf-nav-tab:not(.active):hover {
  background: rgba(0, 0, 0, 0.035);
  color: var(--cf-gray-900);
}

.cf-nav-tab:active {
  transform: scale(0.98);
}

.cf-nav-tab.active {
  color: #1677ff;
  color: color-mix(in srgb, var(--cf-tab-accent, #1677ff) 60%, #25334b);
  font-weight: var(--cf-font-weight-semibold);
}

.cf-tab-icon {
  font-size: var(--cf-font-size-xl);
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: inherit;
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.cf-nav-tab.active .cf-tab-icon {
  --cf-icon-wash: 0.3;
  transform: scale(1.08);
}

.cf-tab-icon svg [fill-opacity] {
  transition: fill-opacity 0.22s ease;
}

.cf-tab-icon svg {
  width: 16px;
  height: 16px;
  display: block;
  flex-shrink: 0;
}

.cf-tab-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}
</style>
