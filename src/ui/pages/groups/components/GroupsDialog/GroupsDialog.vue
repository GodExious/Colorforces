<script>
import { shallowRef } from 'vue';
const request = shallowRef(null);
// 打开分组管理。groupId 给了就先停在那个分组上，没给停在「好友」上。弹窗始终只有一个。
export function showGroupsDialog(groupId = '') {
  request.value = { groupId };
}
</script>
<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { translate as t } from '../../../../../i18n/index.js';
import * as assets from '../../../../../assets/index.js';
import { appSettings } from '../../../../../settings.js';
import { FONT_SIZE } from '../../../../../config/defaults.js';
import {
  menuTabColor,
  nearestPetalPosition,
  petalColor,
  PETAL_COLORS,
} from '../../../../../utils/petal-palette.js';
import { preventScrollChaining } from '../../../../../utils/scroll.js';
import InlineSvg from '../../../../components/icons/InlineSvg/InlineSvg.vue';
import DialogTransition from '../../../../components/transitions/DialogTransition/DialogTransition.vue';
import ExpandTransition from '../../../../components/transitions/ExpandTransition/ExpandTransition.vue';
import { showConfirmPop } from '../../../../components/dialogs/ConfirmDialog/ConfirmDialog.vue';
import { tooltip } from '../../../../components/tooltips/FloatingTooltip/FloatingTooltip.vue';
import { getCurrentUserHandle } from '../../../../../features/page/account.js';
import {
  readAccount,
  changeAccount,
  subscribeGroups,
  refreshMembers,
  setFollowing,
} from '../../../../../features/user/groups/data.js';
import { profileOf, subscribeProfiles } from '../../../../../features/user/groups/profiles.js';
import GroupMark from '../GroupMark/GroupMark.vue';
import MemberName, {
  compareByName,
  compareByRating,
  rankInk,
  ratingLabel,
} from '../MemberName/MemberName.vue';
import {
  FRIENDS_GROUP,
  MEMO_LIMIT,
  NAME_LIMIT,
  addGroup,
  editGroup,
  groupIdsOf,
  groupNamed,
  isFriend,
  isHandle,
  joinGroup,
  leaveGroup,
  listGroups,
  membersOf,
  memoOf,
  removeGroup,
  setMemo,
} from '../../../../../features/user/groups/store.js';

const overlay = ref(null);
// 打开时登录着的账号；弹窗开着的这段时间里按它读写。
const owner = ref('');
const account = shallowRef(null);
const selected = ref(FRIENDS_GROUP);
const reload = () => {
  account.value = readAccount(owner.value);
  // 正看着的分组被删了（比如在别的标签页里），回到「好友」。
  if (!groups.value.some((group) => group.id === selected.value)) selected.value = FRIENDS_GROUP;
  // 顺带读成员的资料（评分、头像）；缓存里都有的话不会发请求。
  refreshMembers(owner.value);
};
// 正在自定义颜色的滑杆上拖着时选到的颜色，没在拖时是空的。拖的过程中不往存储里写（每动一下就写一次，
// 别的标签页和页面上的标签都会跟着重算，写回来的又会和手上的打架、颜色来回跳），
// 只在这里把当前分组的颜色换成它：左边的分组、成员表里的分组标签当场跟着变，松手才存。
const draftColor = ref('');
const groups = computed(() => {
  if (!account.value) return [{ id: FRIENDS_GROUP, builtin: true, frame: '', count: 0 }];
  const list = listGroups(account.value);
  if (!draftColor.value) return list;
  return list.map((group) =>
    group.id === selected.value ? { ...group, color: draftColor.value } : group,
  );
});
const current = computed(() => groups.value.find((group) => group.id === selected.value));
const nameOf = (group) => (group.builtin ? t('groupsFriends') : group.name);
// 在这个账号的分组上改一下；change 返回 false 表示没有改动。
const change = (run) => changeAccount(owner.value, run);

// 成员的资料读到了新的时加一，下面按它重新取。
const profilesSeen = ref(0);
// 排序：点「用户」或「评分」的表头来换，再点一次反过来。打开弹窗时总是按用户名从小到大，不记上次的。
const sortKey = ref('name'),
  sortDown = ref(false);
function sortBy(key) {
  if (sortKey.value === key) sortDown.value = !sortDown.value;
  else {
    sortKey.value = key;
    // 评分先从高到低，名字先从小到大。
    sortDown.value = key === 'rating';
  }
}
// 当前分组的成员。每一项带上读到的资料、所在的分组和备注。
const rows = computed(() => {
  const own = account.value;
  if (!own || !current.value || profilesSeen.value < 0) return [];
  const list = membersOf(own, current.value.id).map((handle) => {
    const joined = groupIdsOf(own, handle).map((id) =>
      groups.value.find((group) => group.id === id),
    );
    return {
      handle,
      profile: profileOf(handle),
      groups: joined,
      shown: fitGroups(joined),
      memo: memoOf(own, handle),
    };
  });
  if (sortKey.value === 'rating') return list.sort((a, b) => compareByRating(a, b, sortDown.value));
  return list.sort((a, b) => (sortDown.value ? compareByName(b, a) : compareByName(a, b)));
});

