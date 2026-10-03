<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, provide } from 'vue';
import { CURRENT_VERSION } from '../config/runtime.js';
import { appSettings, setSetting } from '../settings.js';
import { translate as t } from '../i18n/index.js';
import { languages } from '../i18n/languages.js';
import { configureLanguageShortcut } from '../features/shortcuts/index.js';
import * as assets from '../assets/index.js';
import InlineSvg from './components/icons/InlineSvg/InlineSvg.vue';
import FloatingTooltip, {
  tooltip,
} from './components/tooltips/FloatingTooltip/FloatingTooltip.vue';
import ConfirmDialog from './components/dialogs/ConfirmDialog/ConfirmDialog.vue';
import { preventScrollChaining } from '../utils/scroll.js';
import { petalPosition } from '../utils/petal-palette.js';
import { MENU_TAB_IDS } from '../config/menu-tabs.js';
import MenuNav from './shell/MenuNav/MenuNav.vue';
import MenuFooter from './shell/MenuFooter/MenuFooter.vue';
import MenuScrollbar from './shell/MenuScrollbar/MenuScrollbar.vue';
import MenuLauncher from './shell/MenuLauncher/MenuLauncher.vue';
import MenuGlassSurface from './shell/MenuGlassSurface/MenuGlassSurface.vue';
import MenuResizeHandles from './shell/MenuResizeHandles/MenuResizeHandles.vue';
import MenuLayout, { useMenuLayout } from './shell/MenuLayout/MenuLayout.vue';
import GeneralPage from './pages/general/GeneralPage.vue';
import AppearancePage from './pages/appearance/AppearancePage.vue';
import RatingsPage from './pages/ratings/RatingsPage.vue';
import PredictionPage from './pages/prediction/PredictionPage.vue';
import UserPage from './pages/user/UserPage.vue';
import PredictionAnalysisDialog from './pages/prediction/components/PredictionAnalysisDialog/PredictionAnalysisDialog.vue';
import ShortcutsPage from './pages/shortcuts/ShortcutsPage.vue';
import StoragePage from './pages/storage/StoragePage.vue';
import ChangelogPage from './pages/changelog/ChangelogPage.vue';
import RoadmapPage from './pages/roadmap/RoadmapPage.vue';
import AcknowledgmentsPage from './pages/acknowledgments/AcknowledgmentsPage.vue';
import UpdateDialog from './pages/general/components/UpdateDialog/UpdateDialog.vue';
import ClistSyncDialog from './pages/ratings/components/ClistSyncDialog/ClistSyncDialog.vue';
import ClistKeyGuide from './pages/ratings/components/ClistKeyGuide/ClistKeyGuide.vue';
import ClistSyncGuide from './pages/ratings/components/ClistSyncGuide/ClistSyncGuide.vue';
import TimeFormatGuide from './pages/appearance/components/TimeFormatGuide/TimeFormatGuide.vue';
import VerdictGuide from './pages/appearance/components/VerdictGuide/VerdictGuide.vue';
import StorageJsonDialog from './pages/storage/components/StorageJsonDialog/StorageJsonDialog.vue';
const visible = ref(false),
  activeTab = ref('general');
const documentHidden = ref(document.hidden);
// 上下栏共用可见性，菜单关闭或标签页进入后台时暂停玻璃光效。
provide(
  'cf-menu-motion-active',
  computed(() => visible.value && !documentHidden.value),
);
const theme = ref({});
// 浮层虽然传送到 body，仍共享菜单的响应式主题。
provide('cf-menu-theme', theme);
const contentArea = ref(null),
  panelHost = ref(null),
  scrollbar = ref(null),
  navigation = ref(null),
  modal = ref(null);
