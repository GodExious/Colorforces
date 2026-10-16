<script setup>
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { appSettings, saveSettings } from '../../../settings.js';
import { translate as t } from '../../../i18n/index.js';
import * as assets from '../../../assets/index.js';
import { toggleFromRow } from '../../../utils/row-toggle.js';
import InlineSvg from '../../components/icons/InlineSvg/InlineSvg.vue';
import ToggleSwitch from '../../components/forms/ToggleSwitch/ToggleSwitch.vue';
import ActionButton from '../../components/forms/ActionButton/ActionButton.vue';
import SegmentedSwitch from '../../components/forms/SegmentedSwitch/SegmentedSwitch.vue';
import ExpandTransition from '../../components/transitions/ExpandTransition/ExpandTransition.vue';
import SettingNote from '../../components/settings/SettingNote/SettingNote.vue';
import InfoHint from '../../components/tooltips/InfoHint/InfoHint.vue';
import { tooltip } from '../../components/tooltips/FloatingTooltip/FloatingTooltip.vue';
import {
  readAccount,
  changeAccount,
  subscribeGroups,
  syncFriends,
  refreshMembers,
} from '../../../features/user/groups/data.js';
import {
  profileOf,
  requestProfiles,
  subscribeProfiles,
} from '../../../features/user/groups/profiles.js';
import {
  FRIENDS_GROUP,
  NAME_LIMIT,
  addGroup,
  groupNamed,
  listGroups,
  membersOf,
  moveGroup,
} from '../../../features/user/groups/store.js';
import { arrangeGroups, stepOrder } from '../../../features/user/groups/reorder.js';
import { KNOWN_FRAMES } from '../../../features/user/frames/catalog.js';
import AvatarFrame from '../../components/avatars/AvatarFrame/AvatarFrame.vue';
import { showFrameDialog } from '../user/components/FrameDialog/FrameDialog.vue';
import { showGroupsDialog } from './components/GroupsDialog/GroupsDialog.vue';
import GroupMark from './components/GroupMark/GroupMark.vue';
import MemberName, {
  compareByRating,
  rankInk,
  ratingLabel,
} from './components/MemberName/MemberName.vue';
import { keepWithinLimit } from '../../../utils/input-limit.js';
// active：这一页正显示着。owner：登录着的账号，没登录时是空的。
const props = defineProps({ active: Boolean, owner: String });

// 这个账号的分组。还没建过、也没同步过好友时是 null，按一份空的来显示。
const account = shallowRef(null);
function reload() {
  account.value = readAccount(props.owner);
  // 这一页正显示着时顺带读成员和自己的资料（评分、头像）；缓存里都有的话不会发请求。
  if (props.active && appSettings.groups.enabled) {
    refreshMembers(props.owner);
    if (props.owner) requestProfiles([props.owner]).catch(() => {});
  }
}
// 正拖着调整先后时，自建分组眼下的先后（一串 id）；没在拖时是 null。见下面「拖动调整先后」。
const dragOrder = ref(null);
const groups = computed(() => {
  if (!account.value) return [{ id: FRIENDS_GROUP, builtin: true, frame: '', count: 0 }];
  const list = listGroups(account.value);
  return dragOrder.value ? arrangeGroups(list, dragOrder.value) : list;
});
const nameOf = (group) => (group.builtin ? t('groupsFriends') : group.name);
// 成员的资料读到了新的时加一，下面按它重新取。
const profilesSeen = ref(0);
const ownerProfile = computed(() =>
  profilesSeen.value >= 0 && props.owner ? profileOf(props.owner) : null,
);
// 展开一个分组时只列评分最高的这么多个人，其余的收成一个「+N」，到管理弹窗里看全部。
const MEMBERS_SHOWN = 10;
// 一个分组的成员，评分高的在前；每一项带着读到的资料。
function members(group) {
  if (!account.value || profilesSeen.value < 0) return [];
  return membersOf(account.value, group.id)
    .map((handle) => ({ handle, profile: profileOf(handle) }))
    .sort((a, b) => compareByRating(a, b))
    .slice(0, MEMBERS_SHOWN);
}

// 列表里的行、展开的成员换了先后时会滑到新位置。这个效果要先记下它们原来在哪；这一页没显示着、或者成员区还收着时，
// 记到的位置都是零，一显示出来就成了「所有东西从左上角飞过来」。所以只在已经显示稳了之后才开这个效果：
// steady 是这一页显示稳了，flowing 是成员区已经展开稳了的那些分组。
const SETTLED = 360;
const steady = ref(false),
  flowing = ref([]);
let steadyTimer;
const flowTimers = new Map();
watch(
  // 总开关关着时下面的内容也是收着的，和这一页没显示着一样。
  () => props.active && appSettings.groups.enabled,
  (shown) => {
    clearTimeout(steadyTimer);
    steady.value = false;
    if (shown) steadyTimer = setTimeout(() => (steady.value = true), SETTLED);
  },
  { immediate: true },
);

