<script setup>
import { onBeforeUnmount } from 'vue';
const props = defineProps({ origin: Object });
const running = new Map();
const interrupted = new WeakMap();
// 从标注处取出一条卷起的面板，再沿靠近标注的一侧展开。
function rollFrames(rect, origin) {
  const bottom = origin.top + origin.height / 2 > rect.top + rect.height / 2;
  const x = origin.left + origin.width / 2 - rect.left - rect.width / 2;
  const y = origin.top + origin.height / 2 - (bottom ? rect.bottom : rect.top);
  const hinge = `50% ${bottom ? '100%' : '0%'}`;
  const clip = (amount) =>
    bottom ? `inset(${amount}% 0 0 0 round 12px)` : `inset(0 0 ${amount}% 0 round 12px)`;
  const bend = bottom ? -1 : 1;
  const card = [
    {
      offset: 0,
      transform: `translate(${x}px, ${y}px) perspective(900px) rotateX(${bend * 55}deg) scale(.06)`,
      clipPath: clip(88),
    },
    {
      offset: 0.28,
      transform: `translate(${x * 0.16}px, ${y * 0.16}px) perspective(900px) rotateX(${bend * 14}deg) scale(.92)`,
      clipPath: clip(82),
    },
    { offset: 0.72, transform: 'none', clipPath: clip(18) },
    { offset: 1, transform: 'none', clipPath: 'inset(-60px -60px -60px -60px round 12px)' },
  ].map((frame) => ({ ...frame, transformOrigin: hinge }));
  const edge = [
    { offset: 0, progress: 0.12, opacity: 0 },
    { offset: 0.28, progress: 0.18, opacity: 0.8 },
    { offset: 0.72, progress: 0.82, opacity: 0.55 },
    { offset: 1, progress: 1, opacity: 0 },
  ].map(({ offset, progress, opacity }) => ({
    offset,
    opacity,
    transform: `translateY(${rect.height * (bottom ? 1 - progress : progress) - 10}px)`,
  }));
  return { card, edge, bottom };
}

// 反向开合沿用当前形状与卷边位置，不从动画起点重播。
function cancel(element) {
  const state = running.get(element);
  if (!state) return;
  const backdrop = getComputedStyle(element);
  const card = getComputedStyle(state.card);
  const edge = getComputedStyle(state.card, '::after');
  interrupted.set(element, {
    clipPath: card.clipPath,
    transform: card.transform,
    transformOrigin: card.transformOrigin,
    edgeTransform: edge.transform,
    edgeOpacity: edge.opacity,
    backgroundColor: backdrop.backgroundColor,
    backdropFilter: backdrop.backdropFilter,
  });
  state.animations.forEach((animation) => animation.cancel());
  state.card.classList.remove('cf-dialog-unrolling', 'cf-dialog-unroll-bottom');
  running.delete(element);
  element.inert = false;
}
// 帮助面板专用卷展；没有标注锚点的普通弹窗仍只裁切背板。
function animate(element, done, entering) {
  const card = element.firstElementChild;
  element.inert = !entering;
  if (!card || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    interrupted.delete(element);
    done();
    return;
  }
  const rect = card.getBoundingClientRect();
  const origin = props.origin;
  const open = 'inset(-60px -60px -60px -60px round 12px)';
  const closed = 'inset(0 0 100% 0 round 12px)';
  const backdrop = getComputedStyle(element);
  const background = backdrop.backgroundColor;
  const filter = backdrop.backdropFilter;
  const previous = interrupted.get(element);
  const roll = origin ? rollFrames(rect, origin) : null;
  const reverse = (frames) =>
    [...frames].reverse().map((frame) => ({ ...frame, offset: 1 - frame.offset }));
  let cardFrames = roll
    ? entering
      ? roll.card
      : reverse(roll.card)
    : [{ clipPath: entering ? closed : open }, { clipPath: entering ? open : closed }];
  let edgeFrames = roll ? (entering ? roll.edge : reverse(roll.edge)) : null;
  if (previous) {
    cardFrames = [
      {
        clipPath: previous.clipPath,
        transform: previous.transform,
        transformOrigin: previous.transformOrigin,
      },
      { ...cardFrames.at(-1), offset: 1 },
    ];
    if (edgeFrames)
      edgeFrames = [
        { transform: previous.edgeTransform, opacity: previous.edgeOpacity },
        { ...edgeFrames.at(-1), offset: 1 },
      ];
  }
  if (roll) {
    card.classList.add('cf-dialog-unrolling');
    card.classList.toggle('cf-dialog-unroll-bottom', roll.bottom);
  }
  const options = {
    duration: origin && !previous ? (entering ? 440 : 360) : 240,
    easing: origin ? 'cubic-bezier(.4,0,.2,1)' : 'cubic-bezier(.22,1,.36,1)',
    fill: 'both',
  };
  const animations = [
    card.animate(cardFrames, options),
    element.animate(
      [
        {
          backgroundColor: previous?.backgroundColor || (entering ? 'transparent' : background),
          backdropFilter: previous?.backdropFilter || (entering ? 'blur(0px)' : filter),
        },
        {
          backgroundColor: entering ? background : 'transparent',
          backdropFilter: entering ? filter : 'blur(0px)',
        },
      ],
      options,
    ),
  ];
  if (edgeFrames)
    animations.push(card.animate(edgeFrames, { ...options, pseudoElement: '::after' }));
  interrupted.delete(element);
  const state = { card, animations };
  running.set(element, state);
  Promise.all(animations.map((animation) => animation.finished)).then(
    () => {
      if (running.get(element) !== state) return;
      done();
      animations.forEach((animation) => animation.cancel());
      card.classList.remove('cf-dialog-unrolling', 'cf-dialog-unroll-bottom');
      running.delete(element);
    },
    () => {},
  );
}
onBeforeUnmount(() => [...running.keys()].forEach(cancel));
</script>
<template>
  <Transition
    :css="false"
    appear
    @enter="(element, done) => animate(element, done, true)"
    @leave="(element, done) => animate(element, done, false)"
    @enter-cancelled="cancel"
    @leave-cancelled="cancel"
  >
    <slot />
  </Transition>
</template>

<style>
/* 卷边仅在帮助面板开合时存在，不复制内容，也不改变静态布局。 */
.cf-dialog-unrolling {
  position: relative;
  will-change: transform, clip-path;
}
.cf-dialog-unrolling::after {
  content: '';
  position: absolute;
  z-index: 1;
  top: 0;
  left: 0;
  right: 0;
  height: 20px;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(255, 255, 255, 0.75) 40%,
    rgba(15, 23, 42, 0.16) 80%,
    transparent
  );
}
.cf-dialog-unroll-bottom::after {
  background: linear-gradient(
    to top,
    transparent,
    rgba(255, 255, 255, 0.75) 40%,
    rgba(15, 23, 42, 0.16) 80%,
    transparent
  );
}
</style>