const menuRoot = ref(null);
const menuLayout = useMenuLayout(menuRoot, visible);
provide('cf-menu-size', menuLayout.size);
provide('cf-menu-position', menuLayout.position);
const ids = MENU_TAB_IDS;
// 当前页在花瓣色环上的位置，设置按钮据此决定点亮哪片花瓣、转到哪个角度。
const menuSpot = computed(() => petalPosition(ids.indexOf(activeTab.value), ids.length));
let cleanup;
let scrollFloor = 0;
// 仅保留当前位置必需的底部空间；用户向上滚动后立即回收，不强制回滚。
function trimScrollFloor() {
  if (!scrollFloor || !contentArea.value || !panelHost.value) return;
  const area = contentArea.value;
  const style = getComputedStyle(area);
  const needed = Math.max(
    0,
    area.scrollTop +
      area.clientHeight -
      parseFloat(style.paddingTop) -
      parseFloat(style.paddingBottom),
  );
  const panel = panelHost.value.querySelector('.cf-tab-panel.active:not([aria-hidden="true"])');
  scrollFloor =
    (panel?.getBoundingClientRect().height || 0) >= needed ? 0 : Math.min(scrollFloor, needed);
  panelHost.value.style.setProperty('--cf-scroll-floor', scrollFloor + 'px');
}
// 折叠前设定滚动下限，避免内容变短时浏览器把鼠标下的标题顶走。
function holdCollapsePosition() {
  const area = contentArea.value;
  if (!area || !panelHost.value) return () => {};
  const style = getComputedStyle(area);
  scrollFloor = Math.max(
    scrollFloor,
    area.scrollTop +
      area.clientHeight -
      parseFloat(style.paddingTop) -
      parseFloat(style.paddingBottom),
  );
  panelHost.value.style.setProperty('--cf-scroll-floor', Math.max(0, scrollFloor) + 'px');
  return () => nextTick(trimScrollFloor);
}
// 换页不继承折叠留白，每一页仍由自身内容决定滚动范围。
function resetScrollFloor() {
  scrollFloor = 0;
  panelHost.value?.style.removeProperty('--cf-scroll-floor');
}
provide('cf-collapse-anchor', holdCollapsePosition);
let languageRevision = 0;
let languageAnimations = [];
let releaseLanguagePosition;
let languageChanging = false;
let requestedLanguage = null;
// 切页或关闭时清理遮罩和位移，并保留用户最后选择的语言。
function finishLanguageChange() {
  languageRevision++;
  languageAnimations.forEach((animation) => animation.cancel());
  languageAnimations = [];
  languageChanging = false;
  releaseLanguagePosition?.();
  releaseLanguagePosition = null;
  const requested = requestedLanguage;
  requestedLanguage = null;
  if (requested && requested !== appSettings.lang) setSetting('lang', requested);
}
// 只收放可见文案，图标、控件底色与点击区域始终保持原样。
function languageTextElements() {
  return [...modal.value.querySelectorAll('[data-cf-language-text]')].filter(
    (element) => element.getClientRects().length && element.textContent.trim(),
  );
}
// 选择独立布局单元；固定玻璃背景不参与文案位移，父子也不重复移动。
function languageLayoutElements() {
  return [
    ...modal.value.querySelectorAll(
      '.cf-tab-panel.active .cf-setting-item, .cf-tab-panel.active .cf-setting-label, ' +
        '.cf-tab-panel.active .cf-setting-sublabel, .cf-tab-panel.active button, ' +
        '.cf-tab-panel.active input, .cf-tab-panel.active .cf-segmented-switch, ' +
        '.cf-tab-panel.active .cf-toggle-switch, .cf-tab-panel.active .cf-expand-region, ' +
        '.cf-modal-footer > :not(.cf-menu-glass-light), .cf-footer-links, .cf-footer-link, ' +
        '.cf-modal-footer button, .cf-footer-motto, .cf-tab-panel.active > *',
    ),
  ].filter((element) => element.getClientRects().length);
}
// 旧文案收拢后展开新文案，同时迁移控件尺寸；连续点击只处理最后一次选择。
async function changeLanguage(code) {
  if (languageChanging) {
    requestedLanguage = code;
    return;
  }
  if (code === appSettings.lang) return;
  cleanup?.();
  if (!visible.value || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setSetting('lang', code);
    return;
  }
  const elements = languageLayoutElements();
  const before = new Map(elements.map((element) => [element, element.getBoundingClientRect()]));
  finishLanguageChange();
  const revision = languageRevision;
  languageChanging = true;
  requestedLanguage = code;
  tooltip.hide();
  releaseLanguagePosition = holdCollapsePosition();
  const leaving = languageTextElements().map((element) =>
    element.animate(
      [{ clipPath: 'inset(-0.2em 0% -0.2em 0)' }, { clipPath: 'inset(-0.2em 100% -0.2em 0)' }],
      { duration: 100, easing: 'ease-in', fill: 'both' },
    ),
  );
  languageAnimations.push(...leaving);
  await Promise.allSettled(leaving.map((animation) => animation.finished));
  if (revision !== languageRevision) return;
  const target = requestedLanguage;
  requestedLanguage = null;
  setSetting('lang', target);
  await nextTick();
  if (revision !== languageRevision) return;
  languageAnimations.push(
    ...languageTextElements().map((element) =>
      element.animate(
        [{ clipPath: 'inset(-0.2em 100% -0.2em 0)' }, { clipPath: 'inset(-0.2em 0% -0.2em 0)' }],
        { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' },
      ),
    ),
  );
  leaving.forEach((animation) => animation.cancel());
  languageAnimations = languageAnimations.filter((animation) => !leaving.includes(animation));
  const after = new Map(elements.map((element) => [element, element.getBoundingClientRect()]));
  const timing = { duration: 280, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' };
  for (const element of elements) {
    const old = before.get(element),
      next = after.get(element);
    if (!next.width || !next.height) continue;
    let parent = element.parentElement;
    while (parent && !after.has(parent)) parent = parent.parentElement;
    const parentOld = before.get(parent),
      parentNext = after.get(parent);
    const x = old.x - next.x - (parentOld ? parentOld.x - parentNext.x : 0);
    const y = old.y - next.y - (parentOld ? parentOld.y - parentNext.y : 0);
    if (Math.abs(x) > 0.1 || Math.abs(y) > 0.1) {
      languageAnimations.push(
        element.animate([{ translate: `${x}px ${y}px` }, { translate: '0px 0px' }], timing),
      );
    }
    // 带底色的独立按钮/徽标过渡宽度，文字始终按自然字号显示。
    if (element.matches('button') && Math.abs(old.width - next.width) > 0.5) {
      languageAnimations.push(
        element.animate(
          [old, next].map((rect) => ({
            width: `${rect.width}px`,
            minWidth: `${rect.width}px`,
            maxWidth: `${rect.width}px`,
            boxSizing: 'border-box',
            overflow: 'clip',
          })),
          timing,
        ),
      );
    }
  }
  navigation.value?.updateIndicator(false);
  scrollbar.value?.sync(true);
  await Promise.allSettled(languageAnimations.map((animation) => animation.finished));
  if (revision === languageRevision) {
    const queued = requestedLanguage;
    requestedLanguage = null;
    finishLanguageChange();
    if (queued && queued !== appSettings.lang) changeLanguage(queued);
  }
}
provide('cf-change-language', changeLanguage);
// 连续按键以最后请求的语言为起点，复用菜单已有的文案和布局过渡。
function cycleMenuLanguage() {
  const current = requestedLanguage ?? appSettings.lang;
  const index = languages.findIndex((language) => language.code === current);
  const next = languages[(index + 1) % languages.length];
  if (next) changeLanguage(next.code);
}
let releaseLanguageShortcut;
// 捕获正在播放的视觉状态，让快速切页从当前画面续接而不是跳回起点。
function readPanelFrame(panel) {
  if (!panel?.classList.contains('active')) return null;
  const style = getComputedStyle(panel);
  return { opacity: style.opacity, transform: style.transform };
}
// 右侧页面同节奏交叉过渡，旧内容淡出前新内容已进入，避免中途空白。
function switchTab(id) {
  if (id === activeTab.value) return;
  finishLanguageChange();
  tooltip.hide();
  const panels = [...panelHost.value.children];
  const old = panels[ids.indexOf(activeTab.value)],
    next = panels[ids.indexOf(id)];
  const oldFrame = readPanelFrame(old),
    nextFrame = readPanelFrame(next);
  const scrollTop = contentArea.value.scrollTop;
  cleanup?.();
  resetScrollFloor();
  const down = ids.indexOf(id) >= ids.indexOf(activeTab.value);
  activeTab.value = id;
  if (
    old &&
    next &&
    typeof next.animate === 'function' &&
    old.offsetWidth > 0 &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    const areaStyle = getComputedStyle(contentArea.value);
    panelHost.value.style.minHeight =
      Math.max(
        0,
        contentArea.value.clientHeight -
          parseFloat(areaStyle.paddingTop) -
          parseFloat(areaStyle.paddingBottom),
      ) + 'px';
    Object.assign(old.style, {
      position: 'absolute',
      top: -scrollTop + 'px',
      left: '0',
      right: '0',
      pointerEvents: 'none',
      zIndex: '1',
    });
    old.inert = true;
    old.setAttribute('aria-hidden', 'true');
    next.classList.add('active');
    next.inert = false;
    // 内容区是磨砂玻璃，新页不能再垫一层不透明底色（切换结束撤掉时会闪一下）；
    // 新旧两页靠各自的淡入淡出错开，旧页在新页完全显现前已经淡去。
    Object.assign(next.style, {
      position: 'relative',
      zIndex: '2',
      minHeight: panelHost.value.style.minHeight,
    });
    contentArea.value.scrollTop = 0;
    scrollbar.value?.sync(true);
    const timing = { duration: 300, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'both' };
    const exit = old.animate(
      [
        oldFrame || { opacity: 1, transform: 'translateY(0)' },
        {
          opacity: Math.min(Number(oldFrame?.opacity ?? 1), 0.9),
          transform: 'translateY(' + (down ? -2 : 2) + 'px)',
          offset: 0.28,
        },
        { opacity: 0, transform: 'translateY(' + (down ? -8 : 8) + 'px)' },
      ],
      timing,
    );
    const enter = next.animate(
      [
        nextFrame || { opacity: 0, transform: 'translateY(' + (down ? 12 : -12) + 'px)' },
        { opacity: 1, transform: 'translateY(0)', offset: 0.8 },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      timing,
    );
    let cleaned = false;
    cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      exit.cancel();
      enter.cancel();
      old.classList.remove('active');
      old.inert = false;
      old.removeAttribute('aria-hidden');
      panelHost.value.style.minHeight = '';
      for (const key of [
        'position',
        'top',
        'left',
        'right',
        'width',
        'pointerEvents',
        'zIndex',
        'opacity',
        'transform',
      ])
        old.style[key] = '';
      for (const key of ['position', 'zIndex', 'opacity', 'transform', 'minHeight'])
        next.style[key] = '';
      cleanup = null;
    };
    enter.onfinish = cleanup;
  } else {
    panels.forEach((panel, index) => panel.classList.toggle('active', ids[index] === id));
    contentArea.value.scrollTop = 0;
    scrollbar.value?.sync(false);
  }
}
// 关闭菜单时取消动画和提示，但不销毁页面状态。
function closeMenu() {
  finishLanguageChange();
  visible.value = false;
  tooltip.hide();
  cleanup?.();
  resetScrollFloor();
}
// 打开菜单后重置滚动并校准侧栏指示条。
function toggleMenu() {
  if (visible.value) {
    closeMenu();
    return;
  }
  visible.value = true;
  contentArea.value.scrollTop = 0;
  nextTick(() => requestAnimationFrame(() => navigation.value.updateIndicator(false)));
}
// 仅响应页面可见性事件，不为玻璃动效增加轮询或逐帧脚本。
function syncMenuVisibility() {
  documentHidden.value = document.hidden;
}
onMounted(() => {
  document.addEventListener('visibilitychange', syncMenuVisibility);
  releaseLanguageShortcut = configureLanguageShortcut(cycleMenuLanguage);
  panelHost.value.children[0].classList.add('active');
  preventScrollChaining(modal.value);
});
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', syncMenuVisibility);
  releaseLanguageShortcut?.();
  cleanup?.();
  finishLanguageChange();
});
</script>
<template>
  <div
    class="cf-menu-theme"
    ref="menuRoot"
    :style="[theme, menuLayout.rootStyle]"
    @click.capture="menuLayout.suppressDragClick"
    style="
      position: fixed;
      z-index: 999999;
      font-family:
        -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    "
  >
    <MenuLayout :layout="menuLayout">
      <div
        class="cf-settings-modal"
        style="display: flex"
        :style="menuLayout.modalStyle"
        ref="modal"
        v-show="visible"
      >
        <MenuGlassSurface
          class="cf-modal-header"
          :class="{
            'is-positionable': menuLayout.position.enabled,
            'is-position-dragging': menuLayout.moving,
          }"
          @pointerdown="menuLayout.startMove($event, 'panel')"
          @pointermove="menuLayout.moveDrag"
          @pointerup="menuLayout.finishDrag"
          @pointercancel="menuLayout.finishDrag"
          @lostpointercapture="menuLayout.finishDrag"
        >
          <div class="cf-header-left">
            <span class="cf-header-logo" aria-hidden="true">
              <InlineSvg
                :source="assets.colorforcesMark"
                layer="cf-launcher-flower"
                id-prefix="cf-header-logo"
              />
            </span>
            <div class="cf-header-title">
              Colorforces <span class="cf-title-version">v{{ CURRENT_VERSION }}</span>
            </div>
          </div>
          <button type="button" class="cf-close-btn" title="Close" @click="closeMenu">
            <inline-svg v-bind:source="assets.closeIcon"></inline-svg>
          </button>
        </MenuGlassSurface>
        <div class="cf-modal-body">
          <menu-nav
            ref="navigation"
            :active="activeTab"
            @select="switchTab"
            @theme="theme = $event"
          ></menu-nav>
          <div class="cf-content-viewport">
            <div
              class="cf-content-area"
              id="cf-menu-content"
              ref="contentArea"
              @scroll.passive="trimScrollFloor"
              tabindex="0"
              :aria-label="t('menuContentLabel')"
            >
              <div class="cf-content-panels" ref="panelHost">
                <general-page :active="activeTab === 'general'"></general-page
                ><appearance-page :active="activeTab === 'appearance'"></appearance-page
                ><ratings-page :active="activeTab === 'ratings'"></ratings-page
                ><prediction-page :active="activeTab === 'prediction'"></prediction-page
                ><user-page :active="activeTab === 'user'"></user-page
                ><shortcuts-page :active="visible && activeTab === 'shortcuts'"></shortcuts-page
                ><storage-page :active="visible && activeTab === 'storage'"></storage-page
                ><changelog-page :active="activeTab === 'changelog'"></changelog-page
                ><roadmap-page :active="activeTab === 'roadmap'"></roadmap-page
                ><acknowledgments-page
                  :active="visible && activeTab === 'acknowledgments'"
                ></acknowledgments-page>
              </div>
            </div>
            <MenuScrollbar
              ref="scrollbar"
              :viewport="contentArea"
              :content="panelHost"
              :visible="visible"
            />
          </div>
        </div>
        <menu-footer></menu-footer>
        <MenuResizeHandles :controller="menuLayout" :open="visible" />
      </div>
    </MenuLayout>
    <menu-launcher
      :open="visible"
      :spot="menuSpot"
      :dragging="menuLayout.moving"
      @toggle="toggleMenu"
      :class="{
        'is-positionable': menuLayout.position.enabled,
        'is-position-dragging': menuLayout.moving,
      }"
      @pointerdown="menuLayout.startMove($event, 'button')"
      @pointermove="menuLayout.moveDrag"
      @pointerup="menuLayout.finishDrag"
      @pointercancel="menuLayout.finishDrag"
      @lostpointercapture="menuLayout.finishDrag"
    ></menu-launcher>
  </div>
  <PredictionAnalysisDialog />
  <FloatingTooltip /><ConfirmDialog /><UpdateDialog /><ClistSyncDialog /><ClistKeyGuide /><ClistSyncGuide /><TimeFormatGuide /><VerdictGuide /><StorageJsonDialog />