// 点一行展开或收起它的成员；可以同时展开好几个（展开一个就收起别的，下面的行会从鼠标底下跑掉）。
const opened = ref([]);
function toggle(id) {
  clearTimeout(flowTimers.get(id));
  flowing.value = flowing.value.filter((item) => item !== id);
  if (opened.value.includes(id)) {
    opened.value = opened.value.filter((item) => item !== id);
    return;
  }
  opened.value = [...opened.value, id];
  flowTimers.set(
    id,
    setTimeout(() => (flowing.value = [...flowing.value, id]), SETTLED),
  );
}

// 分组的头像框：一行右边的小格子显示它，点了打开头像框库，「给谁戴」选好这个分组。
// 这个分组的成员戴它，一个人在好几个分组里时按分组的先后取第一个设了的，最后才是段位头像框（见 choose.js）。
// 不认识的（比如导入的头像框后来删了）当作没设。
const frameOfGroup = (group) => (KNOWN_FRAMES.has(group.frame) ? group.frame : '');
// 头像框关着（关了头像也算）时，小格子灰掉、点不了。
const framesOn = computed(() => appSettings.user.avatar.enabled && appSettings.user.avatar.frames);

// 新建分组：点「新建分组」换成一个输入框，回车建好，名字是空的或重名时输入框晃一下。
const creating = ref(false),
  draft = ref(''),
  rejected = ref(false),
  nameInput = ref(null);
function startCreate() {
  creating.value = true;
  draft.value = '';
  nextTick(() => nameInput.value?.focus());
}
// 新建时和哪个分组重名了（它的 id）：输入框和那个分组都标红，名字一改就消掉。
const conflict = ref(''),
  listHost = ref(null);
watch(draft, () => (conflict.value = ''));
function cancelCreate() {
  creating.value = false;
  rejected.value = false;
  conflict.value = '';
}
function submitCreate() {
  const id = changeAccount(props.owner, (own) => addGroup(own, { name: draft.value }) || false);
  if (id) {
    cancelCreate();
    return;
  }
  conflict.value = account.value ? groupNamed(account.value, draft.value) : '';
  if (conflict.value)
    nextTick(() =>
      listHost.value
        ?.querySelector('.cf-groups-row.has-conflict')
        ?.scrollIntoView({ block: 'nearest' }),
    );
  // 先去掉再加上，连着两次被拒时动画才会重新播。
  rejected.value = false;
  requestAnimationFrame(() => (rejected.value = true));
}

// 拖动调整先后：按住一行左边的把手，这一行自己跟着鼠标上下走，别的行给它让位。「好友」不参与。
// 没用浏览器自带的拖放：那种拖法会拖出一个半透明的副本，原处还留着一份，看着是重影。
// 做法：被拖的那一行分两层——外面一层是它在列表里占的位置，里面一层（entry-body）是看得见的内容。
// 拖的时候位置照常跟着先后变（别的行靠列表自带的「换位置时滑过去」让开），内容那一层用位移贴在鼠标上。
// 拖的过程中只在这一页里记先后（dragOrder），松手才存一次：每换一下就存的话，存储、别的标签页、页面上的标签都要跟着动一遍。
const dragging = ref('');
// 正在拖的这一次：{ id, entry 位置那一层, body 内容那一层, grab 按下的地方离这一行顶边多远, height 这一行多高, y 鼠标最近的纵坐标 }
let drag = null;
// 把内容那一层摆到鼠标的位置上（不出列表的上下边），返回它上下两条边的纵坐标。
function placeBody() {
  const { entry, body, grab, height, y } = drag;
  const rows = entry.parentElement;
  // 最上面不超过「好友」那一行的下边，最下面不超过列表的下边。
  const floor = rows.firstElementChild.getBoundingClientRect().bottom;
  const ceiling = rows.getBoundingClientRect().bottom - height;
  const top = Math.min(Math.max(y - grab, floor), Math.max(floor, ceiling));
  body.style.transform = `translateY(${Math.round(top - entry.getBoundingClientRect().top)}px)`;
  return { top, bottom: top + height };
}
// 拖的过程中盖在整个窗口上的一层透明的挡板：鼠标的移动都落在它上面，别的东西不会跟着出悬停的高亮、弹提示，
// 鼠标的样子也一直是「抓着」。
let shield = null;
function raiseShield() {
  shield = document.createElement('div');
  shield.id = 'cf-groups-drag-shield';
  document.body.appendChild(shield);
}
function startDrag(event, group) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const entry = event.currentTarget.closest('.cf-groups-entry');
  const body = entry?.querySelector('.cf-groups-entry-body');
  if (!body || drag) return;
  // 不让浏览器当成选字或者拖图片。
  event.preventDefault();
  // 把手上的提示收掉：拖的时候它不会自己消失。
  tooltip.hide();
  const box = entry.getBoundingClientRect();
  drag = { id: group.id, entry, body, grab: event.clientY - box.top, height: box.height };
  dragging.value = group.id;
  dragOrder.value = groups.value.filter((item) => !item.builtin).map((item) => item.id);
  raiseShield();
  window.addEventListener('pointermove', moveDrag);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
}
function moveDrag(event) {
  if (!drag) return;
  drag.y = event.clientY;
  const { top, bottom } = placeBody();
  const order = dragOrder.value;
  const rows = drag.entry.parentElement;
  const rowsTop = rows.getBoundingClientRect().top;
  // 相邻那一行的中线，按它在列表里排好的位置算，不看它正滑到哪了：滑动只是个过程，按半路上的位置比会来回换。
  const middleOf = (id) => {
    const row = rows.querySelector(`[data-group="${CSS.escape(id)}"]`);
    return row ? rowsTop + row.offsetTop + row.offsetHeight / 2 : NaN;
  };
  // 要不要和相邻的一行换位，规则在 reorder.js 里（有测试）。一次只换一格，拖得快时下一次移动接着换。
  const next = stepOrder(order, drag.id, top, bottom, middleOf);
  if (next === order) return;
  dragOrder.value = next;
  // 位置那一层挪到了新的一格，内容那一层的位移要按新的位置重算，才还贴在鼠标上。
  nextTick(() => drag && placeBody());
}
// 松手：内容滑回它现在占的那一格，然后把先后存一次。存好之后列表的先后已经是这样了，再撤掉拖动时的那一份，不会跳。
function endDrag() {
  if (!drag) return;
  const { id, body } = drag;
  const order = dragOrder.value;
  drag = null;
  window.removeEventListener('pointermove', moveDrag);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('pointercancel', endDrag);
  shield?.remove();
  shield = null;
  const settle = () => {
    body.style.transition = '';
    if (dragging.value === id) dragging.value = '';
  };
  body.style.transition = 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)';
  body.style.transform = '';
  body.addEventListener('transitionend', settle, { once: true });
  setTimeout(settle, 260);
  if (order?.includes(id))
    changeAccount(props.owner, (own) => moveGroup(own, id, order.indexOf(id)));
  dragOrder.value = null;
}

