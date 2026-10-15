<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, provide } from 'vue';
import { CURRENT_VERSION } from '../config/runtime.js';
import { appSettings, setSetting } from '../settings.js';
import { translate as t } from '../i18n/index.js';
import { languages } from '../i18n/languages.js';
import {
  configureLanguageShortcut,
  configureFrameLibraryShortcut,
  configureGroupsManageShortcut,
} from '../features/shortcuts/index.js';
import { bindGroupTagTips } from './pages/groups/tag-tips.js';
import * as assets from '../assets/index.js';
import InlineSvg from './components/icons/InlineSvg/InlineSvg.vue';
import FloatingTooltip, {
  tooltip,
} from './components/tooltips/FloatingTooltip/FloatingTooltip.vue';
import ConfirmDialog, { confirmShown } from './components/dialogs/ConfirmDialog/ConfirmDialog.vue';
import { preventScrollChaining } from '../utils/scroll.js';
import { runLanguageWave, finishLanguageWave } from '../utils/language-wave.js';
import { PLUGIN_UI_SELECTOR } from '../features/page/plugin-ui.js';
import { getCurrentUserHandle } from '../features/page/account.js';
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
import GroupsPage from './pages/groups/GroupsPage.vue';
import GroupsDialog, {
  showGroupsDialog,
  groupsDialogShown,
  closeGroupsDialog,
} from './pages/groups/components/GroupsDialog/GroupsDialog.vue';
import FrameDialog, {
  showFrameDialog,
  frameDialogShown,
  closeFrameDialog,
} from './pages/user/components/FrameDialog/FrameDialog.vue';
import UserMenu from './pages/groups/components/UserMenu/UserMenu.vue';
import PredictionAnalysisDialog from './pages/prediction/components/PredictionAnalysisDialog/PredictionAnalysisDialog.vue';
import UserAnalyticsPanel from './pages/user/components/UserAnalyticsPanel/UserAnalyticsPanel.vue';
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
// 登录着的账号，没登录时是空的。分组页按账号存数据，没登录时这一页不能用；每次打开菜单时重新认一次。
const owner = ref('');
const disabledTabs = computed(() => (owner.value ? [] : ['groups']));
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
// 换语言：菜单、弹窗、数据分析面板等各个界面带着逐项波浪的过渡一起换成新的文字，见 utils/language-wave.js。
// 过渡还在播的时候又换了一次，就结束上一轮、从当前的画面开始新的一轮，只认最后一次选择。
let releaseLanguagePosition;
// 切页或关闭时结束正在播的过渡，界面直接到位。
function finishLanguageChange() {
  finishLanguageWave();
  releaseLanguagePosition?.();
  releaseLanguagePosition = null;
}
async function changeLanguage(code) {
  if (code === appSettings.general.lang) return;
  cleanup?.();
  tooltip.hide();
  finishLanguageChange();
  // 菜单开着时，换了语言内容可能变短：和折叠收起时一样先把滚动位置撑住，播完再放开。
  const release = visible.value ? holdCollapsePosition() : null;
  releaseLanguagePosition = release;
  await runLanguageWave(async () => {
    setSetting('general.lang', code);
    await nextTick();
    navigation.value?.updateIndicator(false);
    scrollbar.value?.sync(true);
  });
  if (release && releaseLanguagePosition === release) {
    release();
    releaseLanguagePosition = null;
  }
}
provide('cf-change-language', changeLanguage);
// 快捷键切到下一种语言。语言是立刻换的，连续按几下就是连着往后切。
function cycleMenuLanguage() {
  const current = appSettings.general.lang;
  const index = languages.findIndex((language) => language.code === current);
  const next = languages[(index + 1) % languages.length];
  if (next) changeLanguage(next.code);
}
// 快捷键开关的两个弹窗（头像框库、分组管理）：开着就关上，关着就打开。用快捷键打开一个时先关上另一个，
// 来回按只是在两个之间换，不会一层叠一层。确认提示开着时不理这两个快捷键，不在提示底下换弹窗。
function toggleFramesByKey() {
  if (confirmShown()) return;
  // 从分组管理里打开的头像框库关上后回到分组管理。
  if (frameDialogShown()) return closeFrameDialog();
  closeGroupsDialog();
  showFrameDialog();
}
function toggleGroupsByKey() {
  if (confirmShown()) return;
  if (groupsDialogShown()) {
    // 连同从分组管理里打开的头像框库一起关上。
    closeFrameDialog();
    return closeGroupsDialog();
  }
  // 用户分组关着时菜单里也没有「管理成员」，快捷键同样不打开。
  if (!appSettings.groups.enabled) return;
  closeFrameDialog();
  showGroupsDialog();
}
let releaseLanguageShortcut;
let releaseFrameLibraryShortcut;
let releaseGroupsManageShortcut;
let releaseGroupTagTips;
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
/*
 * 打开和关闭的过渡：菜单从挨着按钮的那一边展开，关闭时朝那一边收起（见 MenuLayout.vue）。
 * visible 一关就变成 false，各页据此停下自己的事；closing 让菜单在收起的这段时间里还留在页面上，
 * 收完（MenuLayout 发来 folded）才撤掉。
 */
