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

// 这块区域往下最多能被看见到哪（窗口里的纵坐标）：窗口的下边缘，或者装着它的滚动区域（菜单的内容区、
// 弹窗的正文）的下边缘，取靠上的那个。
function visibleBottom(element) {
  let bottom = window.innerHeight;
  for (let node = element.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === 'auto' || overflow === 'scroll')
      bottom = Math.min(bottom, node.getBoundingClientRect().bottom);
  }
  return bottom;
}

// 只裁剪外层高度，内部始终按完整尺寸排版，不重新居中文字。
function animate(element, done, entering) {
  // 菜单里的内容收起、变短时先把滚动位置撑住，过渡结束再把用不着的高度收掉。
  // 直接放在页面上的（个人主页的数据分析面板和它里面的各块）不撑：页面跟着变短，
  // 窗口和原站的页脚随着收起的过渡一起往上走。试过撑住页面的高度，留下的一大片空白反而怪。
  const inMenu = element.closest('.cf-tab-panel.active:not([aria-hidden="true"])');
  const release = inMenu ? holdPosition() : () => {};
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
  // 内容很长时（个人主页的数据分析面板有几千像素高，更新日志里条目多的版本也有好几百），
  // 只让高度过渡到看得见的范围的下边缘再多一点，不走完整段。
  // 整段都算的话，零点几秒里要走上千像素，看得见的那一截一眨眼就过去了，看起来像是直接出现的。
  // 看不见的那一段在过渡结束（收起时是开始）的那一刻直接到位。
  // 「看得见的范围」在页面上是窗口，在菜单里是菜单的内容区：菜单比窗口矮得多，按窗口算的话
  // 菜单里能看见的那一截还是只占行程的一小半。
  // 这块区域的上边缘已经滚到窗口上方时也一样：高度从上边缘算起，过渡到窗口的下边缘为止。
  // 这时展开的边线要先走过窗口上方看不见的那一段，再扫过窗口；过渡是先快后慢的，
  // 快的那一段正好用在看不见的地方，扫过窗口时已经慢下来了。
  const full = element.firstElementChild.getBoundingClientRect().height;
  const top = element.getBoundingClientRect().top;
  const seen = Math.max(0, visibleBottom(element) - top) + 80;
  const span = Math.min(full, seen);
  const expanded = { height: span + 'px', marginBottom: '0px' };
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
  // 一般是先快后慢。收起时若这块区域的上边缘在窗口上方，就反过来先慢后快：
  // 这时收起的边线先扫过窗口、再走完窗口上方看不见的那一段，慢的那一段要留给看得见的部分。
  // 不然一开头的几十毫秒里边线就扫出了窗口，看起来像是直接消失的。
  // 行程长（超过 240 像素）时放慢，曲线也换成起步缓一些的：平常那条曲线一开头冲得很猛，
  // 八分之一的时间里就走掉一半，几百像素的内容用它展开，前几十毫秒就铺满了，看着还是像直接出现。
  // 行程短的仍是 260 毫秒和平常的曲线，和菜单里别的收放一致。
  const long = span > 240;
  const duration = long ? Math.min(460, Math.round(260 + (span - 240) * 0.5)) : 260;
  const ease = long ? 'cubic-bezier(.3,.6,.3,1)' : 'cubic-bezier(.22,1,.36,1)';
  const animation = element.animate([start, entering ? expanded : collapsed], {
    duration,
    easing: !entering && top < 0 ? 'cubic-bezier(.64,0,.78,0)' : ease,
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