// 标签的样子：写分组名，或者只画小标。
function chooseTagStyle(value) {
  appSettings.groups.tagStyle = value;
  saveSettings();
}
// 右键菜单的名片：纵向、横向。下次打开右键菜单时换成新的样子。
function chooseMenuCard(value) {
  appSettings.groups.menuCard = value;
  saveSettings();
}

// 同步好友：按钮在请求时转圈，结束后短暂显示结果。
const syncing = ref(false),
  syncResult = ref(null);
let syncTimer;
async function startSync() {
  if (syncing.value) return;
  syncing.value = true;
  syncResult.value = null;
  const result = await syncFriends({ manual: true });
  syncing.value = false;
  syncResult.value = result;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => (syncResult.value = null), 4000);
}
const syncLabel = computed(() => {
  if (syncing.value) return t('groupsSyncing');
  const result = syncResult.value;
  if (!result) return t('groupsSyncFriends');
  if (result.ok) return t('groupsSyncDone', result.count);
  return t(result.reason === 'signed-out' ? 'groupsSyncSignedOut' : 'groupsSyncFailed');
});
const syncStatus = computed(() => {
  if (!syncResult.value) return 'idle';
  return syncResult.value.ok ? 'latest' : 'failed';
});

let stop, stopProfiles;
onMounted(() => {
  stop = subscribeGroups(reload);
  stopProfiles = subscribeProfiles(() => profilesSeen.value++);
});
onBeforeUnmount(() => {
  stop?.();
  stopProfiles?.();
  clearTimeout(syncTimer);
  clearTimeout(steadyTimer);
  flowTimers.forEach((timer) => clearTimeout(timer));
  endDrag();
});
// 这一页打开时、换了账号时、总开关打开时重新读一遍。
watch(
  () => [props.active, props.owner, appSettings.groups.enabled],
  ([active]) => {
    if (active) reload();
  },
  { immediate: true },
);
</script>
<template>
  <div class="cf-tab-panel">
    <section class="cf-groups-settings">
      <div class="cf-setting-item" @click="toggleFromRow">
        <span class="cf-setting-label"
          ><label for="cf-groups-control-enabled">{{ t('groupsEnable') }}</label></span
        >
        <ToggleSwitch
          as="label"
          input-id="cf-groups-control-enabled"
          v-model="appSettings.groups.enabled"
          data-control="groupsEnabled"
          @change="saveSettings()"
        />
      </div>
      <ExpandTransition :show="appSettings.groups.enabled">
        <div class="cf-groups-body">
          <SettingNote class="cf-groups-tip" :label="t('groupsTipLabel')" :text="t('groupsTip')" />
          <div class="cf-setting-item">
            <span class="cf-setting-sublabel">{{ t('groupsMenuCard') }}</span>
            <SegmentedSwitch
              style="width: 120px"
              :model-value="appSettings.groups.menuCard"
              :options="[
                { value: 'vertical', label: t('groupsMenuCardVertical') },
                { value: 'horizontal', label: t('groupsMenuCardHorizontal') },
              ]"
              @update:model-value="chooseMenuCard"
            />
          </div>
          <div class="cf-setting-item" @click="toggleFromRow">
            <span class="cf-setting-sublabel"
              ><label for="cf-groups-control-tags">{{ t('groupsShowTags') }}</label
              ><InfoHint :text="t('groupsShowTagsHint')"
            /></span>
            <ToggleSwitch
              as="label"
              input-id="cf-groups-control-tags"
              v-model="appSettings.groups.showTags"
              data-control="groupsShowTags"
              @change="saveSettings()"
            />
          </div>
          <ExpandTransition :show="appSettings.groups.showTags">
            <div class="cf-nested-options">
              <div class="cf-setting-item">
                <span class="cf-setting-sublabel">{{ t('groupsTagStyle') }}</span>
                <SegmentedSwitch
                  style="width: 120px"
                  :model-value="appSettings.groups.tagStyle"
                  :options="[
                    { value: 'name', label: t('groupsTagStyleName') },
                    { value: 'mark', label: t('groupsTagStyleMark') },
                  ]"
                  @update:model-value="chooseTagStyle"
                />
              </div>
            </div>
          </ExpandTransition>
          <div class="cf-groups-list" ref="listHost">
            <div class="cf-groups-head">
              <!-- 自己的名字照原站的写法：段位的颜色，跟着「显示用户头像」带头像。 -->
              <span class="cf-groups-owner"
                ><MemberName :handle="owner" :profile="ownerProfile" /><span>{{
                  t('groupsOwnerSuffix')
                }}</span></span
              >
              <span>{{ t('groupsCount', groups.length) }}</span>
            </div>
            <TransitionGroup
              name="cf-groups-move"
              :move-class="steady ? 'cf-groups-move-move' : 'cf-groups-still'"
              tag="div"
              class="cf-groups-rows"
            >
              <div
                v-for="group in groups"
                :key="group.id"
                class="cf-groups-entry"
                :class="{ 'is-dragging': dragging === group.id }"
                :data-group="group.id"
              >
                <!-- 外面这层是这一行在列表里占的位置，里面这层是看得见的内容；拖的时候挪的是里面这层。 -->
                <div class="cf-groups-entry-body">
                  <div
                    class="cf-groups-row"
                    :class="{
                      'is-open': opened.includes(group.id),
                      'has-conflict': conflict === group.id,
                    }"
                    role="button"
                    tabindex="0"
                    :aria-expanded="opened.includes(group.id)"
                    @click="toggle(group.id)"
                    @keydown.enter.prevent="toggle(group.id)"
                    @keydown.space.prevent="toggle(group.id)"
                  >
                    <span
                      v-if="group.builtin"
                      class="cf-groups-grip is-pinned"
                      :data-tooltip="t('groupsPinnedHint')"
                      ><svg viewBox="0 0 12 12" aria-hidden="true">
                        <path d="M4.2 1.3h3.6l-.5 3 1.8 2.3H2.9l1.8-2.3z" />
                        <path d="M6 6.6v4.2" /></svg
                    ></span>
                    <span
                      v-else
                      class="cf-groups-grip"
                      :data-tooltip="t('groupsDragHint')"
                      @pointerdown="startDrag($event, group)"
                      @click.stop
                      ><i></i><i></i><i></i><i></i><i></i><i></i
                    ></span>
                    <GroupMark :group="group" />
                    <span class="cf-groups-name">{{ nameOf(group) }}</span>
                    <span v-if="group.builtin" class="cf-groups-tag">{{ t('groupsSynced') }}</span>
                    <span class="cf-groups-meta">{{ t('groupsMemberCount', group.count) }}</span>
                    <!-- 这个分组的头像框：点一下打开头像框库。换了的时候旧的淡出，新的淡入。头像框关着时灰掉。 -->
                    <button
                      type="button"
                      class="cf-groups-frame-chip cf-frame-host"
                      :disabled="!framesOn"
                      :data-tooltip="t(framesOn ? 'groupsFrameChip' : 'groupsFrameChipOff')"
                      @click.stop="showFrameDialog(group.id)"
                      @keydown.enter.stop
                      @keydown.space.stop
                    >
                      <Transition name="cf-groups-swap" mode="out-in">
                        <span
                          v-if="frameOfGroup(group)"
                          :key="frameOfGroup(group)"
                          class="cf-groups-frame-face"
                          ><AvatarFrame :frame="frameOfGroup(group)"
                        /></span>
                        <span v-else key=":none" class="cf-groups-frame-empty"></span>
                      </Transition>
                    </button>
                    <span class="cf-groups-chevron" aria-hidden="true"></span>
                  </div>
                  <ExpandTransition :show="opened.includes(group.id)">
                    <!-- 账号名里没有冒号，下面几个固定的项用冒号开头的 key，不会和成员撞上。 -->
                    <TransitionGroup
                      name="cf-groups-member-list"
                      :move-class="
                        steady && flowing.includes(group.id)
                          ? 'cf-groups-member-list-move'
                          : 'cf-groups-still'
                      "
                      tag="div"
                      class="cf-groups-members"
                    >
                      <span
                        v-for="(member, index) in members(group)"
                        :key="member.handle"
                        class="cf-groups-member"
                        :style="{ '--cf-member-order': Math.min(index, 16) }"
                      >
                        <MemberName :handle="member.handle" :profile="member.profile" />
                        <Transition name="cf-groups-swap">
                          <small
                            v-if="ratingLabel(member.profile)"
                            class="cf-groups-rating"
                            :class="{ 'is-plain': !rankInk(member.profile) }"
                            :style="{ color: rankInk(member.profile) }"
                            >{{ ratingLabel(member.profile) }}</small
                          >
                        </Transition>
                      </span>
                      <button
                        v-if="group.count > MEMBERS_SHOWN"
                        key=":more"
                        type="button"
                        class="cf-groups-member is-more"
                        :data-tooltip="t('groupsMoreMembers', group.count - MEMBERS_SHOWN)"
                        @click="showGroupsDialog(group.id)"
                      >
                        +{{ group.count - MEMBERS_SHOWN }}
                      </button>
                      <span v-if="!group.count" key=":empty" class="cf-groups-empty">{{
                        t(group.builtin ? 'groupsNoFriends' : 'groupsNoMembers')
                      }}</span>
                      <!-- 成员排完之后另起一行，靠右一个文字链接打开管理弹窗（成员戴着头像框时胶囊变高，做成胶囊会被撑成大块）。 -->
                      <div key=":manage" class="cf-groups-members-foot">
                        <button
                          type="button"
                          class="cf-groups-manage-link"
                          @click="showGroupsDialog(group.id)"
                        >
                          {{ t('groupsManageMembers') }}<i aria-hidden="true"></i>
                        </button>
                      </div>
                    </TransitionGroup>
                  </ExpandTransition>
                </div>
              </div>
            </TransitionGroup>
            <div class="cf-groups-create">
              <Transition name="cf-groups-swap" mode="out-in">
                <form
                  v-if="creating"
                  class="cf-groups-create-form"
                  :class="{ 'is-rejected': rejected }"
                  @submit.prevent="submitCreate"
                  @animationend="rejected = false"
                >
                  <input
                    ref="nameInput"
                    v-model="draft"
                    class="cf-groups-input"
                    :class="{ 'has-conflict': conflict }"
                    type="text"
                    :maxlength="NAME_LIMIT"
                    @beforeinput="keepWithinLimit"
                    :placeholder="t('groupsNamePlaceholder')"
                    @keydown.esc.stop="cancelCreate"
                  />
                  <button
                    type="submit"
                    class="cf-groups-text-btn is-primary"
                    :disabled="!draft.trim()"
                  >
                    {{ t('groupsCreateConfirm') }}
                  </button>
                  <button type="button" class="cf-groups-text-btn" @click="cancelCreate">
                    {{ t('popCancelBtn') }}
                  </button>
                </form>
                <button v-else type="button" class="cf-groups-add" @click="startCreate">
                  <span aria-hidden="true">+</span>{{ t('groupsCreate') }}
                </button>
              </Transition>
            </div>
          </div>
          <div class="cf-groups-actions">
            <ActionButton @click="showGroupsDialog()">{{ t('groupsManageMembers') }}</ActionButton>
            <ActionButton :busy="syncing" :status="syncStatus" @click="startSync">
              <InlineSvg :source="assets.syncIcon" /><span>{{ syncLabel }}</span>
            </ActionButton>
          </div>
        </div>
      </ExpandTransition>
    </section>
  </div>
