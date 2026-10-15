<script setup>
import AvatarFrame from '../../../../../../components/avatars/AvatarFrame/AvatarFrame.vue';
// 头像框库里的一格：上面是套着这个头像框的头像，下面是名字，右上角可以挂一个小牌子（「佩戴中」）。
//   frame    头像框的名字；空的是「不使用」那一格（一个划掉的虚线圆）
//   add      「导入」那一格（虚线方块，中间一个加号），这时不看 frame
//   picture  格子里的头像；没有时是一个浅灰的圆
//   label    下面的名字
//   picked   正在试戴的那一格
//   badge    右上角小牌子上的字，空的不挂
defineProps({
  frame: { type: String, default: '' },
  add: Boolean,
  picture: { type: String, default: '' },
  label: { type: String, default: '' },
  picked: Boolean,
  badge: { type: String, default: '' },
});
</script>
<template>
  <button
    type="button"
    class="cf-frame-tile cf-frame-host"
    :class="{ 'is-picked': picked, 'is-add': add }"
    :aria-pressed="add ? undefined : picked"
  >
    <span v-if="add" class="cf-frame-tile-add" aria-hidden="true"></span>
    <span v-else-if="frame" class="cf-frame-tile-face"
      ><img v-if="picture" :src="picture" alt="" /><AvatarFrame :frame="frame"
    /></span>
    <span v-else class="cf-frame-tile-none" aria-hidden="true"></span>
    <span class="cf-frame-tile-name">{{ label }}</span>
    <Transition name="cf-frame-tile-badge">
      <span v-if="badge" :key="badge" class="cf-frame-tile-badge">{{ badge }}</span>
    </Transition>
  </button>
</template>
<style>
.cf-frame-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 0;
  margin: 0;
  padding: 4px 2px 6px;
  border: 1px solid transparent;
  border-radius: var(--cf-radius-md);
  background: var(--cf-control-surface);
  color: var(--cf-aurora-text);
  font: inherit;
  font-size: var(--cf-font-size-xs);
  line-height: 16px;
  cursor: pointer;
  transition:
    border-color var(--cf-duration-fast) ease,
    background-color var(--cf-duration-fast) ease,
    box-shadow var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease;
}
.cf-frame-tile:hover {
  border-color: var(--cf-surface-border);
  background: var(--cf-card-hover);
}
.cf-frame-tile.is-picked {
  border-color: color-mix(in srgb, var(--cf-menu-accent) 70%, var(--cf-surface-border));
  background: var(--cf-control-active);
  color: var(--cf-control-ink);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--cf-menu-accent) 28%, transparent);
}
.cf-frame-tile:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--cf-menu-accent) 50%, transparent);
  outline-offset: 1px;
}
/* 头像 30px，头像框是它的两倍，正好占满上面 60px 的方块。 */
.cf-frame-tile-face {
  position: relative;
  width: 30px;
  height: 30px;
  margin: 15px;
  border-radius: 50%;
  background: var(--cf-gray-100);
}
.cf-frame-tile-face > img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
/* 「不使用」：虚线圆，中间一道斜线。 */
.cf-frame-tile-none {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin: 10px;
  border: 1px dashed var(--cf-gray-300);
  border-radius: 50%;
  box-sizing: border-box;
}
.cf-frame-tile-none::before {
  content: '';
  width: 24px;
  height: 2px;
  background: var(--cf-gray-300);
  transform: rotate(-45deg);
}
/* 「导入」：和别的格子一样大，虚线边，中间一个虚线圆里的加号。 */
.cf-frame-tile.is-add {
  border: 1px dashed var(--cf-gray-300);
  background: transparent;
  color: var(--cf-aurora-muted);
}
.cf-frame-tile.is-add:not(:disabled):hover {
  border-color: color-mix(in srgb, var(--cf-menu-accent) 60%, var(--cf-surface-border));
  background: var(--cf-card-hover);
  color: var(--cf-control-ink);
}
.cf-frame-tile.is-add:disabled {
  cursor: default;
}
.cf-frame-tile-add {
  position: relative;
  width: 40px;
  height: 40px;
  margin: 10px;
  border: 1px dashed currentColor;
  border-radius: 50%;
  box-sizing: border-box;
  opacity: 0.7;
}
.cf-frame-tile-add::before,
.cf-frame-tile-add::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 2px;
  margin: -1px 0 0 -8px;
  border-radius: 1px;
  background: currentColor;
}
.cf-frame-tile-add::after {
  transform: rotate(90deg);
}
.cf-frame-tile-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cf-frame-tile-badge {
  position: absolute;
  top: 3px;
  right: 3px;
  padding: 0 4px;
  border-radius: var(--cf-radius-xs);
  background: var(--cf-menu-accent);
  color: var(--cf-white-ink);
  font-size: var(--cf-font-size-2xs);
  line-height: 14px;
}
.cf-frame-tile-badge-enter-active,
.cf-frame-tile-badge-leave-active {
  transition:
    opacity var(--cf-duration-base) ease,
    transform var(--cf-duration-base) ease;
}
.cf-frame-tile-badge-enter-from,
.cf-frame-tile-badge-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
@media (prefers-reduced-motion: reduce) {
  .cf-frame-tile-badge-enter-active,
  .cf-frame-tile-badge-leave-active {
    transition: none;
  }
}
</style>
