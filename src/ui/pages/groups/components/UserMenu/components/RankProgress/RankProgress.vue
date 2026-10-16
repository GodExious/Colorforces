<script setup>
import { computed } from 'vue';
import { translate as t } from '../../../../../../../i18n/index.js';
import { BLACK_INK, ratingProgress } from '../../../../../../../features/user/groups/progress.js';
// 右键菜单名片上的经验条：一条细条，下面一行小字。按现在的评分（不是到过的最高分），算法见 progress.js。
//   段位：条从这一档的颜色渐变到下一档的颜色，「距成为 下一档 还差 N」（下一档的名字用它的颜色）；
//   3000～3999：下一档的段位名就是这个人自己的名字（4000 分以上原站用本人的名字当段位名），写成全黑，条走到黑；
//   4000 分以上：整条黑，隔一会儿扫过一道暗红的光，「已成为 自己的名字」；管理员：Codeforces 标志的黄、蓝、红三段；
//   未评级：空条。评分变了（读到新的资料）时条的长度、颜色滑过去。
//   rating 现在的评分（未评级是 null），handle 这个人的名字（原站的大小写），admin 是不是管理员；
//   pending 为真时资料还没读到：空条，小字那一行空着但占着高度，读到后条从头滑过去，菜单不跳。
const props = defineProps({
  rating: { type: Number, default: null },
  handle: { type: String, default: '' },
  admin: Boolean,
  pending: Boolean,
});
const progress = computed(() =>
  props.pending ? { kind: 'pending' } : ratingProgress(props.rating, props.admin),
);
const barStyle = computed(() => {
  const { kind, share, from, to } = progress.value;
  if (kind !== 'rank' && kind !== 'legend') return {};
  // 走得太少时也露出一点，看得出是条。
  return {
    '--cf-progress-share': Math.max(0.04, share),
    '--cf-progress-from': from,
    '--cf-progress-to': to,
  };
});
// 小字：名字那一段单独上色。用一个不会出现的字符占位，把译文拆成名字前、名字后两段，换了语言跟着换。
const MARK = '\u0000';
const note = computed(() => {
  const { kind, gap, next, to } = progress.value;
  if (kind === 'pending') return { text: '' };
  if (kind === 'admin') return { text: t('groupsProgressAdmin') };
  if (kind === 'unrated') return { text: t('groupsProgressUnrated') };
  if (kind === 'top') {
    const [before, after] = t('groupsProgressTop', MARK).split(MARK);
    return { before, name: props.handle, ink: BLACK_INK, after };
  }
  const [before, after] = t('groupsProgressNext', MARK, gap).split(MARK);
  return kind === 'legend'
    ? { before, name: props.handle, ink: BLACK_INK, after }
    : { before, name: next, ink: to, after };
});
</script>
<template>
  <span class="cf-rank-progress" :class="'is-' + progress.kind" :style="barStyle">
    <span class="cf-rank-progress-track"><i></i></span>
    <span class="cf-rank-progress-note"
      ><template v-if="'text' in note">{{ note.text }}</template
      ><template v-else
        >{{ note.before }}<b :style="{ color: note.ink }">{{ note.name }}</b
        >{{ note.after }}</template
      ></span
    >
  </span>
</template>
<style>
.cf-rank-progress {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}
.cf-rank-progress-track {
  position: relative;
  display: block;
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(
    in srgb,
    var(--cf-user-menu-tint, var(--cf-gray-400)) 10%,
    var(--cf-gray-100)
  );
}
.cf-rank-progress-track > i {
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(var(--cf-progress-share, 0) * 100%);
  border-radius: inherit;
  background: linear-gradient(to right, var(--cf-progress-from), var(--cf-progress-to));
  transition: width var(--cf-duration-moderate) var(--cf-ease-out);
}
.cf-rank-progress.is-top .cf-rank-progress-track > i {
  width: 100%;
  overflow: hidden;
  background: linear-gradient(to right, #2b2b2b, #0d0d0d);
}
.cf-rank-progress.is-top .cf-rank-progress-track > i::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 30%, #ff3b3b8c 50%, transparent 70%);
  transform: translateX(-100%);
  animation: cf-rank-progress-glint 5s ease-in-out infinite;
}
@keyframes cf-rank-progress-glint {
  0%,
  60% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
/* 管理员：Codeforces 标志的黄、蓝、红（颜色取自管理员的头像框）。 */
.cf-rank-progress.is-admin .cf-rank-progress-track > i {
  width: 100%;
  background: linear-gradient(
    to right,
    #f5c211 0 33.333%,
    #1f8acb 33.333% 66.667%,
    #c62828 66.667%
  );
}
.cf-rank-progress.is-unrated .cf-rank-progress-track > i,
.cf-rank-progress.is-pending .cf-rank-progress-track > i {
  width: 0;
}
/* 下一档的名字长（International Grandmaster）、英文界面时放不下一行：折成两行，两行差不多长，不省略。 */
.cf-rank-progress-note {
  min-height: 16px;
  margin-top: 6px;
  color: var(--cf-gray-500);
  font-size: var(--cf-font-size-xs);
  font-weight: normal;
  line-height: 16px;
  text-align: center;
  text-wrap: balance;
}
/* 段位名不从中间断开：放不下一行时整个挪到下一行。 */
.cf-rank-progress-note b {
  font-weight: var(--cf-font-weight-bold);
  white-space: nowrap;
  transition: color var(--cf-duration-base) ease;
}
@media (prefers-reduced-motion: reduce) {
  .cf-rank-progress-track > i,
  .cf-rank-progress.is-top .cf-rank-progress-track > i::after {
    transition: none;
    animation: none;
  }
}
</style>
