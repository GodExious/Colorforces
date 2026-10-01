<script>
import { reactive, nextTick } from 'vue';
// 创建提示控制器；视图由同文件组件挂载。
export function createTooltipController() {
  const state = reactive({
    text: '',
    visible: false,
    mounted: false,
    positioning: false,
    originX: 0,
    originY: 0,
    radius: 0,
    top: 0,
    left: 0,
    arrow: 10,
    arrowTop: 10,
    placement: 'top',
    variant: '',
    themed: false,
  });
  let element;
  let revision = 0;
  let hideTimer;
  const releases = new Set();
  // 隐藏提示，同时使尚未完成的定位失效。
  function hide() {
    revision++;
    state.visible = false;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(
      () => {
        state.mounted = false;
      },
      matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240,
    );
  }
  // 按原版边缘避让和箭头算法显示提示。
  async function show(anchor, text, options = {}) {
    if (!anchor || !text) return;
    const current = ++revision;
    clearTimeout(hideTimer);
    Object.assign(state, {
      text,
      visible: false,
      mounted: true,
      positioning: true,
      themed: Boolean(anchor.closest('.cf-menu-theme')),
      variant: options.variant || '',
    });
    await nextTick();
    if (!element || current !== revision) return;
    const tipRect = element.getBoundingClientRect();
    const rect = anchor.getBoundingClientRect();
    let top = rect.top - tipRect.height - 7;
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    let placement = 'top';
    if (state.variant === 'launcher') {
      top = Math.max(
        8,
        Math.min(
          window.innerHeight - tipRect.height - 8,
          rect.top + (rect.height - tipRect.height) / 2,
        ),
      );
      left = rect.left - tipRect.width - 10;
      placement = 'left';
      if (left < 10) {
        left = rect.right + 10;
        placement = 'right';
      }
    } else if (top < 8) {
      top = rect.bottom + 7;
      placement = 'bottom';
    }
    if (left < 10) left = 10;
    else if (left + tipRect.width > window.innerWidth - 10)
      left = window.innerWidth - tipRect.width - 10;
    Object.assign(state, {
      top,
      left,
      originX: rect.left + rect.width / 2 - left,
      originY: rect.top + rect.height / 2 - top,
      radius: Math.hypot(tipRect.width + rect.width, tipRect.height + rect.height) + 36,
      placement,
      arrow: Math.max(10, Math.min(tipRect.width - 10, rect.left + rect.width / 2 - left)),
      arrowTop: Math.max(10, Math.min(tipRect.height - 10, rect.top + rect.height / 2 - top)),
    });
    await nextTick();
    if (!element || current !== revision) return;
    // 先提交最终定位，再让浮层从该位置进入，避免首帧从旧位置跳来。
    element.getBoundingClientRect();
    if (current === revision) {
      state.positioning = false;
      await nextTick();
      if (!element || current !== revision) return;
      element.getBoundingClientRect();
      state.visible = true;
    }
  }
  // 仅为被省略的文字显示完整内容，供快捷键和存储图注共用。
  function showIfTruncated(event) {
    const target = event.currentTarget;
    if (target.scrollWidth > target.clientWidth) show(target, target.textContent);
  }
  // 委托绑定动态提示节点，避免重复注册逐元素监听。
  function bind(root = document, { native = false } = {}) {
    let active = null,
      borrowed = null,
      activeObserver = null;
    // 只查当前事件路径，原生 title 在离开时恢复，不扫描页面或批量改写属性。
    const targetFor = (node) => {
      const element = node?.nodeType === 1 ? node : node?.parentElement;
      if (!element || !root.contains(element)) return null;
      const target = element.closest(
        native ? '[data-tooltip], [title], [data-cf-native-tooltip]' : '[data-tooltip]',
      );
      if (!target || !root.contains(target)) return null;
      if (target.hasAttribute('data-tooltip')) return target.dataset.tooltip ? target : null;
      return native &&
        target.closest('#header, #body, #pageContent, #sidebar, #footer') &&
        !target.closest('.cf-settings-modal, .cf-prediction-overlay, #cf-floating-tooltip') &&
        (target.getAttribute('title') || target.hasAttribute('data-cf-native-tooltip'))
        ? target
        : null;
    };
    const restore = () => {
      if (!borrowed) return;
      if (!borrowed.element.hasAttribute('title'))
        borrowed.element.setAttribute('title', borrowed.text);
      borrowed.element.removeAttribute('data-cf-native-tooltip');
      borrowed = null;
    };
    const observeActive = (target) => {
      activeObserver?.disconnect();
      activeObserver = null;
      if (!target) return;
      activeObserver = new MutationObserver(() => {
        if (target !== active) return;
        const text =
          target.getAttribute('data-tooltip') ??
          target.getAttribute('data-cf-native-tooltip') ??
          target.getAttribute('title');
        if (text) show(target, text, { variant: target.dataset.tooltipVariant || '' });
      });
      activeObserver.observe(target, {
        attributes: true,
        attributeFilter: [
          'data-tooltip',
          'data-tooltip-variant',
          'title',
          'data-cf-native-tooltip',
        ],
      });
    };
    const activate = (target) => {
      if (target === active) return;
      activeObserver?.disconnect();
      activeObserver = null;
      restore();
      active = target;
      if (!target) {
        hide();
        return;
      }
      let text = target.getAttribute('data-tooltip');
      if (text === null) {
        text = target.getAttribute('title');
        borrowed = { element: target, text };
        target.setAttribute('data-cf-native-tooltip', text);
        target.removeAttribute('title');
      }
      observeActive(target);
      show(target, text, { variant: target.dataset.tooltipVariant || '' });
    };
    const enter = (event) => activate(targetFor(event.target));
    const leave = (event) => activate(targetFor(event.relatedTarget));
    root.addEventListener('mouseover', enter);
    root.addEventListener('mouseout', leave);
    root.addEventListener('focusin', enter);
    root.addEventListener('focusout', leave);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    const release = () => {
      activeObserver?.disconnect();
      activeObserver = null;
      restore();
      root.removeEventListener('mouseover', enter);
      root.removeEventListener('mouseout', leave);
      root.removeEventListener('focusin', enter);
      root.removeEventListener('focusout', leave);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      releases.delete(release);
    };
    releases.add(release);
    return release;
  }
  // 解除所有绑定，并释放视图引用。
  function dispose() {
    hide();
    clearTimeout(hideTimer);
    state.mounted = false;
    [...releases].forEach((release) => release());
    element = null;
  }
  return {
    state,
    show,
    showIfTruncated,
    hide,
    bind,
    dispose,
    attach: (node) => {
      element = node;
    },
  };
}
export const tooltip = createTooltipController();
</script>
<script setup>
import { ref, computed, inject, onMounted, onBeforeUnmount } from 'vue';
const element = ref(null);
const theme = inject('cf-menu-theme', ref({}));
const state = tooltip.state;
const classes = computed(() => [
  'cf-tip-' + state.placement,
  {
    visible: state.visible,
    'cf-menu-theme': state.themed,
    'cf-tip-launcher': state.variant === 'launcher',
    'cf-tip-prediction-rank': state.variant === 'prediction-rank',
  },
]);
const styles = computed(() => ({
  ...(state.themed ? theme.value : {}),
  display: state.mounted ? 'block' : 'none',
  transition: state.positioning ? 'none' : undefined,
  visibility: state.mounted ? 'visible' : 'hidden',
  top: state.top + 'px',
  left: state.left + 'px',
  '--arrow-left': state.arrow + 'px',
  '--arrow-top': state.arrowTop + 'px',
  '--tip-x': state.originX + 'px',
  '--tip-y': state.originY + 'px',
  '--tip-radius': state.radius + 'px',
}));
onMounted(() => {
  tooltip.attach(element.value);
  tooltip.bind(document, { native: true });
});
onBeforeUnmount(tooltip.dispose);
</script>
<template>
  <Teleport to="body"
    ><div
      id="cf-floating-tooltip"
      role="tooltip"
      ref="element"
      class="cf-floating-tooltip"
      :class="classes"
      :style="styles"
    >
      <template v-if="state.variant === 'prediction-rank'">
        <span
          v-for="(line, index) in state.text.split('\n')"
          :key="index"
          class="cf-tip-rank-line"
          >{{ line }}</span
        >
      </template>
      <template v-else>{{ state.text }}</template>
    </div></Teleport
  >