// 勾选：只在自建的分组里有，用来批量移出。换分组时清空。
const checked = ref([]);
const toggleChecked = (handle) =>
  (checked.value = checked.value.includes(handle)
    ? checked.value.filter((item) => item !== handle)
    : [...checked.value, handle]);
function select(id) {
  selected.value = id;
  checked.value = [];
  notes.value = [];
  adding.value = '';
  customOpen.value = false;
  draftColor.value = '';
}
function removeChecked() {
  if (current.value.builtin) return requestUnfollowChecked();
  leave(checked.value);
  checked.value = [];
}
const removeOne = (handle) => {
  if (current.value.builtin) return unfollow([handle]);
  leave([handle]);
  checked.value = checked.value.filter((item) => item !== handle);
};
// 从自建的分组里移出几个人，移出了几个写在输入框下面。
function leave(handles) {
  let left = 0;
  change((own) => (left = leaveGroup(own, selected.value, handles)) > 0);
  if (left) notes.value = [['groupsRemoved', left]];
}

// 「好友」这一组的增减就是在原站关注、取消关注：一个接一个地发请求，两次之间隔一会儿。working 为真时正在发。
// 返回 { done: 成了的, missing: 没有这个用户的, failed: 没成的, message: 原站给的原因 }。
const working = ref(false);
const FOLLOW_GAP = 800;
async function followEach(handles, follow) {
  const outcome = { done: [], missing: [], failed: [], message: '' };
  working.value = true;
  for (const [index, handle] of handles.entries()) {
    if (index) await new Promise((done) => setTimeout(done, FOLLOW_GAP));
    const result = await setFollowing(handle, follow);
    if (result.ok) outcome.done.push(result.handle);
    else if (result.reason === 'not-found') outcome.missing.push(handle);
    else {
      outcome.failed.push(handle);
      outcome.message ||= result.message || '';
      // 没登录的话后面的也不会成，不用再试。
      if (result.reason === 'signed-out') {
        outcome.failed.push(...handles.slice(index + 1));
        break;
      }
    }
  }
  working.value = false;
  return outcome;
}
// 结果写在输入框下面；这期间换到了别的分组就不写了。
function report(lines, outcome) {
  if (outcome.missing.length) lines.push(['groupsFollowMissing', outcome.missing.join(', ')]);
  if (outcome.failed.length)
    lines.push(['groupsFollowFailed', outcome.failed.join(', '), outcome.message]);
  if (selected.value === FRIENDS_GROUP) notes.value = lines;
}
async function follow(handles) {
  // 不像账号的不用去问原站；已经关注的跳过。
  const valid = handles.filter(isHandle);
  const fresh = valid.filter((handle) => !account.value || !isFriend(account.value, handle));
  const outcome = await followEach(fresh, true);
  outcome.missing.unshift(...handles.filter((handle) => !isHandle(handle)));
  const lines = [];
  if (outcome.done.length) lines.push(['groupsFollowed', outcome.done.length]);
  else if (!outcome.missing.length && !outcome.failed.length)
    lines.push(['groupsAlreadyFollowing']);
  report(lines, outcome);
  // 没成的留在输入框里，方便改了再试。
  if (selected.value === FRIENDS_GROUP)
    adding.value = [...outcome.missing, ...outcome.failed].join(' ');
}
async function unfollow(handles) {
  const outcome = await followEach(handles, false);
  checked.value = checked.value.filter((item) => !outcome.done.includes(item));
  // 取消关注时「没有这个用户」也算没成。
  outcome.failed.push(...outcome.missing.splice(0));
  report(outcome.done.length ? [['groupsUnfollowed', outcome.done.length]] : [], outcome);
}
function requestUnfollowChecked() {
  const handles = [...checked.value];
  showConfirmPop({
    title: () => t('groupsUnfollowTitle'),
    message: () => t('groupsUnfollowConfirm', handles.length),
    confirmText: () => t('groupsUnfollowTitle'),
    type: 'danger',
    onConfirm: () => unfollow(handles),
  });
}

// 加人：输入框里可以一次写好几个名字，用空格或英文逗号隔开（账号名里不会有这两样）；回车加进当前的分组。
// 输入框下面那句结果：记的是一条条「词条的名字和它要带的数」，不是写好的句子，
// 这样换了语言之后这句话跟着换，不会停在操作那一刻的语言上。
const adding = ref(''),
  notes = ref([]);
const feedback = computed(() => notes.value.map(([key, ...args]) => t(key, ...args)).join(' '));
function submitAdd() {
  const handles = adding.value.split(/[\s,]+/).filter(Boolean);
  if (!handles.length || working.value) return;
  if (current.value.builtin) return follow(handles);
  let outcome = { added: [], invalid: [] };
  change((own) => {
    outcome = joinGroup(own, selected.value, handles);
    return outcome.added.length > 0;
  });
  const lines = [];
  if (outcome.added.length) lines.push(['groupsAdded', outcome.added.length]);
  else if (!outcome.invalid.length) lines.push(['groupsAlreadyIn']);
  if (outcome.invalid.length) lines.push(['groupsInvalidNames', outcome.invalid.join(', ')]);
  notes.value = lines;
  // 不像账号的那几个留在输入框里，方便改了再加。
  adding.value = outcome.invalid.join(' ');
}