const closing = ref(false);
let closeTimer = 0;
const motionless = () =>
  document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function onFolded() {
  clearTimeout(closeTimer);
  closing.value = false;
}
// 关闭菜单时取消动画和提示，但不销毁页面状态。
function closeMenu() {
  finishLanguageChange();
  const animated = visible.value && !motionless();
  visible.value = false;
  // 菜单里面的提示跟着菜单一起收起；菜单按钮自己的提示不归这里管（鼠标还停在按钮上时它要留着）。
  if (tooltip.state.variant !== 'launcher') tooltip.hide();
  cleanup?.();
  resetScrollFloor();
  clearTimeout(closeTimer);
  closing.value = animated;
  // 正常是等收起的过渡自己报完成；这里只是兜底，万一没报也不会一直留着。
  if (animated) closeTimer = setTimeout(onFolded, 800);
}
// 打开菜单后重置滚动并校准侧栏指示条。
function toggleMenu() {
  if (visible.value) {
    closeMenu();
    return;
  }
  // 还在收起的途中又点开：从收到的地方接着展开。
  onFolded();
  owner.value = getCurrentUserHandle() || '';
  // 上次停在分组页、这次没登录：回到第一页。
  if (disabledTabs.value.includes(activeTab.value)) activeTab.value = ids[0];
  visible.value = true;
  contentArea.value.scrollTop = 0;
  nextTick(() => requestAnimationFrame(() => navigation.value.updateIndicator(false)));
}
// 仅响应页面可见性事件，不为玻璃动效增加轮询或逐帧脚本。
function syncMenuVisibility() {
  documentHidden.value = document.hidden;
}
// 用鼠标点过的控件不留焦点。留着的话，之后一按键盘（比如按住 Shift 准备用快捷键），
// 浏览器就认为是在用键盘操作，给还握着焦点的那个控件画出焦点框，看起来像凭空多了一圈边。
// 菜单、弹窗、数据分析面板都这样处理。用键盘触发的点击（点击次数为 0）不管，Tab 键操作时焦点框照常显示；
// 输入文字的框也不管，点进去就是要打字的；点了之后要接着按上下键调的（数据分析面板的时区选择）也不管。
// 哪些地方的控件点过之后要放掉焦点：插件自己的界面、弹窗，以及画在原站页面上的控件（榜单里的小花按钮、刷新预测）。
const OWN_CONTROLS = PLUGIN_UI_SELECTOR + ', .cf-aurora-dialog, [data-cf-prediction]';
const TYPING =
  'input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"], [type="color"]), textarea, select, [contenteditable], [role="spinbutton"]';