</template>

<style>
.cf-floating-tooltip {
  --cf-tip-surface: rgba(15, 23, 42, 0.92);
  position: fixed;
  z-index: 10000030;
  max-width: 280px;
  padding: 7px 11px;
  background: var(--cf-tip-surface);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: #ffffff;
  font-size: 11.5px;
  font-weight: normal;
  line-height: 1.5;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
  pointer-events: none;
  white-space: normal;
  word-break: break-word;
  visibility: hidden;
  clip-path: circle(0px at var(--tip-x) var(--tip-y));
  transition: clip-path 220ms cubic-bezier(0.22, 1, 0.36, 1);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  display: none;
}

.cf-floating-tooltip.visible {
  visibility: visible;
  clip-path: circle(var(--tip-radius) at var(--tip-x) var(--tip-y));
}

.cf-floating-tooltip.cf-tip-prediction-rank {
  box-sizing: border-box;
  width: max-content;
  max-width: min(420px, calc(100vw - 24px));
  padding: 8px 12px;
  line-height: 1.55;
  white-space: pre-line;
  word-break: keep-all;
  overflow-wrap: normal;
}
.cf-tip-rank-line {
  display: block;
}
.cf-tip-rank-line:first-child {
  font-weight: 600;
}
.cf-tip-rank-line:nth-child(2) {
  margin-top: 3px;
  font-variant-numeric: tabular-nums;
  color: #d8e6f4;
}
.cf-tip-rank-line:last-child {
  margin-top: 2px;
  color: #b8c7d9;
}

