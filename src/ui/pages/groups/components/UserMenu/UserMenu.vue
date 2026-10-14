<script setup>
import { ref, shallowRef, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { translate as t } from '../../../../../i18n/index.js';
import { USER_MENU_ICONS } from '../../../../../assets/index.js';
import { appSettings } from '../../../../../settings.js';
import { menuTabColor } from '../../../../../utils/petal-palette.js';
import { preventScrollChaining } from '../../../../../utils/scroll.js';
import { isTruncated } from '../../../../../utils/text-overflow.js';
import InlineSvg from '../../../../components/icons/InlineSvg/InlineSvg.vue';
import { tooltip } from '../../../../components/tooltips/FloatingTooltip/FloatingTooltip.vue';
import { getCurrentUserHandle } from '../../../../../features/page/account.js';
import { rankForRating } from '../../../../../features/contest/rating-prediction/algorithm/ranks.js';
import { DEFAULT_AVATAR_URL } from '../../../../../features/user/avatars/data.js';
import {
  readAccount,
  changeAccount,
  subscribeGroups,
  setFollowing,
} from '../../../../../features/user/groups/data.js';
import {
  profileOf,
  requestProfiles,
  subscribeProfiles,
} from '../../../../../features/user/groups/profiles.js';
import { userAt } from '../../../../../features/user/groups/targets.js';
import {
  FRIENDS_GROUP,
  MEMO_LIMIT,
  NAME_LIMIT,
  addGroup,
  groupIdsOf,
  groupNamed,
  joinGroup,
  leaveGroup,
  listGroups,
  memoOf,
  setMemo,
  userId,
} from '../../../../../features/user/groups/store.js';
import GroupMark from '../GroupMark/GroupMark.vue';
import { rankInk } from '../MemberName/MemberName.vue';

// 用户名上的右键菜单。用户分组开着、又登录着时，右键点页面上的「头像 + 用户名」（见 features/user/groups/targets.js）
// 弹出这个菜单，原站的右键菜单不再出现；原来常用的「在新标签页打开」「复制」在菜单最下面补上。
// 分组管理弹窗里成员的名字和头像也能右键出这个菜单。

// 正在看的用户：{ handle, href, x, y, key }，x、y 是右键点下的位置，key 每打开一次换一个。没打开时是 null。
const target = shallowRef(null);
const menu = ref(null);
// 打开时登录着的账号，和它的分组。
const owner = ref('');
const account = shallowRef(null);
const reload = () => (account.value = readAccount(owner.value));
// 菜单用分组页的主题色：勾选框、悬停的底色、没设颜色的分组小标都是它。
const accent = menuTabColor('groups');

// —— 这个人 ——
const profilesSeen = ref(0);
const profile = computed(() =>
  profilesSeen.value >= 0 && target.value ? profileOf(target.value.handle) : null,
);
// 读到资料后用原站的大小写（改过名的是现在的名字）。
const name = computed(() => profile.value?.handle || target.value?.handle || '');
const ink = computed(() => rankInk(profile.value));
const legendary = computed(
  () => Number.isFinite(profile.value?.rating) && rankForRating(profile.value.rating).legendary,
);
// 名字下面那一行：段位和评分；未评级的写 Unrated；查不到的写「查无此人」；还没读到时是空的。
const titleCase = (text) => text.replace(/(^|\s)\S/g, (char) => char.toUpperCase());
const rankLine = computed(() => {
  const own = profile.value;
  if (!own) return '';
  if (own.missing) return t('groupsNotFound');
  if (!Number.isFinite(own.rating)) return 'Unrated';
  return `${titleCase(own.rank || rankForRating(own.rating).name)} · ${own.rating}`;
});
// 头像依次试：主页大图（这里画得比表格里大）、小头像、原站的默认图。
const sources = computed(() =>
  profile.value && !profile.value.missing
    ? [...new Set([profile.value.fallback, profile.value.avatar, DEFAULT_AVATAR_URL])].filter(
        Boolean,
      )
    : [DEFAULT_AVATAR_URL],
);
const failed = ref(0);
watch(sources, () => (failed.value = 0));
const source = computed(() => sources.value[Math.min(failed.value, sources.value.length - 1)]);
const isSelf = computed(() => Boolean(owner.value) && userId(owner.value) === userId(name.value));

// —— 分组 ——
const groups = computed(() =>
  account.value
    ? listGroups(account.value)
    : [{ id: FRIENDS_GROUP, builtin: true, color: '', mark: '', frame: '', count: 0 }],
);
const joined = computed(
  () => new Set(account.value && name.value ? groupIdsOf(account.value, name.value) : []),
);
// 好友那一项：关注、取消关注要等原站答复。'' 是平常，'busy' 是等着，别的是没成功的原因（setFollowing 的 reason）。
// 记的是原因不是写好的话，换了语言跟着换。
const following = ref('');
const followNote = computed(() => {
  if (isSelf.value) return t('groupsMenuSelf');
  if (following.value === 'busy') return t('groupsWorking');
  if (following.value === 'signed-out') return t('groupsSyncSignedOut');
  if (following.value === 'not-found') return t('groupsNotFound');
  if (following.value) return t('groupsMenuFailed');
  return t('groupsMenuFollowNote');
});
async function toggleFollow() {
  if (isSelf.value || following.value === 'busy') return;
  const key = target.value.key;
  following.value = 'busy';
  const outcome = await setFollowing(name.value, !joined.value.has(FRIENDS_GROUP));
  // 等的时候菜单关了或换了人：名单照样改好了（setFollowing 自己写），这里不用再管。
  if (target.value?.key === key) following.value = outcome.ok ? '' : outcome.reason;
}
// 点一个分组：勾上就是加进去，去掉就是移出来；「好友」是在原站关注、取消关注。
function toggle(group) {
  if (group.builtin) return toggleFollow();
  const handle = name.value;
  const inside = joined.value.has(group.id);
  changeAccount(owner.value, (own) =>
    inside
      ? leaveGroup(own, group.id, [handle]) > 0
      : joinGroup(own, group.id, [handle]).added.length > 0,
  );
}

// 新建分组：「新建分组」那一项换成输入框，回车建好（不自动把这个人加进去，建好后自己勾）。
// 和已有的分组重名时，输入框和那个分组都标红，名字一改就消掉。
const creating = ref(false),
  draft = ref(''),
  conflict = ref(''),
  draftInput = ref(null);
watch(draft, () => (conflict.value = ''));
function startCreate() {
  draft.value = '';
  creating.value = true;
  nextTick(() => draftInput.value?.focus());
}
function cancelCreate() {
  creating.value = false;
  conflict.value = '';
}
function submitCreate() {
  if (!draft.value.trim()) return;
  if (changeAccount(owner.value, (own) => addGroup(own, { name: draft.value }) || false))
    return cancelCreate();
  conflict.value = account.value ? groupNamed(account.value, draft.value) : '';
}

// 备注：在至少一个分组里（好友也算）才能写。点一下换成输入框，回车或点到别处存下，Esc 不存。
const memo = computed(() => (account.value && name.value ? memoOf(account.value, name.value) : ''));
const canMemo = computed(() => joined.value.size > 0);
const editingMemo = ref(false),
  memoDraft = ref(''),
  memoInput = ref(null);
function startMemo() {
  if (!canMemo.value) return;
  tooltip.hide();
  memoDraft.value = memo.value;
  editingMemo.value = true;
  nextTick(() => memoInput.value?.select());
}
function saveMemo() {
  if (!editingMemo.value) return;
  editingMemo.value = false;
  changeAccount(owner.value, (own) => setMemo(own, name.value, memoDraft.value));
}
// 备注太长被省略时，鼠标移上去提示全文。
function showMemo(event) {
  if (isTruncated(event.currentTarget)) tooltip.show(event.currentTarget, memo.value);
}

// —— 链接 ——
function openTab() {
  window.open(target.value.href, '_blank', 'noopener');
  close();
}
function copy(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
  close();
}

// —— 打开、摆放、关闭 ——
const EDGE = 8;
const place = ref({ left: 0, top: 0, origin: 'left top' });
// 摆在右键点下的地方，往右下展开；右边或下边放不下时翻到左边、上边，再放不下就贴着窗口边。
function placeMenu() {
  const box = menu.value;
  const at = target.value;
  if (!box || !at) return;
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  const { offsetWidth: w, offsetHeight: h } = box;
  const flipX = at.x + w > width - EDGE;
  const flipY = at.y + h > height - EDGE;
  place.value = {
    left: Math.max(EDGE, flipX ? at.x - w : at.x),
    top: Math.max(EDGE, Math.min(flipY ? at.y - h : at.y, height - EDGE - h)),
    origin: `${flipX ? 'right' : 'left'} ${flipY ? 'bottom' : 'top'}`,
  };
}
// 打开以后内容变高、变宽了（新建了分组，读到了段位）：超出窗口时往里挪，不再翻面。
function keepInside() {
  const box = menu.value;
  if (!box) return;
  const root = document.documentElement;
  const top = Math.max(
    EDGE,
    Math.min(place.value.top, root.clientHeight - EDGE - box.offsetHeight),
  );
  const left = Math.max(
    EDGE,
    Math.min(place.value.left, root.clientWidth - EDGE - box.offsetWidth),
  );
  if (top !== place.value.top || left !== place.value.left)
    place.value = { ...place.value, top, left };
}
const watcher = typeof ResizeObserver === 'function' ? new ResizeObserver(keepInside) : null;
watch(menu, (box, old) => {
  if (old) watcher?.unobserve(old);
  if (!box) return;
  watcher?.observe(box);
  preventScrollChaining(box);
});

let opened = 0;
function open(user, x, y) {
  owner.value = getCurrentUserHandle() || '';
  reload();
  tooltip.hide();
  following.value = '';
  editingMemo.value = false;
  failed.value = 0;
  cancelCreate();
  target.value = { ...user, x, y, key: ++opened };
  place.value = { left: x, top: y, origin: 'left top' };
  // 菜单进场的第一帧之前摆好，不会先在点下的地方出现再跳开。
  nextTick(placeMenu);
  requestProfiles([user.handle]).catch(() => {});
}
function close() {
  if (!target.value) return;
  tooltip.hide();
  target.value = null;
}

function onContextMenu(event) {
  // 菜单自己里面：不出原站的菜单；输入框除外（要能粘贴）。
  if (menu.value?.contains(event.target)) {
    if (!event.target.closest('input')) event.preventDefault();
    return;
  }
  const user =
    appSettings.groups.enabled && getCurrentUserHandle()
      ? userAt(event.target, event.clientX)
      : null;
  if (!user) return close();
  event.preventDefault();
  open(user, event.clientX, event.clientY);
}
// 点到菜单外面、按 Esc、页面滚动、窗口大小变了、切走了：收起。
const outside = (event) => target.value && !menu.value?.contains(event.target);
const onPointerDown = (event) => outside(event) && close();
const onScroll = (event) => outside(event) && close();
const onKey = (event) => event.key === 'Escape' && close();
watch(
  () => appSettings.groups.enabled,
  (enabled) => enabled || close(),
);

let stopGroups, stopProfiles;
onMounted(() => {
  document.addEventListener('contextmenu', onContextMenu, true);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKey);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', close);
  window.addEventListener('blur', close);
  stopGroups = subscribeGroups(() => target.value && reload());
  stopProfiles = subscribeProfiles(() => profilesSeen.value++);
});
onBeforeUnmount(() => {
  document.removeEventListener('contextmenu', onContextMenu, true);
  document.removeEventListener('pointerdown', onPointerDown, true);
  document.removeEventListener('keydown', onKey);
  window.removeEventListener('scroll', onScroll, true);
  window.removeEventListener('resize', close);
  window.removeEventListener('blur', close);
  watcher?.disconnect();
  stopGroups?.();
  stopProfiles?.();
});
</script>
<template>
  <Teleport to="body"
    ><Transition name="cf-user-menu"
      ><div
        v-if="target"
        :key="target.key"
        ref="menu"
        class="cf-user-menu"
        role="menu"
        data-cf-language-surface
        :style="{
          left: place.left + 'px',
          top: place.top + 'px',
          transformOrigin: place.origin,
          '--cf-menu-accent': accent,
        }"
      >
        <div class="cf-user-menu-head">
          <Transition name="cf-user-menu-avatar">
            <span v-if="appSettings.user.avatar.enabled" class="cf-user-menu-avatar"
              ><img :src="source" alt="" @error="failed < sources.length - 1 && failed++"
            /></span>
          </Transition>
          <span class="cf-user-menu-who">
            <span
              class="cf-user-menu-name"
              :class="{ 'is-legendary': legendary, 'is-missing': profile?.missing }"
              :style="{ color: ink }"
              >{{ name }}</span
            >
            <span class="cf-user-menu-rank" :style="{ color: ink }">{{ rankLine }}</span>
          </span>
        </div>
        <hr class="cf-user-menu-rule" />
        <div class="cf-user-menu-title">{{ t('groupsMenuGroups') }}</div>
        <div class="cf-user-menu-groups">
          <TransitionGroup name="cf-user-menu-row">
            <button
              v-for="group in groups"
              :key="group.id"
              type="button"
              role="menuitemcheckbox"
              class="cf-user-menu-item"
              :class="{
                'is-busy': group.builtin && following === 'busy',
                'has-conflict': conflict === group.id,
              }"
              :aria-checked="joined.has(group.id)"
              :disabled="group.builtin && isSelf"
              @click="toggle(group)"
            >
              <span class="cf-user-menu-check" :class="{ on: joined.has(group.id) }"></span>
              <GroupMark :group="group" />
              <span class="cf-user-menu-label">{{
                group.builtin ? t('groupsFriends') : group.name
              }}</span>
              <Transition v-if="group.builtin" name="cf-user-menu-swap" mode="out-in">
                <span
                  :key="followNote"
                  class="cf-user-menu-end"
                  :class="{ 'is-error': following && following !== 'busy' }"
                  >{{ followNote }}</span
                >
              </Transition>
            </button>
          </TransitionGroup>
        </div>
        <Transition name="cf-user-menu-swap" mode="out-in">
          <form v-if="creating" class="cf-user-menu-item is-input" @submit.prevent="submitCreate">
            <InlineSvg class="cf-user-menu-icon" :source="USER_MENU_ICONS.plus" />
            <input
              ref="draftInput"
              v-model="draft"
              class="cf-user-menu-input"
              :class="{ 'has-conflict': conflict }"
              type="text"
              :maxlength="NAME_LIMIT"
              :placeholder="t('groupsNamePlaceholder')"
              @keydown.esc.stop="cancelCreate"
              @blur="draft.trim() || cancelCreate()"
            />
          </form>
          <button
            v-else
            type="button"
            role="menuitem"
            class="cf-user-menu-item"
            @click="startCreate"
          >
            <InlineSvg class="cf-user-menu-icon" :source="USER_MENU_ICONS.plus" />
            <span class="cf-user-menu-label">{{ t('groupsCreate') }}</span>
          </button>
        </Transition>
        <hr class="cf-user-menu-rule" />
        <Transition name="cf-user-menu-swap" mode="out-in">
          <form v-if="editingMemo" class="cf-user-menu-item is-input" @submit.prevent="saveMemo">
            <InlineSvg class="cf-user-menu-icon" :source="USER_MENU_ICONS.quill" />
            <input
              ref="memoInput"
              v-model="memoDraft"
              class="cf-user-menu-input"
              type="text"
              :maxlength="MEMO_LIMIT"
              :placeholder="t('groupsMemoPlaceholder')"
              @keydown.esc.stop="editingMemo = false"
              @blur="saveMemo"
            />
          </form>
          <button
            v-else
            type="button"
            role="menuitem"
            class="cf-user-menu-item"
            :disabled="!canMemo"
            @click="startMemo"
          >
            <InlineSvg class="cf-user-menu-icon" :source="USER_MENU_ICONS.quill" />
            <span class="cf-user-menu-label">{{ t('groupsMenuMemo') }}</span>
            <span
              v-if="memo && canMemo"
              class="cf-user-menu-end is-memo"
              @mouseenter="showMemo"
              @mouseleave="tooltip.hide()"
              >{{ memo }}</span
            >
          </button>
        </Transition>
        <hr class="cf-user-menu-rule" />
        <button type="button" role="menuitem" class="cf-user-menu-item" @click="openTab">
          <InlineSvg class="cf-user-menu-icon" :source="USER_MENU_ICONS.open" />
          <span class="cf-user-menu-label">{{ t('groupsMenuOpen') }}</span>
        </button>
        <button type="button" role="menuitem" class="cf-user-menu-item" @click="copy(name)">
          <InlineSvg class="cf-user-menu-icon" :source="USER_MENU_ICONS.copy" />
          <span class="cf-user-menu-label">{{ t('groupsMenuCopyName') }}</span>
        </button>
        <button type="button" role="menuitem" class="cf-user-menu-item" @click="copy(target.href)">
          <InlineSvg class="cf-user-menu-icon" :source="USER_MENU_ICONS.link" />
          <span class="cf-user-menu-label">{{ t('groupsMenuCopyLink') }}</span>
        </button>
      </div></Transition
    ></Teleport
  >