</template>
<style>
@property --cf-menu-accent {
  syntax: '<color>';
  inherits: true;
  initial-value: #5576df;
}
@property --cf-menu-secondary {
  syntax: '<color>';
  inherits: true;
  initial-value: #27b7a5;
}

@property --cf-paint-accent {
  syntax: '<color>';
  inherits: false;
  initial-value: #5576df;
}
@property --cf-paint-secondary {
  syntax: '<color>';
  inherits: false;
  initial-value: #27b7a5;
}

.cf-setting-label,
.cf-setting-sublabel {
  line-height: 20px;
}

/* 文字拥有独立绘制区域，遮罩不会带走按钮底色或旁边的图标。 */
.cf-menu-theme [data-cf-language-text] {
  display: inline-block;
}

/* 自绘图标使用深轮廓与浅点缀；品牌图标不进入此配色规则。 */
.cf-menu-theme svg[data-cf-icon] {
  --cf-icon-ink: color-mix(in srgb, var(--cf-icon-primary) 70%, #2b3d50);
  --cf-icon-detail: color-mix(in srgb, var(--cf-icon-secondary) 78%, var(--cf-icon-primary));
}

/* 中性表面共用主题层次；评分、品牌、提示与警告仍保留各自语义色。 */
/* 内容区本身是磨砂玻璃；这里的内容底色是它的不透明近似值，供卡片等需要实底的元素推导用。 */
.cf-menu-theme {
  --cf-content-surface: color-mix(in srgb, var(--cf-menu-accent) 6%, #fcfdfe);
  --cf-card-surface: color-mix(in srgb, var(--cf-menu-accent) 4%, var(--cf-content-surface));
  --cf-card-hover: color-mix(in srgb, var(--cf-menu-accent) 9%, var(--cf-content-surface));
  --cf-control-surface: color-mix(in srgb, var(--cf-menu-accent) 5%, var(--cf-content-surface));
  --cf-control-active: color-mix(in srgb, var(--cf-menu-accent) 18%, #f6f9fc);
  --cf-control-ink: color-mix(in srgb, var(--cf-menu-accent) 46%, #27364e);
  --cf-surface-border: color-mix(in srgb, var(--cf-menu-accent) 18%, #dde5ee);
}

/*
 * 只给实际绘制背景的节点插值，颜色动画不向整棵菜单继承。
 * 时长与缓动和侧栏指示条的位移相同：指示条停下时，底色也正好变完。
 */
.cf-sidebar-nav,
.cf-content-viewport {
  --cf-paint-accent: var(--cf-menu-accent);
  --cf-paint-secondary: var(--cf-menu-secondary);
  transition:
    --cf-paint-accent 480ms cubic-bezier(0.16, 1, 0.3, 1),
    --cf-paint-secondary 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

.cf-menu-theme
  :is(input[type='text'], input[type='password'], input[type='number'], textarea, select) {
  background: var(--cf-control-surface);
  color: var(--cf-gray-700);
  border: 1px solid var(--cf-surface-border);
  transition:
    background-color 220ms ease,
    border-color 220ms ease,
    box-shadow 220ms ease;
}

.cf-menu-theme
  :is(input[type='text'], input[type='password'], input[type='number'], textarea, select):focus {
  background: var(--cf-control-active);
  border-color: var(--cf-menu-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--cf-menu-accent) 15%, transparent);
  outline: none;
}

/* 滑块与开关一致，跟随当前页面的主题色。 */
.cf-menu-theme input[type='range'] {
  accent-color: var(--cf-menu-accent);
}

.cf-version-tag {
  background-color: #e6f7ff;
  color: #1890ff;
  border: 1px solid #91d5ff;
  font-size: var(--cf-font-size-base);
  font-weight: var(--cf-font-weight-bold);
  padding: 2px 8px;
  border-radius: var(--cf-radius-sm);
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.5px;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.cf-settings-modal {
  position: relative;
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--cf-menu-accent) 18%, var(--cf-gray-200));
  border-radius: 14px;
  box-shadow:
    0 12px 35px rgba(0, 0, 0, 0.14),
    0 2px 6px rgba(0, 0, 0, 0.04),
    0 0 28px color-mix(in srgb, var(--cf-menu-accent) 9%, transparent);
  display: none;
  flex-direction: column;
  color: var(--cf-gray-800);
  box-sizing: border-box;
  overflow: hidden;
  overscroll-behavior: contain;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  /* 玻璃祖先层保持不透明，避免淡入期间无法采样并模糊原网页。 */
  animation: cf-menu-open 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  transition:
    border-color 480ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes cf-menu-open {
  from {
    transform: translateY(var(--cf-menu-open-y, -6px)) scale(0.98);
  }
  to {
    transform: translateY(0) scale(1);
  }
}

.cf-modal-header {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom-width: 1px;
  border-bottom-style: solid;
  /* 玻璃自己带上与菜单外框对应的圆角：只靠外层裁切时，模糊区域仍是直角，四角会露出一小块方形的模糊。 */
  border-radius: 13px 13px 0 0;
}

.cf-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cf-header-logo {
  position: relative;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  animation: cf-header-logo-turn 20s linear infinite;
  will-change: transform;
}

.cf-header-logo .cf-launcher-motion {
  animation: none;
  transform: none;
}

/* 整体在独立容器内转动，花瓣本身不额外缩放或逐帧重排。 */
.cf-header-logo .cf-launcher-flower {
  transition: none;
}

@keyframes cf-header-logo-turn {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cf-header-logo {
    animation: none;
  }
}

@keyframes cf-title-rainbow-roll {
  0% {
    background-position: 0% center;
  }
  100% {
    background-position: 200% center;
  }
}

.cf-header-title {
  font-family: 'Kaushan Script', 'Satisfy', 'Segoe Script', 'Brush Script MT', cursive, sans-serif;
  font-size: 26px;
  font-weight: var(--cf-font-weight-bold);
  letter-spacing: 0.6px;
  background: linear-gradient(
    90deg,
    #ff8e9e 0%,
    #ffd166 16.6%,
    #69db7c 33.3%,
    #48cae4 50%,
    #91a7ff 66.6%,
    #f783ac 83.3%,
    #ff8e9e 100%,
    #ffd166 116.6%,
    #69db7c 133.3%,
    #48cae4 150%,
    #91a7ff 166.6%,
    #f783ac 183.3%,
    #ff8e9e 200%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation: cf-title-rainbow-roll 4s linear infinite;
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  line-height: 1.15;
  user-select: none;
  margin: 0;
  padding: 0;
}

.cf-title-version {
  font-family: inherit;
  font-size: 20px;
  font-weight: var(--cf-font-weight-bold);
  letter-spacing: 0.5px;
  opacity: 0.95;
  padding-right: 6px;
  display: inline-block;
}

.cf-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: var(--cf-radius-md);
  color: var(--cf-gray-400);
  cursor: pointer;
  transition: color 0.15s ease;
  padding: 0;
  line-height: 1;
  box-shadow: none;
  flex-shrink: 0;
}

.cf-close-btn:hover {
  color: #151b25;
}

.cf-modal-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  /* 不垫底色：侧栏和内容区都是玻璃，要透过这一层采样到菜单背后的页面。 */
  background: transparent;
  overscroll-behavior: contain;
}

.cf-section-title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #1677ff;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.cf-section-title-icon svg {
  width: 18px;
  height: 18px;
  display: block;
}

/*
 * 内容区是一层薄的磨砂玻璃：七成不透明的白，叠 6% 的主题色，把底下的页面模糊掉。
 * 颜色取 --cf-paint-accent，换页时随它一起过渡。
 */
.cf-content-viewport {
  background: color-mix(in srgb, var(--cf-paint-accent) 6%, rgb(255 255 255 / 70%));
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  backdrop-filter: blur(12px) saturate(140%);
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  position: relative;
  padding-right: 6px;
}
/* 不支持背景模糊时退回不透明底色，保证文字底下是纯色。 */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .cf-content-viewport {
    background: color-mix(in srgb, var(--cf-paint-accent) 6%, #fcfdfe);
  }
}

.cf-content-area {
  flex: 1;
  min-width: 0;
  padding: 14px 18px;
  overflow-x: hidden !important;
  overflow-y: auto;
  scrollbar-width: none;
  overscroll-behavior: contain;
  box-sizing: border-box;
  position: relative;
  overflow-anchor: none;
}

.cf-content-area::-webkit-scrollbar {
  display: none;
}

.cf-content-area:focus-visible {
  outline: 2px solid #bfdbfe;
  outline-offset: -2px;
}

/* 只由当前页面决定滚动高度，退出页和位移动画不再撑动滚动条。 */
.cf-content-panels {
  position: relative;
  min-height: var(--cf-scroll-floor, 0px);
  display: flow-root;
  overflow: clip;
}

.cf-tab-panel {
  display: none;
  flex-direction: column;
  gap: 12px;
  will-change: transform, opacity;
  transform-origin: center top;
}

.cf-tab-panel.active {
  display: flex;
}

.cf-setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 32px;
}

.cf-setting-label {
  font-size: var(--cf-font-size-lg);
  font-weight: var(--cf-font-weight-semibold);
  color: var(--cf-gray-700);
  user-select: none;
}

.cf-setting-sublabel {
  font-size: var(--cf-font-size-base);
  color: var(--cf-gray-500);
  user-select: none;
}

.cf-settings-modal a,
.cf-settings-modal a:link,
.cf-settings-modal a:visited {
  text-decoration: none !important;
}

@media (prefers-reduced-motion: reduce) {
  .cf-menu-theme *,
  .cf-menu-theme *::before,
  .cf-menu-theme *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
  .cf-menu-theme {
    transition: none;
  }
  .cf-header-title {
    animation: none;
  }
}
</style>