.cf-floating-tooltip::after {
  content: '';
  position: absolute;
  border: 4px solid transparent;
  left: var(--arrow-left, 50%);
  transform: translateX(-50%);
}

.cf-floating-tooltip.cf-tip-top::after {
  top: 100%;
  border-top-color: var(--cf-tip-surface);
}

.cf-floating-tooltip.cf-tip-bottom::after {
  bottom: 100%;
  border-bottom-color: var(--cf-tip-surface);
}
.cf-floating-tooltip.cf-menu-theme {
  --cf-tip-surface: color-mix(in srgb, var(--cf-menu-accent) 24%, #233047);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--cf-menu-accent) 18%, #23304730);
  transition:
    clip-path 220ms cubic-bezier(0.22, 1, 0.36, 1),
    --cf-menu-accent 480ms ease,
    --cf-menu-secondary 480ms ease;
}
/* 入口用轻盈侧边引导；其他功能继续使用既有深色说明提示。 */
.cf-floating-tooltip.cf-tip-launcher {
  --cf-tip-surface: color-mix(in srgb, var(--cf-menu-accent, #9980bc) 8%, #fff);
  padding: 7px 12px 7px 23px;
  border: 1px solid color-mix(in srgb, var(--cf-menu-accent, #9980bc) 20%, #ffffffb8);
  border-radius: 999px;
  background: linear-gradient(135deg, #ffffffef, var(--cf-tip-surface));
  color: color-mix(in srgb, var(--cf-menu-accent, #9980bc) 24%, #465166);
  font-weight: 500;
  box-shadow: 0 3px 11px #44516a14;
  clip-path: inset(-12px -12px -12px 100% round 16px);
  transform: translateX(5px);
  transition:
    clip-path 220ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    --cf-menu-accent 480ms ease,
    --cf-menu-secondary 480ms ease;
}
.cf-floating-tooltip.cf-tip-launcher::before {
  content: '';
  position: absolute;
  left: 11px;
  top: calc(50% - 2px);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--cf-menu-accent, #9980bc);
  box-shadow: 0 0 5px color-mix(in srgb, var(--cf-menu-accent, #9980bc) 30%, transparent);
}
.cf-floating-tooltip.cf-tip-launcher::after {
  top: calc(var(--arrow-top) - 3px);
  left: auto;
  right: -3px;
  width: 6px;
  height: 6px;
  border: none;
  background: var(--cf-tip-surface);
  transform: rotate(45deg);
}
.cf-floating-tooltip.cf-tip-launcher.cf-tip-right {
  clip-path: inset(-12px 100% -12px -12px round 16px);
  transform: translateX(-5px);
}
.cf-floating-tooltip.cf-tip-launcher.cf-tip-right::after {
  left: -3px;
  right: auto;
}
.cf-floating-tooltip.cf-tip-launcher.visible {
  clip-path: inset(-12px round 16px);
  transform: translateX(0);
}
@media (prefers-reduced-motion: reduce) {
  .cf-floating-tooltip,
  .cf-floating-tooltip.cf-menu-theme,
  .cf-floating-tooltip.cf-tip-launcher {
    transition: none;
  }
}
</style>
