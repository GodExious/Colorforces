<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { translate as t } from '../../../../../../../i18n/index.js';
import { rankForRating } from '../../../../../../../features/contest/rating-prediction/algorithm/ranks.js';
import {
  profileOf,
  readCachedProfiles,
  subscribeProfiles,
} from '../../../../../../../features/user/groups/profiles.js';
import AvatarFrame from '../../../../../../components/avatars/AvatarFrame/AvatarFrame.vue';
import { tooltip } from '../../../../../../components/tooltips/FloatingTooltip/FloatingTooltip.vue';
import { isTruncated } from '../../../../../../../utils/text-overflow.js';
import { rankInk } from '../../../../../groups/components/MemberName/MemberName.vue';
// 头像框库的右栏：试戴的样子。分三段——上面固定（放大的头像套上头像框、名字和种类），中间只有介绍在滚，
// 最下面一行固定（由用它的地方放理由和按钮，见 foot 插槽）。介绍滚到底时最下面一截淡掉，像滑到了按钮底下。
//   frame    试戴的头像框；空的是「不使用」，这时不套框
//   code     试戴一段还没保存的代码（新建、编辑自定义头像框时），给了就不看 frame
//   picture  头像；没有时是一个浅灰的圆
//   name     名字；kind 是名字后面的小标签（段位、特别、内置、自定义），空的不挂
//   author   做的一方的署名（空的写「未署名」）；edition 是第几版。edition 为 0 时（「不使用」）那一行空着，但留着位置
//   intro    介绍：一段文字，或分段的数组（每段一项）
// 插槽：top 在最上面（编辑时的「试戴 / 提示词全文」），before 在介绍前面、跟着介绍一起滚（读代码的提醒）。
// 试戴的那一块裁掉伸出去的部分：自定义的头像框画出画板也不会盖到名字上。
const props = defineProps({
  frame: { type: String, default: '' },
  code: { type: String, default: '' },
  picture: { type: String, default: '' },
  name: { type: String, default: '' },
  kind: { type: String, default: '' },
  author: { type: String, default: '' },
  edition: { type: Number, default: 0 },
  intro: { type: [String, Array], default: '' },
});
// 作者是原站的用户时（缓存里查得到这个账号），名字用他的段位色，点了在新标签页打开他的主页。只看缓存，不为它发请求。
const HANDLE = /^[\w.-]{3,24}$/;
const profilesSeen = ref(0);
watch(
  () => props.author,
  (name) => HANDLE.test(name) && readCachedProfiles([name]),
  { immediate: true },
);
const authorProfile = computed(() => {
  if (profilesSeen.value < 0 || !HANDLE.test(props.author)) return null;
  const profile = profileOf(props.author);
  return profile && !profile.missing ? profile : null;
});
const authorInk = computed(() => rankInk(authorProfile.value));
const legendary = computed(
  () =>
    Number.isFinite(authorProfile.value?.rating) &&
    rankForRating(authorProfile.value.rating).legendary,
);
// 「某某 设计」「By 某某」：作者名字前后的字（名字单独画）。
const madeBy = computed(() => t('frameMadeBy', '\u0000').split('\u0000'));
// 作者的名字太长被省略时，鼠标移上去看全名。
function showAuthor(event) {
  if (isTruncated(event.currentTarget)) tooltip.show(event.currentTarget, props.author);
}
let stopProfiles;
onMounted(() => (stopProfiles = subscribeProfiles(() => profilesSeen.value++)));
onBeforeUnmount(() => stopProfiles?.());
const paragraphs = computed(() => [].concat(props.intro).filter(Boolean));
// 换了试戴的头像框：旧的介绍淡出后，回到最上面再淡入新的（是另一段介绍了）。
const scroller = ref(null);
const reset = () => scroller.value && (scroller.value.scrollTop = 0);
</script>
<template>
  <div class="cf-frame-preview">
    <slot name="top" />
    <div class="cf-frame-preview-head">
      <div class="cf-frame-preview-stage cf-frame-host">
        <span class="cf-frame-preview-face"
          ><img v-if="picture" :src="picture" alt="" /><AvatarFrame :frame="frame" :code="code"
        /></span>
      </div>
      <Transition name="cf-frame-preview-swap" mode="out-in">
        <div :key="name + kind" class="cf-frame-preview-name">
          <span>{{ name }}</span
          ><span v-if="kind" class="cf-frame-preview-kind">{{ kind }}</span>
        </div>
      </Transition>
      <!-- 名字下面一行小字：「某某 设计 · 第 3 版」，没署名的写「未署名」。和名字一起淡出淡入。
           作者的名字太长时只省略名字自己，后面的「设计 · 第 3 版」一直看得到。 -->
      <Transition name="cf-frame-preview-swap" mode="out-in">
        <div :key="author + '\n' + edition" class="cf-frame-preview-credit">
          <template v-if="edition">
            <template v-if="author"
              ><span v-if="madeBy[0]" class="cf-frame-preview-fixed">{{ madeBy[0] }}</span
              ><a
                v-if="authorProfile"
                class="cf-frame-preview-author"
                :class="{ 'is-legendary': legendary }"
                :href="'/profile/' + encodeURIComponent(authorProfile.handle)"
                target="_blank"
                rel="noopener"
                data-cf-avatar-processed="own"
                :data-cf-user-menu="authorProfile.handle"
                :style="{ color: authorInk }"
                @mouseenter="showAuthor"
                @mouseleave="tooltip.hide()"
                >{{ author }}</a
              ><b
                v-else
                class="cf-frame-preview-author"
                @mouseenter="showAuthor"
                @mouseleave="tooltip.hide()"
                >{{ author }}</b
              ><span v-if="madeBy[1]" class="cf-frame-preview-fixed">{{
                madeBy[1]
              }}</span></template
            ><span v-else class="cf-frame-preview-unsigned">{{ t('frameUnsigned') }}</span
            ><i>·</i><span class="cf-frame-preview-fixed">{{ t('frameEdition', edition) }}</span>
          </template>
        </div>
      </Transition>
    </div>
    <div ref="scroller" class="cf-frame-preview-scroll cf-scrollbar">
      <slot name="before" />
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
  overflow: hidden;
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
/* 名字下面那一行：和名字隔 6px，浅色小字；「不使用」时空着，位置留着，换着看时介绍不跳。 */
/* 一行排开：只有作者的名字能被挤窄（省略），前后的字和「· 第 N 版」不让。 */
.cf-frame-preview-credit {
  display: flex;
  align-items: baseline;
  min-height: 16px;
  margin-top: 6px;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
  line-height: 16px;
  white-space: nowrap;
}
.cf-frame-preview-fixed,
.cf-frame-preview-credit i,
.cf-frame-preview-unsigned {
  flex: none;
  white-space: pre;
}
.cf-frame-preview-author {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--cf-control-ink);
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-weight: var(--cf-font-weight-bold);
  text-decoration: none;
}
a.cf-frame-preview-author:hover {
  text-decoration: underline;
}
/* 3000 分以上：和原站一样第一个字是黑的。 */
.cf-frame-preview-author.is-legendary::first-letter {
  color: var(--cf-gray-900);
}
.cf-frame-preview-unsigned {
  opacity: 0.8;
}
.cf-frame-preview-credit i {
  margin: 0 6px;
  font-style: normal;
  opacity: 0.6;
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