</template>
<style>
/* 宽度跟着内容走：段位名、分组名长的时候撑宽，不到 236px 时按 236px，最宽 360px（再长的才省略）。 */
.cf-user-menu {
  position: fixed;
  z-index: 2147483640;
  width: max-content;
  min-width: 236px;
  max-width: min(360px, calc(100vw - 16px));
  padding: 6px;
  border: 1px solid var(--cf-gray-200);
  border-radius: var(--cf-radius-lg);
  background: color-mix(in srgb, var(--cf-white-surface) 96%, transparent);
  box-shadow:
    0 12px 32px #1f2d3d2e,
    0 2px 6px #1f2d3d14;
  backdrop-filter: blur(8px);
  box-sizing: border-box;
  color: var(--cf-gray-700);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: var(--cf-font-size-base);
  line-height: 18px;
  text-align: left;
  user-select: none;
}
.cf-user-menu-enter-active {
  transition:
    opacity var(--cf-duration-fast) ease,
    transform var(--cf-duration-fast) var(--cf-ease-out);
}
.cf-user-menu-leave-active {
  transition: opacity var(--cf-duration-fast) ease;
}
.cf-user-menu-enter-from {
  opacity: 0;
  transform: scale(0.96);
}
.cf-user-menu-leave-to {
  opacity: 0;
}

