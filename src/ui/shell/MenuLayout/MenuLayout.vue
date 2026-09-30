<script>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { appSettings, saveSettings } from '../../../settings.js';
import { tooltip } from '../../components/tooltips/FloatingTooltip/FloatingTooltip.vue';
const margin = 20,
  gap = 11,
  duration = 280;
const defaultSize = { width: 680, minHeight: 440, heightRatio: 0.56 };
const dimensions = ['x', 'y', 'width', 'height', 'offsetX', 'offsetY'];
const clamp = (value, min, max) => Math.min(Math.max(min, max), Math.max(min, value));

// 统一管理菜单几何状态；仅在交互或过渡期间逐帧更新，不做常驻轮询。
export function useMenuLayout(root, visible) {
  const viewport = reactive({
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
    buttonWidth: 44,
    buttonHeight: 44,
  });
  const moving = ref(false),
    resizing = ref(false),
    animating = ref(false);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const tracks = computed(() => ({
    x: Math.max(0, viewport.width - margin * 2 - viewport.buttonWidth),
    y: Math.max(0, viewport.height - margin * 2 - viewport.buttonHeight),
  }));
  const panelAnchored = computed(
    () => appSettings.menuPosition.enabled && appSettings.menuPosition.reference === 'panel',
  );
  // 百分比对应当前定位对象的可用范围，0% 和 100% 都保留屏幕边距。
  const buttonAnchor = computed(() => {
    const position = appSettings.menuPosition;
    const x = margin + tracks.value.x * (position.enabled ? (position.x ?? 100) / 100 : 1);
    const y = position.enabled
      ? margin + tracks.value.y * ((position.y ?? defaultVertical()) / 100)
      : clamp(70, margin, margin + tracks.value.y);
    return {
      x,
      y,
      right: !position.enabled || x + viewport.buttonWidth / 2 >= viewport.width / 2,
      bottom: position.enabled && y + viewport.buttonHeight / 2 >= viewport.height / 2,
    };
  });
  // 只在原窗口尺寸下沿用抓取时的可见尺寸；窗口变化仍恢复原始宽高偏好。
  const heldPanelSize = computed(() => {
    const saved = appSettings.menuPosition.panelSize;
    return panelAnchored.value &&
      saved?.viewportWidth === viewport.width &&
      saved?.viewportHeight === viewport.height
      ? saved
      : null;
  });
  const limits = computed(() => {
    if (panelAnchored.value) {
      const width = Math.max(1, viewport.width - margin * 2);
      const height = Math.max(1, viewport.height - margin * 2 - (viewport.buttonHeight + gap) * 2);
      return {
        minWidth: Math.min(560, width, heldPanelSize.value?.width ?? Infinity),
        minHeight: Math.min(360, height, heldPanelSize.value?.height ?? Infinity),
        maxWidth: width,
        maxHeight: height,
      };
    }
    const a = buttonAnchor.value;
    const width = Math.max(
      1,
      appSettings.menuPosition.enabled
        ? a.right
          ? a.x + viewport.buttonWidth - margin
          : viewport.width - margin - a.x
        : viewport.width - margin * 2,
    );
    const height = Math.max(
      1,
      a.bottom ? a.y - gap - margin : viewport.height - margin - a.y - viewport.buttonHeight - gap,
    );
    return {
      minWidth: Math.min(560, Math.floor(width)),
      minHeight: Math.min(360, Math.floor(height)),
      maxWidth: Math.floor(width),
      maxHeight: Math.floor(height),
    };
  });
  // 关闭自定义时的默认尺寸，恢复数值与正常布局共用同一套规则。
  const automaticSize = computed(() => ({
    width: defaultSize.width,
    height: Math.max(defaultSize.minHeight, viewport.height * defaultSize.heightRatio),
  }));
  const target = computed(() => {
    const a = buttonAnchor.value,
      settings = appSettings.menuSize;
    // 保留原来的 680px、56vh 和 440px 最小高度，自定义定位才按可用空间避让。
    const { width: defaultWidth, height: defaultHeight } = automaticSize.value;
    let width = settings.enabled ? (settings.width ?? defaultWidth) : defaultWidth;
    let height = settings.enabled ? (settings.height ?? defaultHeight) : defaultHeight;
    if (settings.enabled || appSettings.menuPosition.enabled) {
      width = clamp(width, limits.value.minWidth, limits.value.maxWidth);
      height = clamp(height, limits.value.minHeight, limits.value.maxHeight);
    }
    if (panelAnchored.value) {
      if (heldPanelSize.value) {
        width = Math.min(width, heldPanelSize.value.width);
        height = Math.min(height, heldPanelSize.value.height);
      }
      const travel = panelTracks(width, height);
      const left = margin + travel.x * ((appSettings.menuPosition.x ?? 100) / 100);
      const top = margin + travel.y * ((appSettings.menuPosition.y ?? 0) / 100);
      const right = left + width / 2 >= viewport.width / 2;
      const above = top - margin,
        below = viewport.height - margin - top - height;
      let bottom = top + height / 2 >= viewport.height / 2;
      if (bottom && below < viewport.buttonHeight + gap) bottom = false;
      else if (!bottom && above < viewport.buttonHeight + gap) bottom = true;
      const x = right ? left + width - viewport.buttonWidth : left;
      const y = bottom ? top + height + gap : top - viewport.buttonHeight - gap;
      return { x, y, width, height, offsetX: left - x, offsetY: top - y, right, bottom };
    }
    return {
      x: a.x,
      y: a.y,
      width,
      height,
      offsetX: a.right ? viewport.buttonWidth - width : 0,
      offsetY: a.bottom ? -height - gap : viewport.buttonHeight + gap,
      right: a.right,
      bottom: a.bottom,
    };
  });
  const anchor = computed(() => ({ right: target.value.right, bottom: target.value.bottom }));
  const rendered = reactive({ ...target.value });
  let lastTarget = JSON.stringify(target.value),
    lastCorner = `${anchor.value.right}:${anchor.value.bottom}`;
  let motion = null,
    motionFrame = 0,
    pointerFrame = 0,
    viewportFrame = 0;
  let panelPin = null;
  let drag = null,
    point = null,
    suppressClickUntil = 0,
    suppressedClickTarget = null;
  // 默认垂直位置换算为百分比，旧配置不因启用开关突然移动。
  function defaultVertical() {
    return tracks.value.y ? clamp((50 / tracks.value.y) * 100, 0, 100) : 0;
  }
  // 面板定位以自身尺寸扣除后的可移动范围计算百分比。
  function panelTracks(width, height) {
    return {
      x: Math.max(0, viewport.width - margin * 2 - width),
      y: Math.max(0, viewport.height - margin * 2 - height),
    };
  }
  // 标题栏保持抓取点不动，只有按钮的相对位置参加换边动画。
  function followPanel() {
    if (!panelPin) return;
    rendered.x = clamp(
      panelPin.left - rendered.offsetX,
      margin,
      viewport.width - margin - viewport.buttonWidth,
    );
    rendered.y = clamp(
      panelPin.top - rendered.offsetY,
      margin,
      viewport.height - margin - viewport.buttonHeight,
    );
    rendered.offsetX = panelPin.left - rendered.x;
    rendered.offsetY = panelPin.top - rendered.y;
  }
  // 标题栏移动不应改变面板大小，也不应把临时缩小写成用户的原始宽高。
  function rememberPanelSize(size = rendered) {
    appSettings.menuPosition.panelSize = {
      width: size.width,
      height: size.height,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    };
  }
  // 输入和开关平滑插值；拖动只让未被抓住的一方参加换边动画。
  function draw(time) {
    motionFrame = 0;
    if (!motion) return;
    const progress = clamp((time - motion.start) / duration, 0, 1),
      eased = 1 - (1 - progress) ** 3;
    for (const key of motion.kind === 'flip' || motion.kind === 'panel-flip'
      ? ['offsetX', 'offsetY']
      : dimensions)
      rendered[key] = motion.from[key] + (target.value[key] - motion.from[key]) * eased;
    if (motion.kind === 'panel-flip') followPanel();
    if (progress < 1) motionFrame = requestAnimationFrame(draw);
    else {
      motion = null;
      animating.value = false;
    }
  }
  // 从当前画面续接下一次变化，快速修改或反向拖动不会跳回旧尺寸。
  function retarget(mode = 'smooth', force = false) {
    const next = target.value,
      key = JSON.stringify(next);
    if (!force && key === lastTarget) return;
    lastTarget = key;
    const corner = `${anchor.value.right}:${anchor.value.bottom}`,
      flipped = corner !== lastCorner;
    lastCorner = corner;
    if (mode === 'instant' || reducedMotion.matches) {
      cancelAnimationFrame(motionFrame);
      motionFrame = 0;
      motion = null;
      animating.value = false;
      Object.assign(rendered, next);
      return;
    }
    if (mode === 'drag' || mode === 'panel-drag') {
      const panel = mode === 'panel-drag';
      const kind = panel ? 'panel-flip' : 'flip';
      if (panel) panelPin = { left: next.x + next.offsetX, top: next.y + next.offsetY };
      for (const name of panel ? ['width', 'height'] : ['x', 'y', 'width', 'height'])
        rendered[name] = next[name];
      if ((flipped || (motion && motion.kind !== kind)) && visible.value)
        motion = { kind, start: performance.now(), from: { ...rendered } };
      else if (motion?.kind !== kind) {
        motion = null;
        rendered.offsetX = next.offsetX;
        rendered.offsetY = next.offsetY;
      }
      if (panel) followPanel();
    } else motion = { kind: 'layout', start: performance.now(), from: { ...rendered } };
    animating.value = Boolean(motion);
    if (motion && !motionFrame) motionFrame = requestAnimationFrame(draw);
  }
  // 输入提交时保存一次；连续拖动只更新内存中的偏好。
  function setSize(next, persist = true) {
    let changed = false;
    for (const axis of ['width', 'height']) {
      if (!Number.isFinite(next[axis])) continue;
      const value = Math.round(
        clamp(
          next[axis],
          limits.value[axis === 'width' ? 'minWidth' : 'minHeight'],
          limits.value[axis === 'width' ? 'maxWidth' : 'maxHeight'],
        ),
      );
      if (
        value === appSettings.menuSize[axis] &&
        (!heldPanelSize.value || heldPanelSize.value[axis] === value)
      )
        continue;
      appSettings.menuSize[axis] = value;
      if (panelAnchored.value) {
        if (!heldPanelSize.value) rememberPanelSize();
        appSettings.menuPosition.panelSize[axis] = value;
      }
      changed = true;
    }
    retarget(persist ? 'smooth' : 'drag');
    if (persist && changed) saveSettings();
    return changed;
  }
  // 输入保留一位小数，拖动保留足够精度以免抓取点被百分比取整抖动。
  function setPosition(next, persist = true, reference = appSettings.menuPosition.reference) {
    let changed = reference !== appSettings.menuPosition.reference;
    appSettings.menuPosition.reference = reference;
    if (reference === 'button') appSettings.menuPosition.panelSize = null;
    for (const axis of ['x', 'y']) {
      if (!Number.isFinite(next[axis])) continue;
      const precision = persist ? 10 : 1e6;
      const value = Math.round(clamp(next[axis], 0, 100) * precision) / precision;
      if (value === appSettings.menuPosition[axis]) continue;
      appSettings.menuPosition[axis] = value;
      changed = true;
    }
    retarget(persist ? 'smooth' : reference === 'panel' ? 'panel-drag' : 'drag');
    if (persist && changed) saveSettings();
    return changed;
  }
  // 开启时沿用当前布局，关闭时平滑回到原始位置或默认尺寸。
  function setEnabled(kind, enabled) {
    const settings = appSettings[kind];
    if (settings.enabled === Boolean(enabled)) return;
    if (kind === 'menuSize' && !enabled) appSettings.menuPosition.panelSize = null;
    if (enabled) {
      if (kind === 'menuSize') {
        settings.width ??= Math.round(rendered.width);
        settings.height ??= Math.round(rendered.height);
      } else {
        settings.x ??= 100;
        settings.y ??= Math.round(defaultVertical() * 10) / 10;
      }
    }
    settings.enabled = Boolean(enabled);
    retarget();
    saveSettings();
  }
  // 按关闭状态计算初始输入值；尺寸遵守当前可用空间，位置换算为按钮百分比。
  function defaultValues(kind) {
    if (kind === 'menuPosition')
      return {
        x: 100,
        y: Math.round(defaultVertical() * 1e6) / 1e6,
        reference: 'button',
        panelSize: null,
      };
    return {
      width: Math.round(
        clamp(automaticSize.value.width, limits.value.minWidth, limits.value.maxWidth),
      ),
      height: Math.round(
        clamp(automaticSize.value.height, limits.value.minHeight, limits.value.maxHeight),
      ),
    };
  }
  // 只比较数值与定位基准，不把开关是否关闭作为默认状态的条件。
  function isDefault(kind) {
    if (kind === 'menuSize' && appSettings.menuPosition.panelSize) return false;
    return Object.entries(defaultValues(kind)).every(
      ([key, value]) => (appSettings[kind][key] ?? value) === value,
    );
  }
  // 恢复当前项的初始数值并保留开关；尺寸恢复时释放拖动保留的临时尺寸。
  function resetLayout(kind) {
    if (isDefault(kind)) return;
    Object.assign(appSettings[kind], defaultValues(kind));
    if (kind === 'menuSize') appSettings.menuPosition.panelSize = null;
    retarget();
    saveSettings();
  }
  // 忽略关闭按钮和输入元素；点击仍可展开菜单，移动超过阈值才视为拖动。
  function startDrag(event, kind, edge = '', source = 'button') {
    if (
      event.button !== 0 ||
      drag ||
      (kind === 'move' ? !appSettings.menuPosition.enabled : !appSettings.menuSize.enabled)
    )
      return;
    if (kind === 'move' && event.target.closest('button,a,input,select,textarea')) return;
    drag = {
      kind,
      edge,
      source,
      node: event.currentTarget,
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initial: { ...rendered },
      panel: {
        left: clamp(
          rendered.x + rendered.offsetX,
          margin,
          viewport.width - margin - rendered.width,
        ),
        top: clamp(
          rendered.y + rendered.offsetY,
          margin,
          viewport.height - margin - rendered.height,
        ),
      },
      changed: false,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  // 以面板左上角反算百分比，不再把标题栏位移当作按钮位移。
  function movePanel(left, top) {
    const switched = appSettings.menuPosition.reference !== 'panel';
    appSettings.menuPosition.reference = 'panel';
    const travel = panelTracks(target.value.width, target.value.height);
    return (
      setPosition(
        {
          x: travel.x ? ((left - margin) / travel.x) * 100 : 0,
          y: travel.y ? ((top - margin) / travel.y) * 100 : 0,
        },
        false,
        'panel',
      ) || switched
    );
  }
  // 指针移动按帧合并，拖动过程中不触发存储写入。
  function applyPointer() {
    pointerFrame = 0;
    if (!drag || !point) return;
    const dx = point.x - drag.startX,
      dy = point.y - drag.startY;
    point = null;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) {
      tooltip.hide();
      if (drag.kind === 'move' && drag.source === 'panel') {
        rememberPanelSize(drag.initial);
        drag.changed = true;
      }
    }
    drag.moved = true;
    moving.value = drag.kind === 'move';
    resizing.value = drag.kind === 'resize';
    if (drag.kind === 'move' && drag.source === 'panel') {
      drag.changed = movePanel(drag.panel.left + dx, drag.panel.top + dy) || drag.changed;
    } else if (drag.kind === 'move') {
      drag.changed =
        setPosition(
          {
            x: tracks.value.x ? ((drag.initial.x + dx - margin) / tracks.value.x) * 100 : 0,
            y: tracks.value.y ? ((drag.initial.y + dy - margin) / tracks.value.y) * 100 : 0,
          },
          false,
          'button',
        ) || drag.changed;
    } else {
      const next = {};
      if (drag.edge.includes('west')) next.width = drag.initial.width - dx;
      if (drag.edge.includes('east')) next.width = drag.initial.width + dx;
      if (drag.edge.includes('north')) next.height = drag.initial.height - dy;
      if (drag.edge.includes('south')) next.height = drag.initial.height + dy;
      drag.changed = setSize(next, false) || drag.changed;
      if (panelAnchored.value) {
        const left = drag.edge.includes('west')
          ? drag.panel.left + drag.initial.width - target.value.width
          : drag.panel.left;
        const top = drag.edge.includes('north')
          ? drag.panel.top + drag.initial.height - target.value.height
          : drag.panel.top;
        drag.changed = movePanel(left, top) || drag.changed;
      }
    }
  }
  // 每帧只处理最新指针位置，避免高频事件造成布局堆积。
  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    point = { x: event.clientX, y: event.clientY };
    if (!pointerFrame) pointerFrame = requestAnimationFrame(applyPointer);
  }
  // 松开或失焦时提交最后一帧；屏蔽拖动释放后产生的误点击。
  function finishDrag(event) {
    if (!drag || (event?.pointerId !== undefined && event.pointerId !== drag.id)) return;
    cancelAnimationFrame(pointerFrame);
    applyPointer();
    const finished = drag;
    drag = null;
    moving.value = resizing.value = false;
    if (finished.node.hasPointerCapture(finished.id))
      finished.node.releasePointerCapture(finished.id);
    if (finished.moved) {
      suppressClickUntil = performance.now() + 300;
      suppressedClickTarget = finished.node;
    }
    if (finished.changed) saveSettings();
  }
  // 只拦截刚刚结束的拖动点击，不影响普通点击和键盘开关菜单。
  function suppressDragClick(event) {
    if (
      event.detail === 0 ||
      performance.now() >= suppressClickUntil ||
      !suppressedClickTarget?.contains(event.target)
    )
      return;
    suppressClickUntil = 0;
    suppressedClickTarget = null;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  // 窗口变化只刷新呈现边界，原始配置始终保留。
  function refreshViewport() {
    viewportFrame = 0;
    viewport.width = document.documentElement.clientWidth;
    viewport.height = document.documentElement.clientHeight;
    const button = root.value?.querySelector('#cf-ratings-settings-btn');
    viewport.buttonWidth = button?.offsetWidth || 44;
    viewport.buttonHeight = button?.offsetHeight || 44;
    retarget('instant', true);
  }
  // 合并缩放与窗口事件，不额外创建观察器或定时轮询。
  function scheduleViewport() {
    if (!viewportFrame) viewportFrame = requestAnimationFrame(refreshViewport);
  }
  watch(target, () =>
    retarget(drag?.moved ? (panelAnchored.value ? 'panel-drag' : 'drag') : 'smooth'),
  );
  watch(visible, () => {
    finishDrag();
    nextTick(refreshViewport);
  });
  watch(
    () => [appSettings.menuSize.enabled, appSettings.menuPosition.enabled],
    () => finishDrag(),
  );
  onMounted(() => {
    refreshViewport();
    window.addEventListener('resize', scheduleViewport);
    window.visualViewport?.addEventListener('resize', scheduleViewport);
    window.addEventListener('blur', finishDrag);
    reducedMotion.addEventListener('change', refreshViewport);
  });
  onBeforeUnmount(() => {
    finishDrag();
    cancelAnimationFrame(motionFrame);
    cancelAnimationFrame(viewportFrame);
    window.removeEventListener('resize', scheduleViewport);
    window.visualViewport?.removeEventListener('resize', scheduleViewport);
    window.removeEventListener('blur', finishDrag);
    reducedMotion.removeEventListener('change', refreshViewport);
  });
  const size = reactive({
    enabled: computed(() => appSettings.menuSize.enabled),
    isDefault: computed(() => isDefault('menuSize')),
    reset: () => resetLayout('menuSize'),
    animating,
    goal: computed(() => ({
      width: Math.round(target.value.width),
      height: Math.round(target.value.height),
    })),
    width: computed(() => Math.round(rendered.width)),
    height: computed(() => Math.round(rendered.height)),
    limits,
    setEnabled: (enabled) => setEnabled('menuSize', enabled),
    setSize,
  });
  // 数字位置跟随最近抓取的对象，重新加载后保持同一定位基准。
  function positionPercent(axis) {
    const travel = panelAnchored.value
      ? panelTracks(rendered.width, rendered.height)[axis]
      : tracks.value[axis];
    const value =
      rendered[axis] + (panelAnchored.value ? rendered[axis === 'x' ? 'offsetX' : 'offsetY'] : 0);
    return travel ? Math.round(clamp(((value - margin) / travel) * 100, 0, 100) * 10) / 10 : 0;
  }
  const position = reactive({
    enabled: computed(() => appSettings.menuPosition.enabled),
    isDefault: computed(() => isDefault('menuPosition')),
    reset: () => resetLayout('menuPosition'),
    animating,
    goal: computed(() => ({
      x: appSettings.menuPosition.x ?? 100,
      y: appSettings.menuPosition.y ?? defaultVertical(),
    })),
    x: computed(() => positionPercent('x')),
    y: computed(() => positionPercent('y')),
    setEnabled: (enabled) => setEnabled('menuPosition', enabled),
    setPosition,
  });
  return reactive({
    size,
    position,
    moving,
    resizing,
    edges: computed(() => {
      const x = anchor.value.right ? 'west' : 'east',
        y = anchor.value.bottom ? 'north' : 'south';
      return [x, y, y + x];
    }),
    rootStyle: computed(() => ({ left: `${rendered.x}px`, top: `${rendered.y}px`, right: 'auto' })),
    panelStyle: computed(() => ({
      left: `${clamp(rendered.x + rendered.offsetX, margin, viewport.width - margin - rendered.width) - rendered.x}px`,
      top: `${clamp(rendered.y + rendered.offsetY, margin, viewport.height - margin - rendered.height) - rendered.y}px`,
    })),
    modalStyle: computed(() => ({
      width: `${rendered.width}px`,
      height: `${rendered.height}px`,
      minHeight: '0px',
      maxHeight: 'none',
      '--cf-menu-open-y': anchor.value.bottom ? '6px' : '-6px',
      transformOrigin: `${anchor.value.right ? 'right' : 'left'} ${anchor.value.bottom ? 'bottom' : 'top'}`,
    })),
    startMove: (event, source = 'button') => startDrag(event, 'move', '', source),
    startResize: (event, edge) => startDrag(event, 'resize', edge),
    moveDrag,
    finishDrag,
    suppressDragClick,
  });
}
</script>
<script setup>
defineProps({ layout: { type: Object, required: true } });
</script>
<template>
  <div class="cf-menu-placement" :style="layout.panelStyle"><slot /></div>
</template>
<style>
.cf-menu-placement {
  position: absolute;
  z-index: 1;
}
#cf-ratings-settings-btn {
  z-index: 2;
}
#cf-ratings-settings-btn.is-positionable {
  cursor: grab !important;
  touch-action: none;
}
#cf-ratings-settings-btn.is-position-dragging {
  cursor: grabbing !important;
}
.cf-modal-header.is-positionable {
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.cf-modal-header.is-position-dragging {
  cursor: grabbing;
}
</style>