function releasePointerFocus(event) {
  if (event.type === 'click' && !event.detail) return;
  const active = document.activeElement;
  if (!active?.closest || !active.closest(OWN_CONTROLS)) return;
  if (!active.matches(TYPING)) active.blur();
}
// 鼠标按下的那一刻控件就拿到焦点了，要等松开才算一次点击。按着没松开时按键盘，焦点框照样会出来，
// 所以按下之后也放一次：等浏览器把焦点给过去（按下这个事件处理完之后），再把它放掉。
// 放掉焦点不影响这次点击，松开时照常触发。滑动条除外：它在拖动的过程中要一直握着。
function releasePressFocus(event) {
  if (event.target?.closest?.('input[type="range"]')) return;
  setTimeout(() => releasePointerFocus(event));
}
onMounted(() => {
  document.addEventListener('click', releasePointerFocus);
  document.addEventListener('pointerdown', releasePressFocus);
  document.addEventListener('visibilitychange', syncMenuVisibility);
  releaseLanguageShortcut = configureLanguageShortcut(cycleMenuLanguage);
  releaseFrameLibraryShortcut = configureFrameLibraryShortcut(toggleFramesByKey);
  releaseGroupsManageShortcut = configureGroupsManageShortcut(toggleGroupsByKey);
  releaseGroupTagTips = bindGroupTagTips();
  panelHost.value.children[0].classList.add('active');
  preventScrollChaining(modal.value);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', releasePointerFocus);
  document.removeEventListener('pointerdown', releasePressFocus);
  document.removeEventListener('visibilitychange', syncMenuVisibility);
  releaseLanguageShortcut?.();
  releaseFrameLibraryShortcut?.();
  releaseGroupsManageShortcut?.();
  releaseGroupTagTips?.();
  cleanup?.();
  finishLanguageChange();
  clearTimeout(closeTimer);
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
    <MenuLayout :layout="menuLayout" :open="visible" @folded="onFolded">
      <div
        class="cf-settings-modal"
        data-cf-language-surface
        style="display: flex"
        :style="menuLayout.modalStyle"
        ref="modal"
        v-show="visible || closing"
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
            :disabled="disabledTabs"
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
                ><groups-page
                  :active="visible && activeTab === 'groups'"
                  :owner="owner"
                ></groups-page
                ><shortcuts-page :active="visible && activeTab === 'shortcuts'"></shortcuts-page
                ><storage-page
                  :active="visible && activeTab === 'storage'"
                  :menu-open="visible"
                ></storage-page
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
  <UserAnalyticsPanel />
  <FloatingTooltip /><ConfirmDialog /><UpdateDialog /><ClistSyncDialog /><ClistKeyGuide /><ClistSyncGuide /><TimeFormatGuide /><VerdictGuide /><StorageJsonDialog /><GroupsDialog /><FrameDialog /><UserMenu />
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
/* 选项文字后面带着说明图标（i）时，文字和图标排在一条线上、上下居中。
   原来是各页自己写，新加的选项容易漏掉，图标就按文字的基线摆、偏下一点，所以统一写在这里。 */
.cf-setting-label:has(> .cf-info-hint),
.cf-setting-sublabel:has(> .cf-info-hint) {
  display: inline-flex;
  align-items: center;
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
    --cf-paint-accent 480ms var(--cf-ease-out-strong),
    --cf-paint-secondary 480ms var(--cf-ease-out-strong);
}

.cf-menu-theme
  :is(input[type='text'], input[type='password'], input[type='number'], textarea, select) {
  background: var(--cf-control-surface);
  color: var(--cf-gray-700);
  border: 1px solid var(--cf-surface-border);
  transition:
    background-color var(--cf-duration-base) ease,
    border-color var(--cf-duration-base) ease,
    box-shadow var(--cf-duration-base) ease;
}

.cf-menu-theme
  :is(input[type='text'], input[type='password'], input[type='number'], textarea, select):focus {
  background: var(--cf-control-active);
  border-color: var(--cf-menu-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--cf-menu-accent) 15%, transparent);
  outline: none;
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
  /* 打开和关闭的过渡是展开、收起，写在 MenuLayout.vue 里。菜单这一层自己不能变透明：它是里面几块玻璃的祖先，
     它一透明，玻璃就采样不到菜单背后的页面，模糊效果在过渡期间会失效。 */
  transition:
    border-color 480ms var(--cf-ease-out-strong),
    box-shadow 480ms var(--cf-ease-out-strong);
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
  transition: color var(--cf-duration-fast) ease;
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

/* 子选项下面再分出的一组选项：再缩进一级，并在左侧画一条细线，表示它们从属于上面那一项。 */
.cf-nested-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-left: 2px;
  padding-left: 12px;
  border-left: 2px solid color-mix(in srgb, var(--cf-menu-accent) 22%, transparent);
}

.cf-nested-options .cf-setting-item {
  min-height: 28px;
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