</template>
<style>
/* 选项的文字和它后面的说明图标排在一条线上、上下居中（别的设置页也是这么排的）。 */
.cf-groups-settings .cf-setting-label,
.cf-groups-settings .cf-setting-sublabel {
  display: inline-flex;
  align-items: center;
}
/* 总开关下面的内容：离总开关 12px，各块之间 10px。 */
.cf-groups-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 0 0 12px;
}
/* 提示和下面的分组列表之间按这一块的间隔排，不再另留上边距。 */
.cf-groups-tip {
  margin-top: 0;
}
/* 分组列表：一张卡片，一行一个分组。 */
/* 和上面的设置项隔开一点（在这一块的 10px 间隔之外再多 6px）。 */
.cf-groups-list {
  margin-top: 6px;
  border: 1px solid var(--cf-surface-border);
  border-radius: var(--cf-radius-lg);
  background: var(--cf-card-surface);
  overflow: hidden;
}
/* 上下留出边距：头像开大时也不贴着上下两条边。
   这一行是整张列表的表头：垫一层和鼠标停在分组上时一样的主题色，下面的线比分组之间的重一点。 */
.cf-groups-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 30px;
  padding: 6px 10px;
  box-sizing: border-box;
  border-bottom: 1px solid color-mix(in srgb, var(--cf-menu-accent) 30%, var(--cf-surface-border));
  background: color-mix(in srgb, var(--cf-menu-accent) 9%, transparent);
  color: var(--cf-gray-500);
  font-size: var(--cf-font-size-xs);
}
/* 表头下面已经有一道线，第一个分组上面的那道不要。 */
.cf-groups-head + .cf-groups-rows > .cf-groups-entry:first-child {
  border-top: 0;
}
.cf-groups-owner {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}
/* 「的分组」前面那个空格要留着（中文的名字和「的分组」之间隔开；英文的「’s groups」本来就紧贴着名字）。 */
.cf-groups-owner > span:last-child {
  white-space: pre;
}
.cf-groups-entry {
  border-top: 1px solid var(--cf-surface-border);
}
/* 正在拖的那一行：它占的位置跟着先后一格一格地换，不带滑动（滑的话内容会跟着晃）；
   内容那一层浮起来一点，贴在鼠标上。 */