/* 顶上：头像、名字、段位和评分。名字和评分照原站表格里用户名的写法，和分组页的成员一样。 */
.cf-user-menu-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px 8px 4px;
}
.cf-user-menu-avatar {
  flex: none;
  width: 40px;
  height: 40px;
  border: 1px solid rgb(0 0 0 / 10%);
  border-radius: 50%;
  background: var(--cf-gray-100);
  box-sizing: border-box;
  overflow: hidden;
}
.cf-user-menu-avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cf-user-menu-avatar-enter-active,
.cf-user-menu-avatar-leave-active {
  transition:
    width var(--cf-duration-moderate) var(--cf-ease-out),
    height var(--cf-duration-moderate) var(--cf-ease-out),
    margin var(--cf-duration-moderate) var(--cf-ease-out),
    border-width var(--cf-duration-moderate) var(--cf-ease-out),
    opacity var(--cf-duration-fast) ease;
}
.cf-user-menu-avatar-enter-from,
.cf-user-menu-avatar-leave-to {
  width: 0;
  height: 0;
  margin-right: -10px;
  border-width: 0;
  opacity: 0;
}
.cf-user-menu-who {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-weight: var(--cf-font-weight-bold);
}
.cf-user-menu-name,
.cf-user-menu-rank {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--cf-duration-base) ease;
}
.cf-user-menu-name {
  font-size: var(--cf-font-size-lg);
}
/* 3000 分以上：和原站一样第一个字是黑的。 */
.cf-user-menu-name.is-legendary::first-letter {
  color: var(--cf-gray-900);
}
.cf-user-menu-name.is-missing {
  color: var(--cf-gray-400);
  text-decoration: line-through;
}
/* 还没读到时是空的，也留着这一行的高度，读到后不把下面的内容往下推。 */
.cf-user-menu-rank {
  min-height: 16px;
  font-size: var(--cf-font-size-xs);
  line-height: 16px;
}

