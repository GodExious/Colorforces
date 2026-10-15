<script>
import { shallowRef } from 'vue';
const request = shallowRef(null);
// 打开分组管理。groupId 给了就先停在那个分组上，没给停在「好友」上。弹窗始终只有一个。
// handle 给了（从右键菜单打开时）：成员表里这个人那一行滚到看得见的地方，闪一下。
export function showGroupsDialog(groupId = '', handle = '') {
  request.value = { groupId, handle };
}
// 快捷键用（见 App.vue）：开着没有、关上。
export const groupsDialogShown = () => Boolean(request.value);
export function closeGroupsDialog() {
  request.value = null;
}
</script>
<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { translate as t } from '../../../../../i18n/index.js';
import * as assets from '../../../../../assets/index.js';
import { appSettings, saveSettings } from '../../../../../settings.js';
import { FONT_SIZE } from '../../../../../config/defaults.js';
import { menuTabColor, PETAL_COLORS } from '../../../../../utils/petal-palette.js';
import { preventScrollChaining } from '../../../../../utils/scroll.js';
import { isTruncated } from '../../../../../utils/text-overflow.js';
import InlineSvg from '../../../../components/icons/InlineSvg/InlineSvg.vue';
import DialogTransition from '../../../../components/transitions/DialogTransition/DialogTransition.vue';
import ExpandTransition from '../../../../components/transitions/ExpandTransition/ExpandTransition.vue';
import SmoothText from '../../../../components/transitions/SmoothText/SmoothText.vue';
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
import AvatarFrame from '../../../../components/avatars/AvatarFrame/AvatarFrame.vue';
import { showFrameDialog } from '../../../user/components/FrameDialog/FrameDialog.vue';
import { KNOWN_FRAMES } from '../../../../../features/user/frames/catalog.js';
import { arrangeGroups, stepOrder } from '../../../../../features/user/groups/reorder.js';
import ColorPanel from '../ColorPanel/ColorPanel.vue';
import MemberName, {
  compareByName,
  compareByRating,
  rankInk,
  ratingLabel,
} from '../MemberName/MemberName.vue';
import {
  FRIENDS_GROUP,
  MARK_LIMIT,
  MEMO_LIMIT,
  NAME_LIMIT,
  addGroup,
  clipMark,
  editGroup,
  groupIdsOf,
  groupNamed,
  isFriend,
  isHandle,
  joinGroup,
  leaveGroup,
  listGroups,
  markLength,
  membersOf,
  memoOf,
  removeGroup,
  moveGroup,
  setMemo,
  shownMark,
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
// 左栏正拖着调整先后时，自建分组眼下的先后（一串 id），和正拖着的那一个；没在拖时是 null、空串。见下面「左栏拖动调整先后」。
const sideOrder = ref(null),
  sideDragging = ref('');
const groups = computed(() => {
  if (!account.value) return [{ id: FRIENDS_GROUP, builtin: true, frame: '', count: 0 }];
  const arranged = listGroups(account.value);
  // 左栏正拖着调整先后时，按拖动中的先后排（见下面「左栏拖动调整先后」）。
  const list = sideOrder.value ? arrangeGroups(arranged, sideOrder.value) : arranged;
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

// 勾选：用来批量移出（「好友」里是批量取消关注），或者一起加进别的分组。换分组时清空。
const checked = ref([]);
const toggleChecked = (handle) =>
  (checked.value = checked.value.includes(handle)
    ? checked.value.filter((item) => item !== handle)
    : [...checked.value, handle]);
// 表头的全选框：一个都没勾、勾了一部分、全勾上三种样子。点它：没全勾上时全勾上，全勾上了就全去掉。
const checkedAll = computed(
  () => rows.value.length > 0 && rows.value.every((row) => checked.value.includes(row.handle)),
);
const checkedSome = computed(() => !checkedAll.value && checked.value.length > 0);
const toggleAll = () =>
  (checked.value = checkedAll.value ? [] : rows.value.map((row) => row.handle));
function select(id) {
  selected.value = id;
  copyOpen.value = false;
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

// 把勾选的人一起加进另一个自建的分组：点按钮展开一个小列表，列出别的自建分组，点哪个加进哪个。
// 人还留在当前的分组里（是加进去，不是挪过去）。列表里每个分组后面写着这次会新加几个人，都已经在里面的点不了。
// 加进「好友」就是关注，有自己的输入框，这里不列。
const copyOpen = ref(false);
const copyTargets = computed(() => {
  const own = account.value;
  return groups.value
    .filter((group) => !group.builtin && group.id !== selected.value)
    .map((group) => ({
      ...group,
      fresh: own
        ? checked.value.filter((handle) => !groupIdsOf(own, handle).includes(group.id)).length
        : 0,
    }));
});
// 没有勾选的人了、没有别的分组了（比如在别的标签页里删了）：列表收起来。
watch(
  () => !checked.value.length || !copyTargets.value.length,
  (off) => off && (copyOpen.value = false),
);
function copyTo(group) {
  copyOpen.value = false;
  let added = 0;
  change((own) => (added = joinGroup(own, group.id, checked.value).added.length) > 0);
  if (added) notes.value = [['groupsCopied', added, group.name]];
  checked.value = [];
}
// 点到列表和按钮以外的地方：收起来。
const closeCopy = (event) =>
  copyOpen.value && !event.target.closest?.('.cf-groups-copy') && (copyOpen.value = false);

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
// 自定义颜色：点「自定义」色块展开取色（见 ColorPanel），什么颜色都能选。展开时停在现在这个颜色上，
// 没设颜色时停在分组页的主题色上；还没动就不改颜色。拖的时候只改预览（见上面的 draftColor），松手才存。
const RING = [...PETAL_COLORS, PETAL_COLORS[0]].join(', ');
const customOpen = ref(false);
const isCustom = computed(
  () => Boolean(current.value?.color) && !PETAL_COLORS.includes(current.value.color),
);
const toggleCustom = () => (customOpen.value = !customOpen.value);
// 松手：存下来。存好之后这个分组的颜色已经是它了，预览撤掉也不会跳。
function commitColor(color) {
  setColor(color);
  draftColor.value = '';
}

// 编辑行下面的预览：这个分组在页面上显示成什么样，写名字的标签和小标各一个，跟着正在改的名字、标记、颜色当场变。
// 眼睛按钮：展开、收起预览。
// 每次打开弹窗都是收着的；开着的这段时间里换分组不收。
const showPreview = ref(false);
const togglePreview = () => (showPreview.value = !showPreview.value);
// 点预览里的卡片：页面上的标签换成那一种。
function chooseTagStyle(style) {
  if (appSettings.groups.tagStyle === style) return;
  appSettings.groups.tagStyle = style;
  saveSettings();
}
// 名字：一个都没勾时用自己；勾了人时用勾选的人里在成员表里排最前的那个（跟着表格眼下的排序）。
const previewName = computed(() => {
  const first = rows.value.find((row) => checked.value.includes(row.handle));
  return first ? first.profile?.handle || first.handle : owner.value;
});
const previewInk = computed(() =>
  profilesSeen.value >= 0 ? rankInk(profileOf(previewName.value)) : null,
);
const previewTags = computed(() => {
  const group = current.value;
  if (!group) return [];
  const color = group.color || menuTabColor('groups');
  const chars = shownMark({ ...group, mark: markDraft.value });
  return [
    {
      key: 'name',
      text: group.builtin ? nameOf(group) : renaming.value.trim() || group.name,
      kind: null,
      width: null,
    },
    {
      key: 'mark',
      text: chars.join(''),
      kind: chars.length > 1 ? 'marks' : 'mark',
      // 一个字符的是 18px 的圆，没有图标的是 8px 的色点，两个字符的按字的宽度。
      width: chars.length > 1 ? null : chars.length ? '18px' : '8px',
    },
  ].map((tag) => ({
    ...tag,
    // 字变了时淡出再淡入，只在「好友」上做：它的名字跟着语言变。自建分组的名字、标记是正在输入框里改的，
    // 每打一个字都淡一下太晃，直接变。
    swap: group.builtin ? tag.text : '',
    style: { '--cf-group-color': color, '--cf-group-width': tag.width, color: previewInk.value },
  }));
});

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
// 一项出现、消失时从零长出来、收回去：成员表「所在分组」里的分组标签横着长（连同它和下一个之间的间隔），
// 左边的分组竖着长。按量好的确切大小过渡，不用最大宽度、最大高度的办法（那样前大半段看不出变化，最后一下子没了）。
const growing = (element) =>
  element.classList.contains('cf-groups-chip')
    ? ['width', 'paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth', 'marginRight']
    : ['height', 'minHeight', 'paddingTop', 'paddingBottom'];
function sizeFrames(element) {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const open = { boxSizing: 'border-box', opacity: 1 },
    shut = { boxSizing: 'border-box', opacity: 0 };
  for (const key of growing(element)) {
    open[key] =
      key === 'width' ? rect.width + 'px' : key === 'height' ? rect.height + 'px' : style[key];
    // 收起来时连同后面那 4px 的间隔一起收掉。
    shut[key] = key === 'marginRight' ? '-4px' : '0px';
  }
  return [shut, open];
}
function sizeMotion(element, done, entering) {
  if (!element.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
  const [shut, open] = sizeFrames(element);
  element.style.overflow = 'hidden';
  const motion = element.animate(entering ? [shut, open] : [open, shut], {
    duration: 200,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  });
  motion.onfinish = motion.oncancel = () => {
    element.style.overflow = '';
    done();
  };
  if (element.classList.contains('cf-groups-side-entry')) followSideMark(performance.now() + 240);
}
// 左边选中的那一块：量出选中的分组在这一栏里的位置和高度，滑过去。打开弹窗时直接到位，不滑。
// 分组在长出来、收回去的时候（新建、删掉），选中的那个会跟着挪，这期间每一帧都跟上。
const side = ref(null),
  sideMark = ref(null);
let sideSpot = null,
  following = 0;
function placeSideMark(animate = true) {
  const mark = sideMark.value;
  const row = side.value?.querySelector('.cf-groups-side-row.active');
  if (!mark) return;
  if (!row) {
    mark.style.opacity = '0';
    sideSpot = null;
    return;
  }
  // 按看得见的位置量：拖着的那一行、换位置时滑着的行都带着位移，offsetTop 量不到。
  const box = side.value.getBoundingClientRect();
  const rect = row.getBoundingClientRect();
  const spot = {
    top: Math.round(rect.top - box.top + side.value.scrollTop),
    height: Math.round(rect.height),
  };
  if (sideSpot && sideSpot.top === spot.top && sideSpot.height === spot.height) return;
  const moving =
    animate && sideSpot !== null && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  mark.style.transition = moving ? '' : 'none';
  mark.style.transform = `translateY(${spot.top}px)`;
  mark.style.height = spot.height + 'px';
  mark.style.opacity = '1';
  if (!moving) {
    void mark.offsetHeight;
    mark.style.transition = '';
  }
  sideSpot = spot;
}
function followSideMark(until) {
  cancelAnimationFrame(following);
  const step = () => {
    placeSideMark(false);
    if (performance.now() < until) following = requestAnimationFrame(step);
  };
  following = requestAnimationFrame(step);
}
watch(selected, () => nextTick(() => placeSideMark()));
const growIn = (element, done) => sizeMotion(element, done, true);
const growOut = (element, done) => sizeMotion(element, done, false);
function showGroups(event, row) {
  const cell = event.currentTarget;
  const cut = [...cell.children].some((chip) => chip.scrollWidth > chip.clientWidth + 1);
  if (row.groups.length > row.shown || cut)
    tooltip.show(cell, row.groups.map(nameOf).join(t('groupsListJoin')));
}
// 标记：边打边截到两个字符（一个表情算一个），下面的字数跟着变；输入法还在拼字时不截。失去焦点或回车时存。
const markDraft = ref('');
watch(
  () => [current.value?.id, current.value?.mark],
  () => (markDraft.value = current.value?.mark || ''),
  { immediate: true },
);
function typeMark(event) {
  if (event.isComposing) return;
  const clipped = clipMark(event.target.value);
  if (clipped !== event.target.value) event.target.value = clipped;
  markDraft.value = clipped;
}
function setMark() {
  change((own) => editGroup(own, selected.value, { mark: markDraft.value }));
  // 存下的是去掉首尾空白之后的，输入框里换成它。
  markDraft.value = current.value?.mark || '';
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

/*
 * 左栏拖动调整先后：按住自建分组左边的把手上下拖，和分组页一样（做法的说明见 GroupsPage.vue 的「拖动调整先后」）。
 * 每一项分两层：外面一层（entry）是它在这一栏里占的位置，换先后时滑过去；里面一层（按钮）是看得见的内容，拖的时候贴着鼠标。
 * 拖的过程中只记在这里（sideOrder），松手才存一次。选中的那一块跟着看得见的位置每一帧挪。
 */
let sideDrag = null,
  sideShield = null;
function placeSideBody() {
  const { entry, body, grab, height, y } = sideDrag;
  const rows = entry.parentElement;
  // 最上面不超过「好友」那一行的下边，最下面不超过这一栏分组的下边。
  const floor = rows.firstElementChild.getBoundingClientRect().bottom;
  const ceiling = rows.getBoundingClientRect().bottom - height;
  const top = Math.min(Math.max(y - grab, floor), Math.max(floor, ceiling));
  body.style.transform = `translateY(${Math.round(top - entry.getBoundingClientRect().top)}px)`;
  return { top, bottom: top + height };
}
function startSideDrag(event, group) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const entry = event.currentTarget.closest('.cf-groups-side-entry');
  const body = entry?.querySelector('.cf-groups-side-row');
  if (!body || sideDrag) return;
  event.preventDefault();
  tooltip.hide();
  const box = entry.getBoundingClientRect();
  sideDrag = { id: group.id, entry, body, grab: event.clientY - box.top, height: box.height };
  sideDragging.value = group.id;
  sideOrder.value = groups.value.filter((item) => !item.builtin).map((item) => item.id);
  // 拖的过程中盖住整个窗口的透明挡板（样式在分组页里）：别的东西不出悬停、不弹提示，鼠标一直是「抓着」。
  sideShield = document.createElement('div');
  sideShield.id = 'cf-groups-drag-shield';
  document.body.appendChild(sideShield);
  window.addEventListener('pointermove', moveSideDrag);
  window.addEventListener('pointerup', endSideDrag);
  window.addEventListener('pointercancel', endSideDrag);
  followSideMark(Infinity);
}
function moveSideDrag(event) {
  if (!sideDrag) return;
  sideDrag.y = event.clientY;
  const { top, bottom } = placeSideBody();
  const order = sideOrder.value;
  const rows = sideDrag.entry.parentElement;
  const rowsTop = rows.getBoundingClientRect().top;
  const middleOf = (id) => {
    const row = rows.querySelector(`[data-group="${CSS.escape(id)}"]`);
    return row ? rowsTop + row.offsetTop + row.offsetHeight / 2 : NaN;
  };
  const next = stepOrder(order, sideDrag.id, top, bottom, middleOf);
  if (next === order) return;
  sideOrder.value = next;
  nextTick(() => sideDrag && placeSideBody());
}
function endSideDrag() {
  if (!sideDrag) return;
  const { id, body } = sideDrag;
  const order = sideOrder.value;
  sideDrag = null;
  window.removeEventListener('pointermove', moveSideDrag);
  window.removeEventListener('pointerup', endSideDrag);
  window.removeEventListener('pointercancel', endSideDrag);
  sideShield?.remove();
  sideShield = null;
  const settle = () => {
    body.style.transition = '';
    if (sideDragging.value === id) sideDragging.value = '';
  };
  body.style.transition = 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)';
  body.style.transform = '';
  body.addEventListener('transitionend', settle, { once: true });
  setTimeout(settle, 260);
  if (order?.includes(id)) change((own) => moveGroup(own, id, order.indexOf(id)));
  sideOrder.value = null;
  // 选中的那一块再跟一会儿，等松手后的滑动走完。
  followSideMark(performance.now() + 320);
}

// 分组的头像框：编辑行里一个小格子（和分组页那一行的一样），点了打开头像框库，「给谁戴」选好这个分组。
// 不认识的（比如导入的头像框后来删了）当作没设。
const frameOfGroup = (group) => (KNOWN_FRAMES.has(group?.frame) ? group.frame : '');
// 头像框关着（关了头像也算）时，小格子灰掉、点不了（样式和分组页那一行的共用）。
const framesOn = computed(() => appSettings.user.avatar.enabled && appSettings.user.avatar.frames);

// 名字太长被省略时，鼠标移上去提示全名。
function showCut(event, text) {
  if (isTruncated(event.currentTarget)) tooltip.show(event.currentTarget, text);
}

// 只有右上角的 × 和下面的「完成」能关：这个弹窗里要点的东西多，点到框外面、按到 Esc 就关掉太容易误触。
function close() {
  endSideDrag();
  request.value = null;
}
let stop, stopProfiles;
// 从右键菜单打开时要闪一下的那一行（小写账号名），闪完清掉。
const flash = ref('');
let flashTimer = 0;
function flashRow(handle) {
  clearTimeout(flashTimer);
  flash.value = handle ? handle.toLowerCase() : '';
  if (!flash.value) return;
  // 右边那一块换成这个分组要淡入一下，等它出来再滚过去。
  setTimeout(() => {
    overlay.value
      ?.querySelector('.cf-groups-table-row.is-flash')
      ?.scrollIntoView({ block: 'nearest' });
  }, 260);
  flashTimer = setTimeout(() => (flash.value = ''), 1900);
}
watch(request, (value) => {
  // 被快捷键关上时侧栏可能正拖着：放下。
  if (!value) return endSideDrag();
  owner.value = getCurrentUserHandle() || '';
  selected.value = value.groupId || FRIENDS_GROUP;
  sortKey.value = 'name';
  sortDown.value = false;
  checked.value = [];
  notes.value = [];
  adding.value = '';
  // 上次开着的自定义颜色、复制菜单、没松手的颜色都不带过来：每次打开都是收着的。
  customOpen.value = false;
  copyOpen.value = false;
  draftColor.value = '';
  cancelCreate();
  reload();
  sideSpot = null;
  showPreview.value = false;
  nextTick(() => placeSideMark(false));
  flashRow(value.handle);
});
watch(overlay, (node) => {
  if (node) preventScrollChaining(node);
});
onMounted(() => {
  document.addEventListener('pointerdown', closeCopy, true);
  stop = subscribeGroups(() => request.value && reload());
  stopProfiles = subscribeProfiles(() => profilesSeen.value++);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeCopy, true);
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
            <div ref="side" class="cf-groups-side cf-scrollbar">
              <!-- 选中的那个分组底下垫的一块，换分组时滑过去（和菜单左边的页签一样）。 -->
              <span ref="sideMark" class="cf-groups-side-mark" aria-hidden="true"></span>
              <!-- 每一项外面一层是它占的位置（换先后时滑过去），里面的按钮是看得见的内容（拖的时候贴着鼠标）。 -->
              <TransitionGroup
                :css="false"
                tag="div"
                class="cf-groups-side-rows"
                move-class="cf-groups-side-move"
                @enter="growIn"
                @leave="growOut"
              >
                <div
                  v-for="group in groups"
                  :key="group.id"
                  class="cf-groups-side-entry"
                  :class="{ 'is-dragging': sideDragging === group.id }"
                  :data-group="group.id"
                >
                  <button
                    type="button"
                    class="cf-groups-side-row"
                    :class="{
                      active: group.id === selected,
                      'has-conflict': conflict === group.id,
                    }"
                    @click="select(group.id)"
                  >
                    <!-- 「好友」固定在最前，是一枚图钉；别的分组按住六个点的把手拖。 -->
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
                      @pointerdown="startSideDrag($event, group)"
                      @click.stop
                      ><i></i><i></i><i></i><i></i><i></i><i></i
                    ></span>
                    <GroupMark :group="group" />
                    <span
                      class="cf-groups-side-name"
                      @mouseenter="showCut($event, nameOf(group))"
                      @mouseleave="tooltip.hide()"
                      >{{ nameOf(group) }}</span
                    >
                    <span class="cf-groups-side-count"
                      ><SmoothText :text="String(group.count)"
                    /></span>
                  </button>
                </div>
              </TransitionGroup>
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
                    <!-- 输入框里面的最右边一直显示已经写了几个字、最多几个。 -->
                    <label class="cf-groups-field">
                      <input
                        class="cf-groups-input cf-groups-editor-mark"
                        type="text"
                        :value="markDraft"
                        :placeholder="current.builtin ? '★' : t('groupsMarkPlaceholder')"
                        :data-tooltip="
                          t(current.builtin ? 'groupsFriendsMarkHint' : 'groupsMarkHint')
                        "
                        @input="typeMark"
                        @compositionend="typeMark"
                        @change="setMark"
                        @keydown.enter="$event.target.blur()"
                      />
                      <span
                        class="cf-groups-count"
                        :class="{ 'is-full': markLength(markDraft) >= MARK_LIMIT }"
                        >{{ markLength(markDraft) }}/{{ MARK_LIMIT }}</span
                      >
                    </label>
                    <!-- 「好友」的名字是固定的（跟着菜单的语言），一个改不了的输入框，和别的分组对齐。 -->
                    <label v-if="current.builtin" class="cf-groups-field is-name">
                      <input
                        class="cf-groups-input cf-groups-editor-name"
                        type="text"
                        :value="nameOf(current)"
                        disabled
                      />
                    </label>
                    <label v-else class="cf-groups-field is-name">
                      <input
                        v-model="renaming"
                        class="cf-groups-input cf-groups-editor-name"
                        type="text"
                        :maxlength="NAME_LIMIT"
                        @blur="commitName"
                        @keydown.enter="$event.target.blur()"
                      />
                      <span
                        class="cf-groups-count"
                        :class="{ 'is-full': renaming.length >= NAME_LIMIT }"
                        >{{ renaming.length }}/{{ NAME_LIMIT }}</span
                      >
                    </label>
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
                            ? current.color || menuTabColor('groups')
                            : isCustom
                              ? current.color
                              : null,
                        }"
                        :data-tooltip="t('groupsColorCustom')"
                        @click="toggleCustom"
                      ></button>
                    </div>
                    <!-- 这个分组的头像框：点一下打开头像框库。换了的时候旧的淡出，新的淡入。头像框关着时灰掉。 -->
                    <button
                      type="button"
                      class="cf-groups-frame-chip cf-frame-host"
                      :disabled="!framesOn"
                      :data-tooltip="t(framesOn ? 'groupsFrameChip' : 'groupsFrameChipOff')"
                      @click="showFrameDialog(current.id)"
                    >
                      <Transition name="cf-groups-swap" mode="out-in">
                        <span
                          v-if="frameOfGroup(current)"
                          :key="frameOfGroup(current)"
                          class="cf-groups-frame-face"
                          ><AvatarFrame :frame="frameOfGroup(current)"
                        /></span>
                        <span v-else key=":none" class="cf-groups-frame-empty"></span>
                      </Transition>
                    </button>
                    <!-- 眼睛：展开、收起下面的预览。 -->
                    <button
                      type="button"
                      class="cf-groups-eye"
                      :class="{ 'is-on': showPreview }"
                      :aria-pressed="showPreview"
                      :aria-label="t('groupsPreviewToggle')"
                      :data-tooltip="t('groupsPreviewToggle')"
                      @click="togglePreview"
                    >
                      <InlineSvg :source="assets.previewEyeIcon" />
                    </button>
                    <!-- 「好友」跟着原站，不能删：按钮在、灰着，和别的分组对齐。 -->
                    <button
                      type="button"
                      class="cf-groups-delete"
                      :disabled="current.builtin"
                      @click="requestRemoveGroup"
                    >
                      {{ t('groupsDelete') }}
                    </button>
                  </div>
                  <!-- 这个分组在页面上的样子：标签、小标各一张小卡片，页面上现在用的那张描一圈主题色、带「使用中」。 -->
                  <ExpandTransition :show="showPreview">
                    <div class="cf-groups-preview">
                      <!-- 点一张卡片，页面上的标签就换成这种（和分组页里「分组标签展示形式」是同一个设置）。 -->
                      <div
                        v-for="tag in previewTags"
                        :key="tag.key"
                        class="cf-groups-preview-card"
                        :class="{ 'is-on': appSettings.groups.tagStyle === tag.key }"
                        role="radio"
                        :aria-checked="appSettings.groups.tagStyle === tag.key"
                        tabindex="0"
                        @click="chooseTagStyle(tag.key)"
                        @keydown.enter.space.prevent="chooseTagStyle(tag.key)"
                      >
                        <span class="cf-groups-preview-cap"
                          ><span>{{
                            t(tag.key === 'name' ? 'groupsTagStyleName' : 'groupsTagStyleMark')
                          }}</span
                          ><Transition name="cf-groups-swap"
                            ><i v-if="appSettings.groups.tagStyle === tag.key">{{
                              t('groupsTagStyleInUse')
                            }}</i></Transition
                          ></span
                        >
                        <span class="cf-groups-preview-sample">
                          <!-- 标签的字写在属性里、由样式画出来，换语言的过渡管不到它：「好友」换了语言时整个淡出、淡入。 -->
                          <Transition name="cf-groups-swap" mode="out-in">
                            <span
                              :key="tag.swap"
                              class="cf-groups-preview-user"
                              :data-cf-group="tag.text"
                              :data-cf-group-kind="tag.kind"
                              :style="tag.style"
                              >{{ previewName }}</span
                            >
                          </Transition>
                        </span>
                      </div>
                    </div>
                  </ExpandTransition>
                  <ExpandTransition :show="customOpen">
                    <ColorPanel
                      :color="current.color || menuTabColor('groups')"
                      @preview="draftColor = $event"
                      @commit="commitColor"
                    />
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
                      <!-- 按钮上的字会变（勾选的人数、处理中、换了语言）：宽度跟着滑，不跳。 -->
                      <SmoothText
                        :text="
                          t(
                            current.builtin
                              ? working
                                ? 'groupsWorking'
                                : 'groupsFollow'
                              : 'groupsAdd',
                          )
                        "
                      />
                    </button>
                    <div
                      class="cf-groups-copy"
                      :data-tooltip="copyTargets.length ? null : t('groupsCopyNoTarget')"
                    >
                      <button
                        type="button"
                        class="cf-aurora-btn"
                        :class="{ 'is-open': copyOpen }"
                        :disabled="!checked.length || working || !copyTargets.length"
                        :aria-expanded="copyOpen"
                        @click="copyOpen = !copyOpen"
                      >
                        <SmoothText :text="t('groupsCopyChecked', checked.length)" /><i
                          class="cf-groups-copy-caret"
                          aria-hidden="true"
                        ></i>
                      </button>
                      <Transition name="cf-groups-pop">
                        <div v-if="copyOpen" class="cf-groups-copy-menu cf-scrollbar">
                          <button
                            v-for="group in copyTargets"
                            :key="group.id"
                            type="button"
                            class="cf-groups-copy-item"
                            :disabled="!group.fresh"
                            @click="copyTo(group)"
                          >
                            <GroupMark :group="group" />
                            <span class="cf-groups-copy-name">{{ group.name }}</span>
                            <span class="cf-groups-copy-end">{{
                              group.fresh ? t('groupsCopyFresh', group.fresh) : t('groupsCopyAllIn')
                            }}</span>
                          </button>
                        </div>
                      </Transition>
                    </div>
                    <button
                      type="button"
                      class="cf-aurora-btn"
                      :disabled="!checked.length || working"
                      @click="removeChecked"
                    >
                      <SmoothText
                        :text="
                          t(
                            current.builtin ? 'groupsUnfollowChecked' : 'groupsRemoveChecked',
                            checked.length,
                          )
                        "
                      />
                    </button>
                  </form>
                  <ExpandTransition :show="Boolean(feedback)">
                    <p class="cf-groups-feedback">{{ feedback }}</p>
                  </ExpandTransition>
                  <div class="cf-groups-table-row is-head cf-scrollbar">
                    <button
                      type="button"
                      class="cf-groups-check"
                      :class="{ on: checkedAll, 'is-some': checkedSome }"
                      role="checkbox"
                      :aria-checked="checkedSome ? 'mixed' : checkedAll"
                      :aria-label="t(checkedAll ? 'groupsSelectNone' : 'groupsSelectAll')"
                      :data-tooltip="t(checkedAll ? 'groupsSelectNone' : 'groupsSelectAll')"
                      :disabled="!rows.length"
                      @click="toggleAll"
                    ></button>
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
                  <div class="cf-groups-table cf-scrollbar">
                    <TransitionGroup name="cf-groups-list">
                      <div
                        v-for="row in rows"
                        :key="row.handle"
                        class="cf-groups-table-row"
                        :class="{ 'is-flash': flash === row.handle.toLowerCase() }"
                      >
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
                        <!-- 在别处（右键菜单、别的标签页）把这个人加进、移出分组时，标签横着长出来、收回去。 -->
                        <TransitionGroup
                          tag="span"
                          class="cf-groups-tags"
                          :css="false"
                          @enter="growIn"
                          @leave="growOut"
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
                          <span
                            v-if="row.groups.length > row.shown"
                            key=":more"
                            class="cf-groups-chip is-more"
                            ><SmoothText :text="'+' + (row.groups.length - row.shown)"
                          /></span>
                        </TransitionGroup>
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
/* 滚动条用公共的 cf-scrollbar（styles/scrollbar.css）。表头不滚动，但也挂着它，留出和下面一样宽的位置。 */
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
/* 悬停：垫一层半透明的主题色。不用实色的 --cf-card-hover：弹窗左上角的底色本来就偏蓝，实色的那层在上半截几乎看不出来。 */
.cf-groups-side-row:hover {
  background: color-mix(in srgb, var(--cf-menu-accent) 12%, transparent);
}
/* 选中的那一块垫在分组底下；选中的分组自己不再画底色，悬停时也不画（不然盖在这一块上面）。 */
.cf-groups-side {
  position: relative;
}
/* 左栏的分组：一列，彼此隔 2px；换先后时滑到新位置。 */
.cf-groups-side-rows {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cf-groups-side-move {
  transition: transform var(--cf-duration-moderate) var(--cf-ease-out);
}
/* 正在拖的那一项：占的位置一格一格地换，不带滑动；内容那一层浮起来一点，贴着鼠标。 */
.cf-groups-side-entry.is-dragging {
  position: relative;
  z-index: 2;
  transition: none !important;
}
.cf-groups-side-entry.is-dragging .cf-groups-side-row {
  background: var(--cf-content-surface);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--cf-menu-accent) 34%, var(--cf-surface-border)),
    0 8px 20px -8px color-mix(in srgb, var(--cf-menu-accent) 55%, transparent);
}
.cf-groups-side-entry.is-dragging .cf-groups-grip {
  cursor: grabbing;
}
/* 按钮放在位置那一层里面，不会自己撑满一行（按钮的宽度默认按内容算），要明说占满：不然长名字会把这一栏撑出横向滚动条，而不是省略。 */
.cf-groups-side-entry > .cf-groups-side-row {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.cf-groups-side-row > .cf-groups-grip {
  margin-right: -2px;
}
.cf-groups-side-mark {
  position: absolute;
  top: 0;
  right: 8px;
  left: 8px;
  border-radius: var(--cf-radius-md);
  background: var(--cf-control-active);
  opacity: 0;
  pointer-events: none;
  will-change: transform;
  transition:
    transform 0.48s var(--cf-ease-out-strong),
    height 0.48s var(--cf-ease-out-strong),
    opacity var(--cf-duration-base) ease;
}
.cf-groups-side-row {
  position: relative;
}
/* 新建时重名的那个分组：标红（输入框的样子在分组页的样式里）。 */
.cf-groups-side-row.has-conflict,
.cf-groups-side-row.has-conflict:hover {
  background: #fff1f2;
  box-shadow: inset 0 0 0 1px #e65b70;
  color: #bd2542;
}
.cf-groups-side-row.active,
.cf-groups-side-row.active:hover {
  background: none;
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
/* 输入框和它的字数：字数一直显示在输入框里面的最右边，输入框右边留出它的位置，打的字不会盖到它、也不会被它挤。 */
.cf-groups-field {
  position: relative;
  display: flex;
  flex: none;
  min-width: 0;
}
.cf-groups-field.is-name {
  flex: 1;
}
/* 「20/20」这样的字数大约 30px 宽，离右边 8px。 */
.cf-groups-editor .cf-groups-field .cf-groups-input {
  padding-right: 42px;
}
/* 标记最多两个字符：字在左边那一块里居中，右边是字数。 */
.cf-groups-editor .cf-groups-editor-mark {
  flex: none;
  width: 64px;
  padding-left: 6px;
  text-align: center;
}
.cf-groups-editor .cf-groups-field .cf-groups-editor-mark {
  padding-right: 26px;
}
.cf-groups-count {
  position: absolute;
  top: 50%;
  right: 8px;
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-2xs);
  font-variant-numeric: tabular-nums;
  line-height: 12px;
  white-space: nowrap;
  transform: translateY(-50%);
  pointer-events: none;
  transition: color var(--cf-duration-fast) ease;
}
/* 写满了：换成主题的深色，提醒已经到上限。 */
.cf-groups-count.is-full {
  color: var(--cf-control-ink);
}
.cf-groups-editor-name {
  flex: 1;
  font-weight: var(--cf-font-weight-semibold);
}
.cf-groups-editor .cf-groups-input,
.cf-groups-add-bar .cf-groups-input {
  height: 30px;
}
/* 编辑行的两个输入框（图标、名字）平时是很浅的灰底、没有边框，不抢眼；鼠标移上去灰一点；
   点进去写字时变成白底加主题色的边（写在悬停后面：鼠标停在框上写字时也是这个样子）。 */
.cf-groups-editor .cf-groups-input {
  border-color: transparent;
  background: color-mix(in srgb, var(--cf-gray-500) 7%, transparent);
  box-shadow: none;
}
.cf-groups-editor .cf-groups-input:hover {
  border-color: transparent;
  background: color-mix(in srgb, var(--cf-gray-500) 11%, transparent);
}
.cf-groups-editor .cf-groups-input:focus,
.cf-groups-editor .cf-groups-input:focus:hover {
  border-color: color-mix(in srgb, var(--cf-menu-accent) 72%, var(--cf-surface-border));
  background: #fff;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--cf-menu-accent) 18%, transparent);
}
/* 「好友」的名字：改不了。和能改的框分开：没有底色，一圈虚线，字更浅。 */
.cf-groups-editor .cf-groups-input:disabled,
.cf-groups-editor .cf-groups-input:disabled:hover {
  border: 1px dashed var(--cf-gray-300);
  background: transparent;
  color: var(--cf-gray-400);
  cursor: not-allowed;
}
/* 编辑行里的头像框小格子和旁边的眼睛一样高。 */
.cf-groups-editor .cf-groups-frame-chip {
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
/* 眼睛按钮：紧跟在色块后面，和编辑行的输入框一样高的小方块；开着时是选中的样子。 */
.cf-groups-eye {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  margin: 0;
  padding: 0;
  border: 1px solid var(--cf-surface-border);
  border-radius: var(--cf-radius-sm);
  background: var(--cf-control-surface);
  color: var(--cf-aurora-muted);
  cursor: pointer;
  transition:
    background-color var(--cf-duration-fast) ease,
    border-color var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease;
}
.cf-groups-eye:hover {
  background: var(--cf-card-hover);
  color: var(--cf-control-ink);
}
.cf-groups-eye.is-on {
  border-color: color-mix(in srgb, var(--cf-menu-accent) 55%, var(--cf-surface-border));
  background: var(--cf-control-active);
  color: var(--cf-control-ink);
}
.cf-groups-eye svg {
  display: block;
  width: 16px;
  height: 16px;
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
/* 「好友」不能删：按钮灰着。 */
.cf-groups-delete:disabled,
.cf-groups-delete:disabled:hover {
  background: none;
  color: var(--cf-gray-400);
  cursor: not-allowed;
}
/* 编辑行下面：这个分组在页面上的样子，标签、小标各一张小卡片。卡片的底是输入框那种半透明的白；
   页面上现在用的那张描一圈主题色。名字照原站表格里用户名的字，标签用的是页面上的样式。
   */
.cf-groups-preview {
  display: flex;
  gap: 10px;
  padding: 12px 16px 0;
}
.cf-groups-preview-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 6px 12px 8px;
  border: 1px solid color-mix(in srgb, var(--cf-surface-border) 70%, transparent);
  border-radius: var(--cf-radius-md);
  background: color-mix(in srgb, var(--cf-control-surface) 45%, transparent);
  transition:
    border-color var(--cf-duration-fast) ease,
    background-color var(--cf-duration-fast) ease,
    box-shadow var(--cf-duration-fast) ease;
}
.cf-groups-preview-card:not(.is-on) {
  cursor: pointer;
}
.cf-groups-preview-card:not(.is-on):hover {
  border-color: color-mix(in srgb, var(--cf-menu-accent) 35%, var(--cf-surface-border));
  background: color-mix(in srgb, var(--cf-control-surface) 80%, transparent);
}
.cf-groups-preview-card:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--cf-menu-accent) 45%, transparent);
  outline-offset: 1px;
}
.cf-groups-preview-card.is-on {
  border-color: color-mix(in srgb, var(--cf-menu-accent) 60%, var(--cf-surface-border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--cf-menu-accent) 18%, transparent);
}
.cf-groups-preview-cap {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
  line-height: 16px;
}
.cf-groups-preview-cap i {
  padding: 0 6px;
  border-radius: 999px;
  background: var(--cf-control-active);
  color: var(--cf-control-ink);
  font-size: var(--cf-font-size-2xs);
  font-style: normal;
  line-height: 16px;
}
.cf-groups-preview-sample {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 22px;
  overflow: hidden;
}
.cf-groups-preview-user {
  display: inline-flex;
  align-items: center;
  color: var(--cf-gray-700);
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: var(--cf-font-size-lg);
  font-weight: var(--cf-font-weight-bold);
  white-space: nowrap;
  transition: color var(--cf-duration-base) ease;
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
/* 「加入其他分组」：按钮后面一个小箭头，展开时转过来；下面弹出别的自建分组的列表。 */
.cf-groups-copy {
  position: relative;
  flex: none;
}
.cf-groups-copy .cf-aurora-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.cf-groups-copy-caret {
  width: 5px;
  height: 5px;
  margin-top: -3px;
  border: solid currentColor;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
  transition: transform var(--cf-duration-fast) ease;
}
.cf-groups-copy .is-open .cf-groups-copy-caret {
  margin-top: 3px;
  transform: rotate(-135deg);
}
.cf-groups-copy-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 5;
  min-width: 220px;
  max-height: 240px;
  padding: 6px;
  border: 1px solid var(--cf-surface-border);
  border-radius: var(--cf-radius-md);
  background: var(--cf-white-surface);
  box-shadow: 0 10px 28px #2634531f;
  box-sizing: border-box;
  overflow-y: auto;
}
.cf-groups-copy-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 30px;
  margin: 0;
  padding: 0 8px;
  border: 0;
  border-radius: var(--cf-radius-sm);
  background: none;
  color: var(--cf-aurora-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background-color var(--cf-duration-fast) ease,
    opacity var(--cf-duration-fast) ease;
}
.cf-groups-copy-item:hover:not(:disabled) {
  background: var(--cf-card-hover);
}
.cf-groups-copy-item:disabled {
  opacity: 0.45;
  cursor: default;
}
.cf-groups-copy-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cf-groups-copy-end {
  flex: none;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
}
.cf-groups-pop-enter-active,
.cf-groups-pop-leave-active {
  transition:
    opacity var(--cf-duration-fast) ease,
    transform var(--cf-duration-fast) var(--cf-ease-out);
}
.cf-groups-pop-enter-from,
.cf-groups-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
@media (prefers-reduced-motion: reduce) {
  .cf-groups-pop-enter-active,
  .cf-groups-pop-leave-active,
  .cf-groups-copy-caret {
    transition: none;
  }
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
/* 从右键菜单打开时，那个人的那一行闪一下：垫一层主题色，慢慢褪掉。 */
.cf-groups-table-row.is-flash {
  animation: cf-groups-row-flash 1800ms ease-out 200ms backwards;
}
@keyframes cf-groups-row-flash {
  0%,
  30% {
    background: color-mix(in srgb, var(--cf-menu-accent) 24%, transparent);
  }
  100% {
    background: transparent;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cf-groups-table-row.is-flash {
    animation: none;
  }
}
.cf-groups-table-row {
  display: grid;
  grid-template-columns: 18px 170px 60px minmax(0, 1fr) 160px 18px;
  align-items: center;
  gap: 10px;
  min-height: max(38px, calc(var(--cf-avatar-px, 21px) * var(--cf-font-scale, 1) + 14px));
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
/* 勾选框：勾上时填满主题色，里面一个白色的对号（两条边画出来），弹一下出现。
   表头的全选框勾了一部分时，里面是一条横线。和右键菜单里的勾选框是同一种画法。 */
.cf-groups-check {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  margin: 0;
  padding: 0;
  border: 2px solid var(--cf-surface-border);
  border-radius: var(--cf-radius-xs);
  background: var(--cf-content-surface);
  box-sizing: border-box;
  cursor: pointer;
  transition:
    background-color var(--cf-duration-fast) ease,
    border-color var(--cf-duration-fast) ease,
    opacity var(--cf-duration-fast) ease;
}
.cf-groups-check::after {
  content: '';
  width: 4px;
  height: 8px;
  margin-top: -2px;
  border: solid var(--cf-white-ink);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) scale(0);
  transition: transform var(--cf-duration-fast) var(--cf-ease-out);
}
.cf-groups-check.on,
.cf-groups-check.is-some {
  border-color: var(--cf-menu-accent);
  background: var(--cf-menu-accent);
}
.cf-groups-check.on::after {
  transform: rotate(45deg) scale(1);
}
.cf-groups-check.is-some::after {
  width: 8px;
  height: 0;
  margin-top: 0;
  border-width: 0 0 2px;
  transform: none;
}
.cf-groups-check:disabled {
  opacity: 0.5;
  cursor: default;
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