.cf-groups-entry.is-dragging {
  position: relative;
  z-index: 2;
  transition: none !important;
}
.cf-groups-entry-body {
  border-radius: var(--cf-radius-md);
  transition:
    box-shadow var(--cf-duration-fast) ease,
    background-color var(--cf-duration-fast) ease;
}
.cf-groups-entry.is-dragging .cf-groups-entry-body {
  background: var(--cf-content-surface);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--cf-menu-accent) 34%, var(--cf-surface-border)),
    0 8px 20px -8px color-mix(in srgb, var(--cf-menu-accent) 55%, transparent);
}
.cf-groups-entry.is-dragging .cf-groups-grip {
  cursor: grabbing;
}
/* 拖的过程中盖住整个窗口的透明挡板，见脚本里的 raiseShield。 */
#cf-groups-drag-shield {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  cursor: grabbing;
}
/* 调整先后时，被挤开的行滑到新位置；新建的分组淡入，删掉的淡出、下面的行滑上来补位。 */
.cf-groups-rows {
  position: relative;
}
.cf-groups-move-move {
  transition: transform var(--cf-duration-moderate) var(--cf-ease-out);
}
.cf-groups-move-enter-active,
.cf-groups-move-leave-active {
  transition:
    opacity var(--cf-duration-base) ease,
    transform var(--cf-duration-moderate) var(--cf-ease-out);
}
/* 新出现的行从下面一点的位置浮上来。 */
.cf-groups-move-enter-from {
  transform: translateY(6px);
}
.cf-groups-move-leave-active {
  position: absolute;
  width: 100%;
}
.cf-groups-move-enter-from,
.cf-groups-move-leave-to {
  opacity: 0;
}
.cf-groups-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 10px 0 6px;
  cursor: pointer;
  user-select: none;
  transition:
    background-color var(--cf-duration-fast) ease,
    box-shadow var(--cf-duration-fast) ease;
}
.cf-groups-row:hover {
  background: color-mix(in srgb, var(--cf-menu-accent) 9%, transparent);
}
/* 新建时和已有的分组重名：输入框和那个分组都标红，和快捷键冲突时一个样子。 */
.cf-groups-row.has-conflict,
.cf-groups-row.has-conflict:hover {
  background: #fff1f2;
  box-shadow: inset 0 0 0 1px #e65b70;
}
.cf-groups-input.has-conflict,
.cf-groups-input.has-conflict:hover,
.cf-groups-input.has-conflict:focus {
  border-color: #e65b70;
  background: #fff1f2;
  box-shadow: 0 0 0 3px #e65b7026;
  color: #bd2542;
}
.cf-groups-row:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--cf-menu-accent) 40%, transparent);
  outline-offset: -2px;
}
/* 拖动的把手：六个点。「好友」固定在最前，这个位置上是一枚图钉。 */
.cf-groups-grip {
  display: grid;
  grid-template-columns: 3px 3px;
  gap: 2px;
  flex: none;
  width: 8px;
  padding: 6px 2px;
  cursor: grab;
  /* 触屏上按住把手是拖这一行，不是滚动页面。 */
  touch-action: none;
}
.cf-groups-grip i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--cf-gray-300);
  transition: background-color var(--cf-duration-fast) ease;
}
.cf-groups-grip:hover i {
  background: var(--cf-gray-500);
}
.cf-groups-grip.is-pinned {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  padding: 0;
  cursor: default;
}
.cf-groups-grip.is-pinned svg {
  display: block;
  width: 12px;
  height: 12px;
  fill: var(--cf-gray-400);
  stroke: var(--cf-gray-400);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.2;
}
.cf-groups-name {
  min-width: 0;
  overflow: hidden;
  color: var(--cf-gray-700);
  font-size: var(--cf-font-size-lg);
  font-weight: var(--cf-font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cf-groups-tag {
  flex: none;
  padding: 0 6px;
  border-radius: var(--cf-radius-xs);
  background: color-mix(in srgb, var(--cf-menu-accent) 14%, transparent);
  color: var(--cf-control-ink);
  font-size: var(--cf-font-size-2xs);
  line-height: 16px;
}
.cf-groups-meta {
  flex: none;
  margin-left: auto;
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-xs);
  font-variant-numeric: tabular-nums;
}
/* 箭头：收起时朝右，展开时转向下。 */
.cf-groups-chevron {
  flex: none;
  width: 6px;
  height: 6px;
  margin: 0 4px 0 2px;
  border-right: 2px solid var(--cf-gray-400);
  border-bottom: 2px solid var(--cf-gray-400);
  transform: rotate(-45deg);
  transition: transform var(--cf-duration-base) ease;
}
.cf-groups-row.is-open .cf-groups-chevron {
  transform: rotate(45deg);
}
/* 分组的头像框：箭头前面一个可以点的小格子，设了的显示那个头像框（套在一个灰色的小圆上），没设的是一个虚线圆。 */
.cf-groups-frame-chip {
  display: grid;
  flex: none;
  place-items: center;
  width: 40px;
  height: 34px;
  margin: 0;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--cf-radius-md);
  background: none;
  cursor: pointer;
  transition:
    border-color var(--cf-duration-fast) ease,
    background-color var(--cf-duration-fast) ease,
    opacity var(--cf-duration-fast) ease;
}
.cf-groups-frame-chip:hover {
  border-color: color-mix(in srgb, var(--cf-menu-accent) 55%, var(--cf-surface-border));
  background: var(--cf-control-active);
}
/* 头像框关着：灰掉，悬停不变。 */
.cf-groups-frame-chip:disabled,
.cf-groups-frame-chip:disabled:hover {
  border-color: transparent;
  background: none;
  opacity: 0.45;
  cursor: not-allowed;
}
.cf-groups-frame-chip:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--cf-menu-accent) 40%, transparent);
  outline-offset: -2px;
}
.cf-groups-frame-face {
  position: relative;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--cf-gray-200);
}
.cf-groups-frame-empty {
  width: 20px;
  height: 20px;
  border: 1px dashed var(--cf-gray-300);
  border-radius: 50%;
  box-sizing: border-box;
}
/* 一行下面展开的成员。 */
.cf-groups-members {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 10px 10px;
  background: color-mix(in srgb, var(--cf-menu-accent) 5%, transparent);
}
.cf-groups-member {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-height: 24px;
  margin: 0;
  padding: 2px 9px;
  border: 1px solid var(--cf-surface-border);
  border-radius: 999px;
  background: var(--cf-content-surface);
  color: var(--cf-gray-700);
  font: inherit;
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-semibold);
  line-height: 22px;
}
/* 头像贴着左边的圆角；收起到一半时这段外边距跟着收回去。 */
.cf-groups-member .cf-groups-avatar {
  margin-left: -6px;
}
.cf-groups-member .cf-groups-avatar.cf-groups-avatar-enter-from,
.cf-groups-member .cf-groups-avatar.cf-groups-avatar-leave-to {
  margin-left: 0;
}
/* 菜单页里戴着头像框的头像不另外让出边距（MemberName.vue 里那一圈是给弹窗和右键菜单的），框直接伸到外面；
   成员胶囊里的头像照旧贴着左边的圆角。 */
