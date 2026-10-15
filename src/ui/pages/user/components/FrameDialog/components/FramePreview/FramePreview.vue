<script setup>
import { computed, ref } from 'vue';
import AvatarFrame from '../../../../../../components/avatars/AvatarFrame/AvatarFrame.vue';
// 头像框库的右栏：试戴的样子。分三段——上面固定（放大的头像套上头像框、名字和种类），中间只有介绍在滚，
// 最下面一行固定（由用它的地方放理由和按钮，见 foot 插槽）。介绍滚到底时最下面一截淡掉，像滑到了按钮底下。
//   frame    试戴的头像框；空的是「不使用」，这时不套框
//   picture  头像；没有时是一个浅灰的圆
//   name     名字；kind 是名字后面的小标签（段位、特别、内置），空的不挂
//   intro    介绍：一段文字，或分段的数组（每段一项）
const props = defineProps({
  frame: { type: String, default: '' },
  picture: { type: String, default: '' },
  name: { type: String, default: '' },
  kind: { type: String, default: '' },
  intro: { type: [String, Array], default: '' },
});
const paragraphs = computed(() => [].concat(props.intro).filter(Boolean));
// 换了试戴的头像框：旧的介绍淡出后，回到最上面再淡入新的（是另一段介绍了）。
const scroller = ref(null);
const reset = () => scroller.value && (scroller.value.scrollTop = 0);
</script>
<template>
  <div class="cf-frame-preview">
    <div class="cf-frame-preview-head">
      <div class="cf-frame-preview-stage cf-frame-host">
        <span class="cf-frame-preview-face"
          ><img v-if="picture" :src="picture" alt="" /><AvatarFrame :frame="frame"
        /></span>
      </div>
      <Transition name="cf-frame-preview-swap" mode="out-in">
        <div :key="name + kind" class="cf-frame-preview-name">
          <span>{{ name }}</span
          ><span v-if="kind" class="cf-frame-preview-kind">{{ kind }}</span>
        </div>
      </Transition>
    </div>
    <div ref="scroller" class="cf-frame-preview-scroll cf-scrollbar">
      <Transition name="cf-frame-preview-swap" mode="out-in" @after-leave="reset">
        <div :key="paragraphs.join('\n')" class="cf-frame-preview-intro">
          <p v-for="(text, index) in paragraphs" :key="index">{{ text }}</p>
        </div>
      </Transition>
    </div>
    <div class="cf-frame-preview-foot"><slot name="foot" /></div>
  </div>
</template>
<style>
.cf-frame-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.cf-frame-preview-head {
  flex: none;
  padding: 0 16px 6px;
}
/* 头像 96px，头像框 192px；上面多留一点（帽子、皇冠伸得高），下面只留绶带的位置。 */
.cf-frame-preview-stage {
  display: flex;
  justify-content: center;
  padding: 50px 0 34px;
}
.cf-frame-preview-face {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: var(--cf-gray-100);
}
.cf-frame-preview-face > img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.cf-frame-preview-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: #3b4868;
  font-size: var(--cf-font-size-xl);
  font-weight: var(--cf-font-weight-bold);
}
.cf-frame-preview-name > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cf-frame-preview-kind {
  flex: none;
  padding: 0 6px;
  border-radius: var(--cf-radius-xs);
  background: color-mix(in srgb, var(--cf-menu-accent) 16%, transparent);
  color: var(--cf-control-ink);
  font-size: var(--cf-font-size-2xs);
  font-weight: normal;
  line-height: 16px;
}
/* 介绍：在这一段里滚，滚到底时最下面一截淡掉。 */
.cf-frame-preview-scroll {
  flex: 1;
  min-height: 0;
  padding: 0 16px 28px;
  overflow-y: auto;
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent);
  mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent);
}
.cf-frame-preview-intro {
  color: var(--cf-aurora-text);
  font-size: var(--cf-font-size-base);
  line-height: 20px;
  white-space: pre-line;
}
.cf-frame-preview-intro > p {
  margin: 0;
}
.cf-frame-preview-intro > p + p {
  margin-top: 8px;
}
.cf-frame-preview-foot {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 52px;
  padding: 10px 16px;
  box-sizing: border-box;
}
.cf-frame-preview-swap-enter-active {
  transition: opacity 160ms ease;
}
.cf-frame-preview-swap-leave-active {
  transition: opacity 100ms ease;
}
.cf-frame-preview-swap-enter-from,
.cf-frame-preview-swap-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .cf-frame-preview-swap-enter-active,
  .cf-frame-preview-swap-leave-active {
    transition: none;
  }
}
</style>