// 改名：输入框失去焦点或按回车时保存。名字是空的或和别的分组重名时不保存，换回原来的名字。
const renaming = ref('');
watch(
  current,
  (group) => {
    renaming.value = group && !group.builtin ? group.name : '';
  },
  { immediate: true },
);
function commitName() {
  const group = current.value;
  if (!group || group.builtin || renaming.value.trim() === group.name) return;
  const done = change((own) => editGroup(own, group.id, { name: renaming.value }));
  if (!done) renaming.value = group.name;
}
const setColor = (color) => change((own) => editGroup(own, selected.value, { color }));
// 点预设的色块：定下这个颜色，自定义的滑杆收起来。
function pickColor(color) {
  customOpen.value = false;
  setColor(color);
}
// 自定义颜色：不给完整的取色器，只在花瓣的色环上选一个位置。环上任何一处的深浅、鲜艳程度都和八个预设色差不多，
// 选出来的颜色和别的分组放在一起不会突兀。拖的时候只改预览（见上面的 draftColor），松手才存。
const RING = [...PETAL_COLORS, PETAL_COLORS[0]].join(', ');
const HUE_STEP = 0.05;
const customOpen = ref(false),
  huePosition = ref(0);
const hueColor = computed(() => petalColor(huePosition.value));
const isCustom = computed(
  () => Boolean(current.value?.color) && !PETAL_COLORS.includes(current.value.color),
);
function toggleCustom() {
  customOpen.value = !customOpen.value;
  // 打开时滑块停在现在这个颜色上（没设颜色时停在最左边）；还没拖动就不改颜色。
  if (customOpen.value) huePosition.value = nearestPetalPosition(current.value.color, HUE_STEP);
}
function dragHue(event) {
  huePosition.value = Number(event.target.value);
  draftColor.value = hueColor.value;
}
// 松手：存下来。存好之后这个分组的颜色已经是它了，预览撤掉也不会跳。
function commitHue() {
  setColor(hueColor.value);
  draftColor.value = '';
}

