<script setup>
import { onBeforeUnmount, inject } from 'vue';
defineProps({ show: { type: Boolean, default: true } });
const holdPosition = inject('cf-collapse-anchor', () => () => {});
const running = new Map();
const interrupted = new WeakMap();
const fields = ['height', 'marginBottom'];

// 记录当前展开位置，快速反向切换时从这一帧继续。
function cancel(element) {
  const state = running.get(element);
  if (!state) return;
  const style = getComputedStyle(element);
  interrupted.set(element, Object.fromEntries(fields.map((key) => [key, style[key]])));
  state.animation.cancel();
  element.style.overflow = state.overflow;
  element.style.transition = state.transition;
  element.inert = state.inert;
  delete element.dataset.cfExpanding;
  running.delete(element);
  state.release();
}

// 只裁剪外层高度，内部始终按完整尺寸排版，不重新居中文字。
function animate(element, done, entering) {
  const release = element.closest('.cf-tab-panel.active:not([aria-hidden="true"])')
    ? holdPosition()
    : () => {};
  if (
    !element.getClientRects().length ||
    !element.animate ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    interrupted.delete(element);
    done();
    release();
    return;
  }
  const expanded = {
    height: element.firstElementChild.getBoundingClientRect().height + 'px',
    marginBottom: '0px',
  };
  const collapsed = { height: '0px', marginBottom: '0px' };
  const gap = parseFloat(getComputedStyle(element.parentElement).rowGap) || 0;
  collapsed.marginBottom = -gap + 'px';
  const start = interrupted.get(element) || (entering ? collapsed : expanded);
  interrupted.delete(element);
  const overflow = element.style.overflow;
  const transition = element.style.transition;
  const inert = element.inert;
  element.inert = !entering;
  element.style.overflow = 'hidden';
  // 不改变内容透明度或缩放，避免最后一帧更换文字合成层。
  element.style.transition = 'none';
  element.dataset.cfExpanding = '';
  const animation = element.animate([start, entering ? expanded : collapsed], {
    duration: 260,
    easing: 'cubic-bezier(.22,1,.36,1)',
    fill: 'both',
  });
  running.set(element, { animation, overflow, transition, inert, release });
  animation.onfinish = () => {
    // 收起先让 v-show/v-if 落到最终状态，再撤销填充帧。
    done();
    animation.cancel();
    element.style.overflow = overflow;
    element.style.transition = transition;
    element.inert = inert;
    delete element.dataset.cfExpanding;
    running.delete(element);
    release();
  };
}
onBeforeUnmount(() => [...running.keys()].forEach(cancel));
</script>

<template>
  <Transition
    :css="false"
    @enter="(element, done) => animate(element, done, true)"
    @leave="(element, done) => animate(element, done, false)"
    @enter-cancelled="cancel"
    @leave-cancelled="cancel"
  >
    <div v-show="show" class="cf-expand-region">
      <div class="cf-expand-content"><slot /></div>
    </div>
  </Transition>
</template>

<style scoped>
.cf-expand-region {
  flex: none;
  min-height: 0;
}
.cf-expand-content {
  display: flow-root;
}
</style>