.cf-groups-settings .cf-groups-who .cf-groups-avatar:has(> .cf-avatar-frame) {
  margin: 0;
}
/* 列表顶上「xxx 的分组」那一行只有一个头像，让出一小圈（头像直径的 0.25 倍），框不贴着卡片的边、名字不挤着框。 */
.cf-groups-owner .cf-groups-who .cf-groups-avatar:has(> .cf-avatar-frame) {
  margin: calc(var(--cf-avatar-px, 21px) * var(--cf-font-scale, 1) * 0.25);
}
.cf-groups-member
  .cf-groups-who
  .cf-groups-avatar:has(> .cf-avatar-frame):not(
    .cf-groups-avatar-enter-from,
    .cf-groups-avatar-leave-to
  ) {
  margin-left: -6px;
}
/* 成员后面的评分：和名字同色、同样的字（字的写法在 MemberName.vue 里）；Unrated 这类说明用浅色的细字。 */
.cf-groups-rating {
  flex: none;
  color: var(--cf-gray-400);
  font-variant-numeric: tabular-nums;
}
.cf-groups-rating.is-plain {
  font-weight: normal;
}
/* 展开一个分组时，成员一个接一个地从下面一点的位置浮上来，最后一行的「管理成员」跟着（收着的时候没有这条动画，所以每次展开都会播）。 */
.cf-groups-row.is-open + .cf-expand-region .cf-groups-member,
.cf-groups-row.is-open + .cf-expand-region .cf-groups-empty,
.cf-groups-row.is-open + .cf-expand-region .cf-groups-members-foot {
  animation: cf-groups-member-in 280ms var(--cf-ease-out) backwards;
  animation-delay: calc(var(--cf-member-order, 0) * 14ms);
}
@keyframes cf-groups-member-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
/* 评分读到之后先后会变：换了位置的滑过去。 */
.cf-groups-member-list-move {
  transition: transform var(--cf-duration-moderate) var(--cf-ease-out);
}
.cf-groups-member-list-enter-active,
.cf-groups-member-list-leave-active {
  transition: opacity var(--cf-duration-fast) ease;
}
.cf-groups-member-list-leave-active {
  position: absolute;
}
.cf-groups-member-list-enter-from,
.cf-groups-member-list-leave-to {
  opacity: 0;
}
/* 收起来的那些人：「+N」。不能看着像一个成员，所以没有底色，一圈浅色的虚线，字是浅色的数字。点它打开管理弹窗。 */
.cf-groups-member.is-more {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--cf-gray-400) 60%, transparent);
  background: none;
  color: var(--cf-gray-500);
  font-variant-numeric: tabular-nums;
  font-weight: normal;
  cursor: pointer;
  transition:
    background-color var(--cf-duration-fast) ease,
    border-color var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease;
}
.cf-groups-member.is-more:hover {
  border-color: color-mix(in srgb, var(--cf-menu-accent) 55%, var(--cf-surface-border));
  background: var(--cf-control-active);
  color: var(--cf-control-ink);
}
/* 成员区最后一行：靠右的「管理成员 ›」。 */
.cf-groups-members-foot {
  display: flex;
  flex-basis: 100%;
  justify-content: flex-end;
}
.cf-groups-manage-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding: 2px 4px;
  border: 0;
  border-radius: var(--cf-radius-xs);
  background: none;
  color: var(--cf-control-ink);
  font: inherit;
  font-size: var(--cf-font-size-xs);
  cursor: pointer;
  transition: background-color var(--cf-duration-fast) ease;
}
.cf-groups-manage-link:hover {
  background: var(--cf-control-active);
}
.cf-groups-manage-link i {
  width: 5px;
  height: 5px;
  border: solid currentColor;
  border-width: 2px 2px 0 0;
  transform: rotate(45deg);
  transition: transform var(--cf-duration-fast) ease;
}
.cf-groups-manage-link:hover i {
  transform: translateX(2px) rotate(45deg);
}
.cf-groups-empty {
  align-self: center;
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-xs);
}
/* 新建分组：平时是一行「+ 新建分组」，点了换成输入框。 */
.cf-groups-create {
  border-top: 1px solid var(--cf-surface-border);
}
.cf-groups-add {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 34px;
  margin: 0;
  padding: 0 10px;
  border: 0;
  background: none;
  color: var(--cf-control-ink);
  font: inherit;
  font-size: var(--cf-font-size-base);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--cf-duration-fast) ease;
}
.cf-groups-add:hover {
  background: color-mix(in srgb, var(--cf-menu-accent) 9%, transparent);
}
.cf-groups-create-form {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 10px;
}
.cf-groups-create-form.is-rejected {
  animation: cf-groups-shake 0.3s ease;
}
@keyframes cf-groups-shake {
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}
/* 输入框：白底、带主题色的边线和一点内凹的阴影，从淡色的卡片上分出来（底色和卡片一样淡的话就融在一起了）。
   鼠标移上去边线加深，输入时再深一些并带一圈光晕。分组管理弹窗里的输入框也是它。 */