// 「所在分组」一格里放得下几个分组：按名字的长短估，放不下的收成「+N」，鼠标移上去看全部。
// 估的是这一格大约 140px 宽、标签里半角字符约 6.5px、别的字符约 11px 一个，随菜单的字号放大缩小。
const TAGS_ROOM = 140;
function fitGroups(list) {
  const scale = appSettings.general.fontSize / FONT_SIZE.base;
  const widthOf = (group) =>
    (12 +
      [...nameOf(group)].reduce((sum, char) => sum + (char.charCodeAt(0) < 256 ? 6.5 : 11), 0)) *
    scale;
  let used = 0,
    shown = 0;
  for (const [index, group] of list.entries()) {
    // 后面还有的话，要给「+N」留出位置。
    const reserve = index < list.length - 1 ? 30 * scale : 0;
    const width = widthOf(group) + (index ? 4 : 0);
    if (shown && used + width + reserve > TAGS_ROOM) break;
    used += width;
    shown++;
  }
  return shown;
}
function showGroups(event, row) {
  const cell = event.currentTarget;
  const cut = [...cell.children].some((chip) => chip.scrollWidth > chip.clientWidth + 1);
  if (row.groups.length > row.shown || cut)
    tooltip.show(cell, row.groups.map(nameOf).join(t('groupsListJoin')));
}
function setMark(event) {
  change((own) => editGroup(own, selected.value, { mark: event.target.value }));
  // 标记最多留两个字符，输入框里换成实际存下的。
  event.target.value = current.value?.mark || '';
}
// 备注太长、在格子里被省略了时，鼠标移上去显示完整的；正在改的时候不显示。
function showMemo(event) {
  const input = event.currentTarget;
  if (document.activeElement !== input && input.value && input.scrollWidth > input.clientWidth + 1)
    tooltip.show(input, input.value);
}
const saveMemo = (handle, event) => {
  const done = change((own) => setMemo(own, handle, event.target.value));
  // 没存进去（比如超长被截了、或者这个人刚被移出去）时，输入框里换回存着的那份。
  if (!done) event.target.value = account.value ? memoOf(account.value, handle) : '';
};
// 确认框的正文是按网页代码显示的，分组名是用户自己填的，先把里面的尖括号这些换掉。
const escapeHtml = (text) => text.replace(/[&<>"']/g, (char) => '&#' + char.charCodeAt(0) + ';');
function requestRemoveGroup() {
  const group = current.value;
  showConfirmPop({
    title: () => t('groupsDeleteTitle'),
    message: () => t('groupsDeleteConfirm', escapeHtml(group.name), group.count),
    confirmText: () => t('groupsDelete'),
    type: 'danger',
    onConfirm: () => {
      change((own) => removeGroup(own, group.id));
      select(FRIENDS_GROUP);
    },
  });
}

// 新建分组：左边最下面一行，点了换成输入框。
const creating = ref(false),
  draft = ref(''),
  rejected = ref(false),
  draftInput = ref(null);
function startCreate() {
  creating.value = true;
  draft.value = '';
  nextTick(() => draftInput.value?.focus());
}
// 新建时和哪个分组重名了（它的 id）：输入框和那个分组都标红，名字一改就消掉。
const conflict = ref('');
watch(draft, () => (conflict.value = ''));
function cancelCreate() {
  creating.value = false;
  rejected.value = false;
  conflict.value = '';
}
function submitCreate() {
  const id = change((own) => addGroup(own, { name: draft.value }) || false);
  if (id) {
    cancelCreate();
    select(id);
    return;
  }
  conflict.value = account.value ? groupNamed(account.value, draft.value) : '';
  if (conflict.value)
    nextTick(() =>
      overlay.value
        ?.querySelector('.cf-groups-side-row.has-conflict')
        ?.scrollIntoView({ block: 'nearest' }),
    );
  rejected.value = false;
  requestAnimationFrame(() => (rejected.value = true));
}

// 只有右上角的 × 和下面的「完成」能关：这个弹窗里要点的东西多，点到框外面、按到 Esc 就关掉太容易误触。
function close() {
  request.value = null;
}
let stop, stopProfiles;
watch(request, (value) => {
  if (!value) return;
  owner.value = getCurrentUserHandle() || '';
  selected.value = value.groupId || FRIENDS_GROUP;
  sortKey.value = 'name';
  sortDown.value = false;
  checked.value = [];
  notes.value = [];
  adding.value = '';
  cancelCreate();
  reload();
});
watch(overlay, (node) => {
  if (node) preventScrollChaining(node);
});
onMounted(() => {
  stop = subscribeGroups(() => request.value && reload());
  stopProfiles = subscribeProfiles(() => profilesSeen.value++);
});
onBeforeUnmount(() => {
  stop?.();
  stopProfiles?.();
  close();
});
</script>
<template>
  <Teleport to="body"
    ><DialogTransition
      ><div
        class="cf-clist-modal-overlay cf-aurora-dialog cf-groups-modal"
        v-if="request"
        ref="overlay"
      >
        <div class="cf-clist-modal-card cf-aurora-card cf-groups-card">
          <div class="cf-clist-modal-header">
            <div class="cf-clist-modal-title">
              <span
                class="cf-modal-title-icon cf-aurora-emblem"
                :style="{ '--cf-emblem-petal': menuTabColor('groups') }"
                ><InlineSvg :source="assets.menuGroupsIcon"
              /></span>
              <span>{{ t('groupsDialogTitle') }}</span>
            </div>
            <button type="button" class="cf-modal-close-btn cf-aurora-close" @click="close">
              ×
            </button>
          </div>
          <div class="cf-groups-dialog-body">
            <div class="cf-groups-side">
              <button
                v-for="group in groups"
                :key="group.id"
                type="button"
                class="cf-groups-side-row"
                :class="{ active: group.id === selected, 'has-conflict': conflict === group.id }"
                @click="select(group.id)"
              >
                <GroupMark :group="group" />
                <span class="cf-groups-side-name">{{ nameOf(group) }}</span>
                <span class="cf-groups-side-count">{{ group.count }}</span>
              </button>
              <form
                v-if="creating"
                class="cf-groups-side-form"
                :class="{ 'is-rejected': rejected }"
                @submit.prevent="submitCreate"
                @animationend="rejected = false"
              >
                <input
                  ref="draftInput"
                  v-model="draft"
                  class="cf-groups-input"
                  :class="{ 'has-conflict': conflict }"
                  type="text"
                  :maxlength="NAME_LIMIT"
                  :placeholder="t('groupsNamePlaceholder')"
                  @keydown.esc.stop="cancelCreate"
                  @blur="draft.trim() || cancelCreate()"
                />
              </form>
              <button v-else type="button" class="cf-groups-side-row is-add" @click="startCreate">
                <span aria-hidden="true">+</span>{{ t('groupsCreate') }}
              </button>
            </div>
            <div class="cf-groups-main" v-if="current">
              <!-- 换分组时右边整块淡出再淡入；里面的行只在同一个分组里增减、换先后时才各自过渡。 -->
              <Transition name="cf-groups-swap" mode="out-in">
                <div class="cf-groups-pane" :key="current.id">
                  <div class="cf-groups-editor">
                    <input
                      class="cf-groups-input cf-groups-editor-mark"
                      type="text"
                      :value="current.mark"
                      :placeholder="current.builtin ? '★' : t('groupsMarkPlaceholder')"
                      :data-tooltip="
                        t(current.builtin ? 'groupsFriendsMarkHint' : 'groupsMarkHint')
                      "
                      @change="setMark"
                    />
                    <!-- 「好友」的名字是固定的，跟着菜单的语言。 -->
                    <span v-if="current.builtin" class="cf-groups-editor-name is-fixed">{{
                      nameOf(current)
                    }}</span>
                    <input
                      v-else
                      v-model="renaming"
                      class="cf-groups-input cf-groups-editor-name"
                      type="text"
                      :maxlength="NAME_LIMIT"
                      @blur="commitName"
                      @keydown.enter="$event.target.blur()"
                    />
                    <div class="cf-groups-swatches" :style="{ '--cf-groups-ring': RING }">
                      <button
                        type="button"
                        class="cf-groups-swatch is-none"
                        :class="{ active: !current.color }"
                        :data-tooltip="t('groupsColorNone')"
                        @click="pickColor('')"
                      ></button>
                      <button
                        v-for="color in PETAL_COLORS"
                        :key="color"
                        type="button"
                        class="cf-groups-swatch"
                        :class="{ active: current.color === color }"
                        :style="{ '--cf-group-color': color }"
                        @click="pickColor(color)"
                      ></button>
                      <!-- 自定义：平时是一圈彩色，选了自定义的颜色、或者正开着滑杆时显示那个颜色。 -->
                      <button
                        type="button"
                        class="cf-groups-swatch is-custom"
                        :class="{ active: isCustom, 'is-set': isCustom || customOpen }"
                        :style="{
                          '--cf-group-color': customOpen
                            ? hueColor
                            : isCustom
                              ? current.color
                              : null,
                        }"
                        :data-tooltip="t('groupsColorCustom')"
                        @click="toggleCustom"
                      ></button>
                    </div>
                    <button
                      v-if="!current.builtin"
                      type="button"
                      class="cf-groups-delete"
                      @click="requestRemoveGroup"
                    >
                      {{ t('groupsDelete') }}
                    </button>
                  </div>
                  <ExpandTransition :show="customOpen">
                    <div class="cf-groups-hue-row" :style="{ '--cf-groups-ring': RING }">
                      <input
                        class="cf-groups-hue"
                        type="range"
                        min="0"
                        :max="PETAL_COLORS.length - HUE_STEP"
                        :step="HUE_STEP"
                        :value="huePosition"
                        :style="{ '--cf-group-color': hueColor }"
                        :aria-label="t('groupsColorCustom')"
                        @input="dragHue"
                        @change="commitHue"
                      />
                    </div>
                  </ExpandTransition>
                  <p class="cf-groups-friends-note" v-if="current.builtin">
                    {{ t('groupsFriendsNote') }}
                  </p>
                  <form class="cf-groups-add-bar" @submit.prevent="submitAdd">
                    <input
                      v-model="adding"
                      class="cf-groups-input"
                      type="text"
                      :placeholder="t('groupsAddPlaceholder')"
                    />
                    <button
                      type="submit"
                      class="cf-aurora-btn"
                      :disabled="working || !adding.trim()"
                    >
                      {{
                        t(
                          current.builtin
                            ? working
                              ? 'groupsWorking'
                              : 'groupsFollow'
                            : 'groupsAdd',
                        )
                      }}
                    </button>
                    <button
                      type="button"
                      class="cf-aurora-btn"
                      :disabled="!checked.length || working"
                      @click="removeChecked"
                    >
                      {{
                        t(
                          current.builtin ? 'groupsUnfollowChecked' : 'groupsRemoveChecked',
                          checked.length,
                        )
                      }}
                    </button>
                  </form>
                  <ExpandTransition :show="Boolean(feedback)">
                    <p class="cf-groups-feedback">{{ feedback }}</p>
                  </ExpandTransition>
                  <div class="cf-groups-table-row is-head">
                    <span></span>
                    <button
                      v-for="column in ['name', 'rating']"
                      :key="column"
                      type="button"
                      class="cf-groups-sort"
                      :class="{
                        active: sortKey === column,
                        'is-down': sortKey === column && sortDown,
                      }"
                      @click="sortBy(column)"
                    >
                      {{ t(column === 'name' ? 'groupsColUser' : 'groupsColRating')
                      }}<i aria-hidden="true"></i>
                    </button>
                    <span>{{ t('groupsColGroups') }}</span
                    ><span>{{ t('groupsColMemo') }}</span
                    ><span></span>
                  </div>
                  <div class="cf-groups-table">
                    <TransitionGroup name="cf-groups-list">
                      <div v-for="row in rows" :key="row.handle" class="cf-groups-table-row">
                        <button
                          type="button"
                          class="cf-groups-check"
                          :class="{ on: checked.includes(row.handle) }"
                          role="checkbox"
                          :aria-checked="checked.includes(row.handle)"
                          @click="toggleChecked(row.handle)"
                        ></button>
                        <MemberName :handle="row.handle" :profile="row.profile" link />
                        <span
                          class="cf-groups-cell-rating"
                          :class="{ 'is-plain': !rankInk(row.profile) }"
                          :style="{ color: rankInk(row.profile) }"
                          ><Transition name="cf-groups-swap"
                            ><span v-if="ratingLabel(row.profile)">{{
                              ratingLabel(row.profile)
                            }}</span></Transition
                          ></span
                        >
                        <span
                          class="cf-groups-tags"
                          @mouseenter="showGroups($event, row)"
                          @mouseleave="tooltip.hide"
                        >
                          <span
                            v-for="group in row.groups.slice(0, row.shown)"
                            :key="group.id"
                            class="cf-groups-chip"
                            :style="{ '--cf-group-color': group.color || null }"
                            >{{ nameOf(group) }}</span
                          >
                          <span v-if="row.groups.length > row.shown" class="cf-groups-chip is-more"
                            >+{{ row.groups.length - row.shown }}</span
                          >
                        </span>
                        <input
                          class="cf-groups-memo"
                          type="text"
                          :value="row.memo"
                          :maxlength="MEMO_LIMIT"
                          :placeholder="t('groupsMemoPlaceholder')"
                          @change="saveMemo(row.handle, $event)"
                          @keydown.enter="$event.target.blur()"
                          @mouseenter="showMemo"
                          @mouseleave="tooltip.hide"
                          @focus="tooltip.hide"
                        />
                        <button
                          type="button"
                          class="cf-groups-remove"
                          :disabled="working"
                          :data-tooltip="
                            t(current.builtin ? 'groupsUnfollowTitle' : 'groupsRemoveOne')
                          "
                          @click="removeOne(row.handle)"
                        >
                          ×
                        </button>
                      </div>
                    </TransitionGroup>
                    <p class="cf-groups-table-empty" v-if="!rows.length">
                      {{ t(current.builtin ? 'groupsNoFriends' : 'groupsNoMembers') }}
                    </p>
                  </div>
                </div>
              </Transition>
              <div class="cf-groups-foot">
                <span>{{ t('groupsFootNote', rows.length) }}</span>
                <button type="button" class="cf-aurora-btn cf-aurora-btn--primary" @click="close">
                  {{ t('groupsDone') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div></DialogTransition
    ></Teleport
  >
</template>
<style>
/* 分组管理弹窗：外壳与配色来自幻彩主题，这里只写本弹窗特有的布局。分组的标记沿用分组页的写法。 */
.cf-clist-modal-card.cf-groups-card {
  width: 840px;
  height: 540px;
  max-height: 88vh;
}
.cf-groups-dialog-body {
  display: grid;
  grid-template-columns: 190px 1fr;
  flex: 1;
  min-height: 0;
  color: var(--cf-aurora-text);
  font-size: var(--cf-font-size-base);
}
/* 左边：分组。 */
.cf-groups-side {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 8px;
  border-right: 1px solid var(--cf-surface-border);
  overflow-y: auto;
}
/* 滚动条：一条细的圆头滑块，没有槽；颜色取弹窗的淡蓝灰，鼠标移上去变粗、加深。
   表头不滚动，但要留出和下面一样宽的位置，所以也在这里。 */
.cf-groups-side::-webkit-scrollbar,
.cf-groups-table::-webkit-scrollbar,
.cf-groups-table-row.is-head::-webkit-scrollbar {
  width: 10px;
}
.cf-groups-side::-webkit-scrollbar-track,
.cf-groups-table::-webkit-scrollbar-track,
.cf-groups-table-row.is-head::-webkit-scrollbar-track {
  background: transparent;
}
.cf-groups-side::-webkit-scrollbar-thumb,
.cf-groups-table::-webkit-scrollbar-thumb {
  min-height: 36px;
  border: 3px solid transparent;
  border-radius: 999px;
  background: #c3cce2 padding-box;
}
.cf-groups-side::-webkit-scrollbar-thumb:hover,
.cf-groups-table::-webkit-scrollbar-thumb:hover {
  border-width: 2px;
  background-color: #a3b0d4;
}
/* 不认上面那种写法的浏览器（火狐）：用标准的细滚动条，同样的颜色。认的浏览器不能写这两项，写了上面的就不生效。 */
@supports not selector(::-webkit-scrollbar) {
  .cf-groups-side,
  .cf-groups-table,
  .cf-groups-table-row.is-head {
    scrollbar-width: thin;
    scrollbar-color: #c3cce2 transparent;
  }
}
.cf-groups-side-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  margin: 0;
  padding: 0 8px;
  border: 0;
  border-radius: var(--cf-radius-md);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background-color var(--cf-duration-fast) ease,
    box-shadow var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease;
}
.cf-groups-side-row:hover {
  background: var(--cf-card-hover);
}
/* 新建时重名的那个分组：标红（输入框的样子在分组页的样式里）。 */
.cf-groups-side-row.has-conflict,
.cf-groups-side-row.has-conflict:hover {
  background: #fff1f2;
  box-shadow: inset 0 0 0 1px #e65b70;
  color: #bd2542;
}
.cf-groups-side-row.active {
  background: var(--cf-control-active);
  color: var(--cf-control-ink);
  font-weight: var(--cf-font-weight-semibold);
}
.cf-groups-side-row.is-add {
  gap: 6px;
  color: var(--cf-control-ink);
}
.cf-groups-side-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cf-groups-side-count {
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
  font-weight: normal;
  font-variant-numeric: tabular-nums;
}
.cf-groups-side-form {
  padding: 4px 0;
}
.cf-groups-side-form .cf-groups-input {
  width: 100%;
}
.cf-groups-side-form.is-rejected {
  animation: cf-groups-shake 0.3s ease;
}
/* 右边：当前分组。 */
.cf-groups-main,
.cf-groups-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.cf-groups-pane {
  flex: 1;
}
.cf-groups-editor,
.cf-groups-add-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px 0;
}
.cf-groups-editor-mark {
  flex: none;
  width: 38px;
  text-align: center;
}
.cf-groups-editor-name {
  flex: 1;
  font-weight: var(--cf-font-weight-semibold);
}
.cf-groups-editor-name.is-fixed {
  padding: 0 8px;
  color: var(--cf-control-ink);
}
.cf-groups-editor .cf-groups-input,
.cf-groups-add-bar .cf-groups-input {
  height: 30px;
}
.cf-groups-swatches {
  display: flex;
  flex: none;
  gap: 4px;
}
.cf-groups-swatch {
  width: 18px;
  height: 18px;
  margin: 0;
  padding: 0;
  border: 2px solid var(--cf-content-surface);
  border-radius: 50%;
  background: var(--cf-group-color);
  box-shadow: 0 0 0 1px var(--cf-surface-border);
  cursor: pointer;
  transition:
    box-shadow var(--cf-duration-fast) ease,
    transform var(--cf-duration-fast) ease;
}
.cf-groups-swatch:hover {
  transform: scale(1.12);
}
.cf-groups-swatch.active {
  box-shadow: 0 0 0 2px var(--cf-control-ink);
}
/* 「自定义」：平时是一圈彩色；定了自定义的颜色、或者正开着滑杆时，换成那个颜色。 */
.cf-groups-swatch.is-custom {
  background: conic-gradient(var(--cf-groups-ring));
}
.cf-groups-swatch.is-custom.is-set {
  background: var(--cf-group-color);
}
/* 自定义颜色的滑杆：一条色环展开成的彩带，滑块是当前选到的颜色。 */
.cf-groups-hue-row {
  padding: 10px 16px 2px;
}
.cf-groups-hue {
  display: block;
  width: 100%;
  height: 10px;
  margin: 0;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--cf-groups-ring));
  outline: none;
  cursor: pointer;
  appearance: none;
}
.cf-groups-hue::-webkit-slider-thumb {
  width: 18px;
  height: 18px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: var(--cf-group-color);
  box-shadow:
    0 0 0 1px var(--cf-surface-border),
    0 1px 4px rgb(0 0 0 / 22%);
  appearance: none;
}
.cf-groups-hue::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: var(--cf-group-color);
  box-shadow:
    0 0 0 1px var(--cf-surface-border),
    0 1px 4px rgb(0 0 0 / 22%);
  box-sizing: border-box;
}
.cf-groups-hue:focus-visible {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--cf-menu-accent) 45%, transparent);
}
/* 「不设颜色」：一个带斜线的空圈。 */
.cf-groups-swatch.is-none {
  background: linear-gradient(
    135deg,
    transparent 45%,
    var(--cf-aurora-muted) 45% 55%,
    transparent 55%
  );
}
.cf-groups-delete {
  flex: none;
  margin: 0;
  padding: 4px 8px;
  border: 0;
  border-radius: var(--cf-radius-sm);
  background: none;
  color: #c74747;
  font: inherit;
  cursor: pointer;
  transition: background-color var(--cf-duration-fast) ease;
}
.cf-groups-delete:hover {
  background: #c7474714;
}
.cf-groups-friends-note,
.cf-groups-feedback {
  margin: 0;
  padding: 8px 16px 0;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
  line-height: 18px;
}
.cf-groups-feedback {
  padding-top: 6px;
}
/* 输入框里没填东西时的提示：比填进去的字浅得多。 */
.cf-groups-card .cf-groups-input::placeholder,
.cf-groups-memo::placeholder {
  color: color-mix(in srgb, var(--cf-aurora-muted) 55%, transparent);
  opacity: 1;
}
/* 用不了的时候（输入框是空的、没勾选人、正在处理）变淡；过渡在主题原有的几项上加一项透明度。 */
.cf-groups-add-bar .cf-aurora-btn {
  flex: none;
  padding: 5px 12px;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    filter 160ms ease,
    opacity 160ms ease;
}
.cf-groups-add-bar .cf-aurora-btn:disabled,
.cf-groups-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
/* 成员表：表头固定在上面，下面的行自己滚动。两边都给滚动条留出一样宽的位置，各列才对得齐。 */
.cf-groups-table {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}
.cf-groups-table-row {
  display: grid;
  grid-template-columns: 18px 170px 60px minmax(0, 1fr) 160px 18px;
  align-items: center;
  gap: 10px;
  height: max(38px, calc(var(--cf-avatar-px, 21px) * var(--cf-font-scale, 1) + 14px));
  padding: 0 16px;
  border-bottom: 1px solid var(--cf-surface-border);
  box-sizing: border-box;
}
.cf-groups-table-row.is-head {
  flex: none;
  height: 28px;
  margin-top: 10px;
  border-top: 1px solid var(--cf-surface-border);
  background: color-mix(in srgb, var(--cf-menu-accent) 7%, transparent);
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
  overflow: hidden;
  scrollbar-gutter: stable;
}
/* 能点着排序的表头：当前按它排的那个颜色深一些，后面带一个小三角，朝上是从小到大。 */
.cf-groups-sort {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 4px;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: color var(--cf-duration-fast) ease;
}
.cf-groups-sort:hover,
.cf-groups-sort.active {
  color: var(--cf-control-ink);
}
.cf-groups-sort i {
  border: 4px solid transparent;
  border-top-width: 0;
  border-bottom: 5px solid currentColor;
  opacity: 0;
  transition:
    opacity var(--cf-duration-fast) ease,
    transform var(--cf-duration-base) ease;
}
.cf-groups-sort:hover i {
  opacity: 0.4;
}
.cf-groups-sort.active i {
  opacity: 1;
}
.cf-groups-sort.is-down i {
  transform: rotate(180deg);
}
/* 换先后时滑到新位置；加进来的行从零高度展开，移出去的收起，下面的行跟着补上来。 */
.cf-groups-list-move {
  transition: transform var(--cf-duration-moderate) var(--cf-ease-out);
}
.cf-groups-list-enter-active,
.cf-groups-list-leave-active {
  overflow: hidden;
  transition:
    height var(--cf-duration-base) ease,
    opacity var(--cf-duration-base) ease,
    border-color var(--cf-duration-base) ease;
}
.cf-groups-list-enter-from,
.cf-groups-list-leave-to {
  height: 0;
  border-color: transparent;
  opacity: 0;
}
.cf-groups-table .cf-groups-who {
  color: var(--cf-control-ink);
}
.cf-groups-cell-rating {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.cf-groups-cell-rating.is-plain {
  color: var(--cf-aurora-muted);
  font-weight: normal;
}
.cf-groups-check {
  width: 16px;
  height: 16px;
  margin: 0;
  padding: 0;
  border: 2px solid var(--cf-surface-border);
  border-radius: var(--cf-radius-xs);
  background: var(--cf-content-surface);
  cursor: pointer;
  transition:
    background-color var(--cf-duration-fast) ease,
    border-color var(--cf-duration-fast) ease;
}
.cf-groups-check.on {
  border-color: var(--cf-menu-accent);
  background:
    linear-gradient(-45deg, transparent 42%, #fff 42% 58%, transparent 58%) 3px 1px / 8px 8px
      no-repeat,
    var(--cf-menu-accent);
}
.cf-groups-tags {
  display: flex;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}
/* 分组的小标签：用分组的颜色，没设颜色的用弹窗的主色。 */
.cf-groups-chip {
  --cf-group-tone: var(--cf-group-color, var(--cf-menu-accent));
  flex: 0 1 auto;
  min-width: 0;
  padding: 0 6px;
  border: 1px solid color-mix(in srgb, var(--cf-group-tone) 50%, #fff);
  border-radius: var(--cf-radius-xs);
  background: color-mix(in srgb, var(--cf-group-tone) 16%, #fff);
  color: color-mix(in srgb, var(--cf-group-tone) 70%, var(--cf-gray-800));
  font-size: var(--cf-font-size-xs);
  line-height: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 放不下的那几个分组收成的「+N」：不能看着像一个名叫「+3」的分组，所以不用分组标签的样子——
   没有底色，一圈虚线，两头是圆的，字是浅色的数字。也不被挤窄。 */
.cf-groups-chip.is-more {
  flex: none;
  padding: 0 5px;
  border: 1px dashed color-mix(in srgb, var(--cf-aurora-muted) 60%, transparent);
  border-radius: 999px;
  background: none;
  color: var(--cf-aurora-muted);
  font-variant-numeric: tabular-nums;
  line-height: 16px;
}
.cf-groups-memo {
  min-width: 0;
  height: 26px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: var(--cf-radius-sm);
  background: none;
  color: var(--cf-aurora-text);
  font: inherit;
  text-overflow: ellipsis;
  outline: none;
  transition:
    border-color var(--cf-duration-fast) ease,
    background-color var(--cf-duration-fast) ease;
}
.cf-groups-memo:hover {
  border-color: var(--cf-surface-border);
}
.cf-groups-memo:focus {
  border-color: var(--cf-menu-accent);
  background: var(--cf-content-surface);
}
.cf-groups-remove {
  width: 18px;
  height: 18px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--cf-aurora-muted);
  font: inherit;
  line-height: 16px;
  cursor: pointer;
  transition:
    background-color var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease;
}
.cf-groups-remove:hover {
  background: #c7474714;
  color: #c74747;
}
.cf-groups-table-empty {
  margin: 0;
  padding: 28px 16px;
  color: var(--cf-aurora-muted);
  text-align: center;
}
.cf-groups-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 16px 12px;
  border-top: 1px solid var(--cf-surface-border);
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
}
@media (prefers-reduced-motion: reduce) {
  .cf-groups-side-form.is-rejected {
    animation: none;
  }
  .cf-groups-list-move,
  .cf-groups-list-enter-active,
  .cf-groups-list-leave-active {
    transition: none;
  }
}
</style>