.cf-user-menu-rule {
  height: 1px;
  margin: 4px 6px;
  border: 0;
  background: var(--cf-gray-200);
}
.cf-user-menu-title {
  padding: 4px 8px 2px;
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-xs);
}
/* 分组多的时候，分组这一段自己滚动，菜单不会长出窗口。 */
.cf-user-menu-groups {
  max-height: 224px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--cf-menu-accent) 35%, transparent) transparent;
}

.cf-user-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 28px;
  margin: 0;
  padding: 0 8px;
  border: 0;
  border-radius: var(--cf-radius-sm);
  background: none;
  box-sizing: border-box;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background-color var(--cf-duration-fast) ease,
    opacity var(--cf-duration-base) ease;
}
.cf-user-menu-item:hover:not(:disabled, .is-input) {
  background: color-mix(in srgb, var(--cf-menu-accent) 14%, transparent);
}
.cf-user-menu-item:disabled {
  opacity: 0.4;
  cursor: default;
}
.cf-user-menu-item.is-busy {
  cursor: progress;
}
.cf-user-menu-item.is-input {
  cursor: default;
}
.cf-user-menu-item .cf-groups-mark {
  width: 16px;
  height: 16px;
  font-size: var(--cf-font-size-2xs);
}
/* 重名时标红，和分组页、管理弹窗里的一样。 */
.cf-user-menu-item.has-conflict,
.cf-user-menu-item.has-conflict:hover:not(:disabled) {
  background: #fff1f2;
  box-shadow: inset 0 0 0 1px #e65b70;
  color: #bd2542;
}
.cf-user-menu-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cf-user-menu-end {
  flex: none;
  max-width: 96px;
  margin-left: auto;
  overflow: hidden;
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 备注占满名字后面剩下的地方，太长时省略。 */
.cf-user-menu-end.is-memo {
  flex: 1;
  max-width: none;
  text-align: right;
}
.cf-user-menu-end.is-error {
  color: #bd2542;
}
.cf-user-menu-icon {
  flex: none;
  width: 16px;
  height: 16px;
  color: color-mix(in srgb, var(--cf-menu-accent) 55%, var(--cf-gray-700));
}

/* 勾选框：勾上时填满主题色，里面的勾由两条边画出来，弹一下出现。 */
.cf-user-menu-check {
  display: grid;
  place-items: center;
  flex: none;
  width: 14px;
  height: 14px;
  border: 2px solid var(--cf-gray-300);
  border-radius: var(--cf-radius-xs);
  box-sizing: border-box;
  transition:
    background-color var(--cf-duration-fast) ease,
    border-color var(--cf-duration-fast) ease;
}
.cf-user-menu-check::after {
  content: '';
  width: 3px;
  height: 6px;
  margin-top: -2px;
  border: solid var(--cf-white-ink);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) scale(0);
  transition: transform var(--cf-duration-fast) var(--cf-ease-out);
}
.cf-user-menu-check.on {
  border-color: var(--cf-menu-accent);
  background: var(--cf-menu-accent);
}
.cf-user-menu-check.on::after {
  transform: rotate(45deg) scale(1);
}
.cf-user-menu-item.is-busy .cf-user-menu-check {
  animation: cf-user-menu-busy 0.9s ease-in-out infinite alternate;
}
@keyframes cf-user-menu-busy {
  to {
    opacity: 0.35;
  }
}