.cf-groups-input {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--cf-menu-accent) 34%, var(--cf-surface-border));
  border-radius: var(--cf-radius-sm);
  background: #fff;
  box-shadow: inset 0 1px 2px color-mix(in srgb, var(--cf-menu-accent) 12%, transparent);
  color: var(--cf-gray-700);
  font: inherit;
  font-size: var(--cf-font-size-base);
  box-sizing: border-box;
  outline: none;
  transition:
    border-color var(--cf-duration-fast) ease,
    background-color var(--cf-duration-fast) ease,
    box-shadow var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease;
}
.cf-groups-input::placeholder {
  color: var(--cf-gray-400);
  opacity: 1;
}
.cf-groups-input:hover {
  border-color: color-mix(in srgb, var(--cf-menu-accent) 52%, var(--cf-surface-border));
}
.cf-groups-input:focus {
  border-color: color-mix(in srgb, var(--cf-menu-accent) 72%, var(--cf-surface-border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--cf-menu-accent) 18%, transparent);
}
.cf-groups-text-btn {
  flex: none;
  margin: 0;
  padding: 2px 4px;
  border: 0;
  border-radius: var(--cf-radius-xs);
  background: none;
  color: var(--cf-gray-500);
  font: inherit;
  font-size: var(--cf-font-size-base);
  cursor: pointer;
  transition:
    color var(--cf-duration-fast) ease,
    opacity var(--cf-duration-fast) ease;
}
.cf-groups-text-btn:hover {
  color: var(--cf-gray-700);
}
/* 名字还没填时「创建」用不了。 */
.cf-groups-text-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.cf-groups-text-btn.is-primary {
  color: var(--cf-control-ink);
  font-weight: var(--cf-font-weight-semibold);
}
.cf-groups-swap-enter-active,
.cf-groups-swap-leave-active {
  transition: opacity 110ms ease;
}
.cf-groups-swap-enter-from,
.cf-groups-swap-leave-to {
  opacity: 0;
}
.cf-groups-actions {
  display: flex;
  gap: 8px;
}
@media (prefers-reduced-motion: reduce) {
  .cf-groups-create-form.is-rejected,
  .cf-groups-row.is-open + .cf-expand-region .cf-groups-member,
  .cf-groups-row.is-open + .cf-expand-region .cf-groups-empty,
  .cf-groups-row.is-open + .cf-expand-region .cf-groups-members-foot {
    animation: none;
  }
}
</style>
