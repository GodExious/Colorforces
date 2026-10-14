<script>
import { translate as translateText } from '../../../../../i18n/index.js';
import { rankForRating } from '../../../../../features/contest/rating-prediction/algorithm/ranks.js';
// 名字和评分用的颜色：有评分的按段位；未评级的、查不到的、还没读到的不上色，跟着周围的字色。
export const rankInk = (profile) =>
  Number.isFinite(profile?.rating) ? rankForRating(profile.rating).color : null;
// 评分那里写什么：评分；未评级的写 Unrated；账号不存在的写「查无此人」；还没读到时是空的。
export function ratingLabel(profile) {
  if (!profile) return '';
  if (profile.missing) return translateText('groupsNotFound');
  return Number.isFinite(profile.rating) ? String(profile.rating) : 'Unrated';
}
// 排序。成员是 { handle, profile } 这样的一项。
export const compareByName = (a, b) => a.handle.toLowerCase().localeCompare(b.handle.toLowerCase());
// 未评级的当作比所有评分都低：从低到高时在最前，从高到低时在最后。
// 查不到的、还没读到的没法比，总是排在最后，不随升降序变。
const ratingClass = (profile) => {
  if (!profile) return 2;
  return profile.missing ? 1 : 0;
};
const ratingValue = (profile) => (Number.isFinite(profile.rating) ? profile.rating : -Infinity);
export function compareByRating(a, b, descending = true) {
  const gap = ratingClass(a.profile) - ratingClass(b.profile);
  if (gap) return gap;
  let diff = 0;
  if (!ratingClass(a.profile)) {
    const [one, other] = [ratingValue(a.profile), ratingValue(b.profile)];
    if (one !== other) diff = one < other ? -1 : 1;
  }
  return (descending ? -diff : diff) || compareByName(a, b);
}
</script>
<script setup>
import { computed, ref, watch } from 'vue';
import { appSettings } from '../../../../../settings.js';
import { DEFAULT_AVATAR_URL } from '../../../../../features/user/avatars/data.js';
// 一个成员：头像（「显示用户头像」开着时）和按段位上色的名字。
// profile 是读到的资料（见 features/user/groups/profiles.js），还没读到时是 null。link 为真时名字是主页链接。
const props = defineProps({
  handle: { type: String, required: true },
  profile: { type: Object, default: null },
  link: Boolean,
});
// 读到资料后用原站的大小写。
const name = computed(() => props.profile?.handle || props.handle);
const ink = computed(() => rankInk(props.profile));
const legendary = computed(
  () => Number.isFinite(props.profile?.rating) && rankForRating(props.profile.rating).legendary,
);
// 头像的地址依次试：头像、主页大图、原站的默认图。前一个加载不出来换下一个。
const sources = computed(() => {
  if (!props.profile) return [];
  return [...new Set([props.profile.avatar, props.profile.fallback, DEFAULT_AVATAR_URL])].filter(
    Boolean,
  );
});
const failed = ref(0);
watch(sources, () => (failed.value = 0));
const source = computed(() => sources.value[Math.min(failed.value, sources.value.length - 1)]);
const attrs = computed(() =>
  props.link
    ? {
        href: '/profile/' + encodeURIComponent(name.value),
        target: '_blank',
        rel: 'noopener',
        // 页面上的头像功能会给主页链接加头像；这个链接由这里自己画，让它跳过。
        'data-cf-avatar-processed': 'own',
      }
    : {},
);
</script>
<template>
  <component :is="link ? 'a' : 'span'" class="cf-groups-who" v-bind="attrs">
    <!-- 「显示用户头像」开关切换时（比如按快捷键），头像缩进去、展开来，名字跟着滑。 -->
    <Transition name="cf-groups-avatar">
      <span v-if="appSettings.user.avatar.enabled" class="cf-groups-avatar">
        <img
          v-if="source"
          :src="source"
          alt=""
          loading="lazy"
          @error="failed < sources.length - 1 && failed++"
        />
      </span>
    </Transition>
    <span
      class="cf-groups-who-name"
      :class="{ 'is-legendary': legendary, 'is-missing': profile?.missing }"
      :style="{ color: ink }"
      >{{ name }}</span
    >
  </component>
</template>
<style>
.cf-groups-who,
a.cf-groups-who:link,
a.cf-groups-who:visited {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}
/* 名字和它后面的评分照原站表格里用户名的写法：13px、粗体、同一组字体。菜单的字号调大调小时跟着一起变。 */
.cf-groups-who,
.cf-groups-rating,
.cf-groups-cell-rating {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: var(--cf-font-size-lg);
  font-weight: var(--cf-font-weight-bold);
}
/* 头像：和页面上的一样是圆的，大小也一样，跟着「头像大小」的设置；还没读到时先留一个浅色的圆。 */
.cf-groups-avatar {
  flex: none;
  width: calc(var(--cf-avatar-px, 21px) * var(--cf-font-scale, 1));
  height: calc(var(--cf-avatar-px, 21px) * var(--cf-font-scale, 1));
  border: 1px solid rgb(0 0 0 / 10%);
  border-radius: 50%;
  background: var(--cf-gray-100);
  box-sizing: border-box;
  overflow: hidden;
}
.cf-groups-avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cf-groups-avatar-enter-active,
.cf-groups-avatar-leave-active {
  transition:
    width var(--cf-duration-moderate) var(--cf-ease-out),
    height var(--cf-duration-moderate) var(--cf-ease-out),
    margin var(--cf-duration-moderate) var(--cf-ease-out),
    border-width var(--cf-duration-moderate) var(--cf-ease-out),
    opacity var(--cf-duration-fast) ease;
}
/* 收起时连同它和名字之间的那 6px 间隔一起收掉。 */
.cf-groups-avatar-enter-from,
.cf-groups-avatar-leave-to {
  width: 0;
  height: 0;
  margin-right: -6px;
  border-width: 0;
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .cf-groups-avatar-enter-active,
  .cf-groups-avatar-leave-active {
    transition: none;
  }
}
.cf-groups-who-name {
  display: inline-block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--cf-duration-base) ease;
}
/* 3000 分以上：和原站一样第一个字是黑的。 */
.cf-groups-who-name.is-legendary::first-letter {
  color: var(--cf-gray-900);
}
.cf-groups-who-name.is-missing {
  color: var(--cf-gray-400);
  text-decoration: line-through;
}
a.cf-groups-who:hover .cf-groups-who-name {
  text-decoration: underline;
}
</style>