/* 新建分组、写备注时那一项里的输入框。 */
.cf-user-menu-input {
  flex: 1;
  min-width: 0;
  height: 22px;
  padding: 0 6px;
  border: 1px solid color-mix(in srgb, var(--cf-menu-accent) 55%, transparent);
  border-radius: var(--cf-radius-xs);
  outline: none;
  background: var(--cf-white-surface);
  box-sizing: border-box;
  color: var(--cf-gray-700);
  font: inherit;
  transition:
    border-color var(--cf-duration-fast) ease,
    box-shadow var(--cf-duration-fast) ease;
}
.cf-user-menu-input:focus {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--cf-menu-accent) 22%, transparent);
}
.cf-user-menu-input::placeholder {
  color: var(--cf-gray-400);
}
.cf-user-menu-input.has-conflict {
  border-color: #e65b70;
  background: #fff1f2;
  box-shadow: 0 0 0 2px #e65b7026;
  color: #bd2542;
}

/* 一项换成输入框、好友那一项后面的字换了：淡出旧的、淡入新的。 */
.cf-user-menu-swap-enter-active,
.cf-user-menu-swap-leave-active {
  transition: opacity 0.1s ease;
}
.cf-user-menu-swap-enter-from,
.cf-user-menu-swap-leave-to {
  opacity: 0;
}
/* 分组多了一个（新建的）、少了一个（别的标签页删的）：这一行展开、收起。 */
.cf-user-menu-row-enter-active,
.cf-user-menu-row-leave-active {
  overflow: hidden;
  transition:
    height var(--cf-duration-base) var(--cf-ease-out),
    opacity var(--cf-duration-base) ease;
}
.cf-user-menu-row-enter-from,
.cf-user-menu-row-leave-to {
  height: 0;
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .cf-user-menu-enter-active,
  .cf-user-menu-leave-active,
  .cf-user-menu-avatar-enter-active,
  .cf-user-menu-avatar-leave-active,
  .cf-user-menu-swap-enter-active,
  .cf-user-menu-swap-leave-active,
  .cf-user-menu-row-enter-active,
  .cf-user-menu-row-leave-active {
    transition: none;
  }
}
</style>
