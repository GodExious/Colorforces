<script>
import { shallowRef } from 'vue';
const request = shallowRef(null);
// 打开头像框库。target 是给谁挑：'me'（我自己，默认）或者分组的 id。弹窗始终只有一个。
export function showFrameDialog(target = 'me') {
  request.value = { target };
}
// 快捷键用（见 App.vue）：开着没有、关上。then 是关上以后接着做的。
// 编辑区里有没保存的内容时先问一下（弹窗那边设的 leaving，见下面的 leaveEditor），取消就不关、then 也不做。
export const frameDialogShown = () => Boolean(request.value);
let leaving = (go) => go();
export function closeFrameDialog(then) {
  leaving(() => {
    request.value = null;
    then?.();
  });
}
</script>
<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { translate as t } from '../../../../../i18n/index.js';
import * as assets from '../../../../../assets/index.js';
import { appSettings, setSetting } from '../../../../../settings.js';
import { menuTabColor } from '../../../../../utils/petal-palette.js';
import { preventScrollChaining } from '../../../../../utils/scroll.js';
import InlineSvg from '../../../../components/icons/InlineSvg/InlineSvg.vue';
import DialogTransition from '../../../../components/transitions/DialogTransition/DialogTransition.vue';
import SmoothText from '../../../../components/transitions/SmoothText/SmoothText.vue';
import { tooltip } from '../../../../components/tooltips/FloatingTooltip/FloatingTooltip.vue';
import { isTruncated } from '../../../../../utils/text-overflow.js';
import AvatarFrame from '../../../../components/avatars/AvatarFrame/AvatarFrame.vue';
import { getCurrentUserHandle } from '../../../../../features/page/account.js';
import {
  readAccount,
  changeAccount,
  subscribeGroups,
  refreshMembers,
} from '../../../../../features/user/groups/data.js';
import {
  profileOf,
  requestProfiles,
  subscribeProfiles,
} from '../../../../../features/user/groups/profiles.js';
import { editGroup, listGroups, membersOf } from '../../../../../features/user/groups/store.js';
import { chooseFrame } from '../../../../../features/user/frames/choose.js';
import {
  KNOWN_FRAMES,
  frameCredit,
  frameIntro,
  frameKind,
  framesOfKind,
  wearableFrame,
} from '../../../../../features/user/frames/catalog.js';
import { chosenFrames, watchChosenFrames } from '../../../../../features/user/frames/chosen.js';
import {
  customFrame,
  seeCustomFrame,
  removeCustomFrames,
  exportCustomFrames,
} from '../../../../../features/user/frames/custom/data.js';
import ExpandTransition from '../../../../components/transitions/ExpandTransition/ExpandTransition.vue';
import { showConfirmPop } from '../../../../components/dialogs/ConfirmDialog/ConfirmDialog.vue';
import FrameTile from './components/FrameTile/FrameTile.vue';
import FrameTarget from './components/FrameTarget/FrameTarget.vue';
import FramePreview from './components/FramePreview/FramePreview.vue';
import FrameEditor from './components/FrameEditor/FrameEditor.vue';
import SelectTools from './components/SelectTools/SelectTools.vue';

// 头像框库：左栏是「给谁戴」和分类，中间是格子，右栏是试戴的样子和按钮。
// 点格子只是试戴，按右下角的按钮才真的戴上、取下（给分组挑时是设给这个分组）。
// 段位、特别两类跟着段位走：能看、能试戴，不能手动佩戴，也不能设给分组。成就、兑换两类还没有，点进去是「敬请期待」。
// 自定义的是用户自己做的（写下想法，让 AI 生成代码，贴回来）：「新建」和编辑时中栏、右栏换成编辑区（FrameEditor）；
// 选着一个自定义的头像框时，右栏底下多三个小按钮：编辑代码、导出、删除；还能批量导出。
const ME = 'me';
// 左栏的先后（用户定的）：全部、段位、特别、常规、成就、兑换、自定义。
const CATEGORIES = [
  { id: 'all', label: 'frameCatAll' },
  { id: 'ranks', label: 'frameCatRanks', note: 'frameCatRanksNote' },
  { id: 'special', label: 'frameCatSpecial', note: 'frameCatSpecialNote' },
  { id: 'decor', label: 'frameCatDecor', note: 'frameCatDecorNote' },
  { id: 'achieve', label: 'frameCatAchieve', soon: 'frameSoonAchieve' },
  { id: 'shop', label: 'frameCatShop', soon: 'frameSoonShop' },
  { id: 'custom', label: 'frameCatCustom', note: 'frameCatCustomNote' },
];
// 「全部」里有的种类，先后和左栏一样：段位、特别、常规、自定义（「不使用」那一格仍在最前面）。
const ALL_KINDS = ['ranks', 'special', 'decor', 'custom'];
const KIND_LABELS = {
  ranks: 'locFrameKindRank',
  special: 'locFrameKindSpecial',
  decor: 'locFrameKindBuiltin',
  custom: 'frameKindCustom',
};
// 格子底下的名字：段位的长名字用原站的缩写，管理员写「管理员」。
const SHORT = { cm: 'CM', im: 'IM', gm: 'GM', igm: 'IGM', lgm: 'LGM' };

const overlay = ref(null);
// 打开时登录着的账号；弹窗开着的这段时间里按它读写。没登录时只能给自己挑。
const owner = ref('');
const account = shallowRef(null);
const target = ref(ME);
const category = ref('all');
// 正在试戴的头像框；空的是「不使用」。
const picked = ref('');
const query = ref('');
const profilesSeen = ref(0);
watchChosenFrames();

// 分组：开着分组功能时才能给分组挑。
const groups = computed(() =>
  appSettings.groups.enabled && account.value ? listGroups(account.value) : [],
);
const groupOf = (id) => groups.value.find((group) => group.id === id);
const groupName = (group) => (group?.builtin ? t('groupsFriends') : group?.name || '');
function reload() {
  account.value = owner.value ? readAccount(owner.value) : null;
  // 正给它挑的分组被删了（比如在别的标签页里），回到我自己。
  if (target.value !== ME && !groupOf(target.value)) target.value = ME;
}

// 头像：我自己的；给分组挑时用第一个读到头像的成员。都没有时格子里是浅灰的圆。
const profile = (handle) => (profilesSeen.value >= 0 && handle ? profileOf(handle) : null);
function pictureOf(handle) {
  const found = profile(handle);
  return found && !found.missing ? found.fallback || found.avatar || '' : '';
}
const picture = computed(() => {
  if (target.value === ME) return pictureOf(owner.value);
  if (!account.value) return '';
  for (const handle of membersOf(account.value, target.value)) {
    const found = pictureOf(handle);
    if (found) return found;
  }
  return '';
});

// 挑了的：我自己从库里戴的、分组设的（不认识的、段位和特别款都当作没挑）。
const usable = (id) => (wearableFrame(id) ? id : '');
const chosenOf = (id) =>
  id === ME ? usable(appSettings.user.avatar.wornFrame) : usable(groupOf(id)?.frame || '');
// 我自己实际戴着的：库里戴的、所在分组的、段位的，按 choose.js 的先后。
const myFrame = computed(() => {
  if (!owner.value) return chosenOf(ME);
  const found = profile(owner.value);
  const live = found && !found.missing ? found : null;
  return chooseFrame({
    ...chosenFrames(owner.value),
    rank: live?.rank,
    maxRank: live?.maxRank,
    mode: appSettings.user.avatar.rankFrame,
    known: KNOWN_FRAMES,
  });
});
const wornOf = (id) => (id === ME ? myFrame.value : chosenOf(id));

// 「给谁戴」的列表：我自己，然后是分组。
const targets = computed(() => [
  {
    id: ME,
    name: t('frameTargetMe'),
    sub: owner.value,
    picture: pictureOf(owner.value),
    frame: myFrame.value,
  },
  ...groups.value.map((group) => ({
    id: group.id,
    name: groupName(group),
    sub: t('groupsMemberCount', group.count),
    group,
    frame: chosenOf(group.id),
  })),
]);
function chooseTarget(id) {
  target.value = id;
  picked.value = wornOf(id);
}

// —— 分类和格子 ——
const frameName = (id) => frameIntro(id, appSettings.general.lang)[0] || t('frameUnnamed');
const tileLabel = (id) => (id === 'headquarters' ? t('locFrameAdmin') : SHORT[id] || frameName(id));
function framesIn(id) {
  const words = query.value.trim().toLowerCase();
  return (id === 'all' ? ALL_KINDS : [id])
    .flatMap((kind) => framesOfKind(kind))
    .filter(
      (frame) => !words || frameName(frame).toLowerCase().includes(words) || frame.includes(words),
    );
}
const current = computed(() => CATEGORIES.find((item) => item.id === category.value));
// 这一类的格子：「全部」「常规」最前面是「不使用」；「自定义」最后是「新建」那一格（批量导出时没有）。
const tiles = computed(() => {
  const id = category.value;
  const list = framesIn(id).map((frame) => ({ key: frame, frame }));
  if ((id === 'all' || id === 'decor') && !query.value.trim())
    list.unshift({ key: ':none', frame: '' });
  if (id === 'custom' && !selecting.value) list.push({ key: ':add', add: true });
  return list;
});
// 刚保存、刚改过还没点开过的自定义头像框：'new'、'edit'。
const markOf = (id) => customFrame(id)?.mark || '';
const MARK_LABELS = { new: 'frameMarkNew', edit: 'frameMarkEdit' };
// 格子右上角的小牌子：给谁挑，就标出它现在实际用着的那一格；什么都没用时标在「不使用」上（写「当前」）。
// 别的格子上是「新」「改」。
function badgeOf(tile) {
  if (tile.add) return '';
  const worn = wornOf(target.value);
  if (!tile.frame) return worn ? '' : t('frameCurrent');
  if (tile.frame === worn) return t('locFrameWorn');
  return markOf(tile.frame) ? t(MARK_LABELS[markOf(tile.frame)]) : '';
}
const toneOf = (tile) =>
  tile.frame && tile.frame !== wornOf(target.value) ? markOf(tile.frame) : '';
// 点一格：试戴它。挂着「新」「改」的点开后去掉；上面那行「已保存」收起。批量导出、批量删除时是选上、不选。
function clickTile(tile) {
  if (tile.add) return openEditor('');
  picked.value = tile.frame;
  if (selecting.value) {
    const next = new Set(selectedFrames.value);
    next.has(tile.frame) ? next.delete(tile.frame) : next.add(tile.frame);
    selectedFrames.value = next;
    return;
  }
  if (markOf(tile.frame)) seeCustomFrame(tile.frame);
  savedShown.value = false;
}

// —— 自定义：新建、编辑，保存之后 ——
// 编辑区开着时是 { frameId }（新建时是空串），关着是 null。从「全部」里编辑也换到「自定义」：
// 左栏选中的那一块滑过去，编辑区左上角写的也是「自定义」，返回时回到这一类。
const editor = shallowRef(null);
const editorView = ref(null);
// 离开编辑区（左上角返回、换分类、关上弹窗）之前：有没保存的内容（想法或者改过的代码）先问一下，确定了才 go；
// 取消就留在编辑区。编辑区没开着时直接 go。
function leaveEditor(go) {
  if (!editor.value || !editorView.value?.unsaved()) return go();
  showConfirmPop({
    title: () => t('frameLeaveTitle'),
    message: () => t('frameLeaveConfirm'),
    confirmText: () => t('frameLeave'),
    type: 'warning',
    onConfirm: go,
  });
}
leaving = leaveEditor;
const backToGrid = () => leaveEditor(() => (editor.value = null));
function openEditor(frameId) {
  selecting.value = false;
  savedShown.value = false;
  announce = false;
  category.value = 'custom';
  editor.value = { frameId };
}
// 保存了：回到「自定义」的格子，试戴刚保存的第一个；平时那行说明下面多一行「已保存……」，
// 等格子淡入之后再展开，点开任意一个头像框后收起。只在刚保存完回来的这一次展开：
// 没保存、从左上角返回的不说（saved 还留着上一次保存的，announce 记着这次回来是不是刚保存的）。
const saved = shallowRef(null);
const savedShown = ref(false);
let announce = false;
function onSaved({ ids, kind }) {
  editor.value = null;
  category.value = 'custom';
  query.value = '';
  picked.value = ids[0] || '';
  saved.value = { ids, kind };
  announce = true;
}
function onViewEntered() {
  if (editor.value || !announce) return;
  announce = false;
  savedShown.value = true;
}
// 「已保存……」的文字：名字跟着语言走，所以存的是编号，显示时现取。
const savedText = computed(() => {
  const { ids = [], kind } = saved.value || {};
  if (kind === 'many') return t('frameSavedMany', ids.length);
  return t(kind === 'edit' ? 'frameSavedEdit' : 'frameSavedOne', frameName(ids[0]));
});

// —— 自定义：批量导出、批量删除 ——
// 两种共用一套选择界面：顶上一行换成「已选 N 个 · 全选 · 退出」，最右边是这一种的按钮（导出选中的 / 删除选中的），
// 说明换成这一种怎么选，点格子选上、不选。selectMode 是哪一种。
const selecting = ref(false);
const selectMode = ref('export');
const selectedFrames = ref(new Set());
const exportable = computed(() => framesIn('custom'));
function startSelecting(mode) {
  selectMode.value = mode;
  selecting.value = true;
  selectedFrames.value = new Set();
  savedShown.value = false;
}
// 复制到剪贴板。done 是复制好了以后做的（按钮变绿、出气泡）。
function copyText(text, done) {
  navigator.clipboard
    .writeText(text)
    .then(done)
    .catch((error) => console.error('Colorforces: copy failed', error));
}
// 导出选中的：按钮变绿，写「已复制 N 个」，2 秒后变回来。
const exportedCount = ref(0);
let exportTimer = 0;
function exportChosen() {
  const ids = [...selectedFrames.value];
  if (!ids.length) return;
  copyText(exportCustomFrames(ids), () => {
    exportedCount.value = ids.length;
    clearTimeout(exportTimer);
    exportTimer = setTimeout(() => (exportedCount.value = 0), 2000);
  });
}
// 右栏底下的三个小按钮：编辑代码、导出（图标换成绿勾，上面浮起「已复制代码」）、删除（先问一下）。
const exportedOne = ref('');
let exportOneTimer = 0;
function exportOne(id) {
  copyText(exportCustomFrames([id]), () => {
    exportedOne.value = id;
    clearTimeout(exportOneTimer);
    exportOneTimer = setTimeout(() => (exportedOne.value = ''), 1800);
  });
}
// 删掉几个：选着的里面去掉它们；自己正戴着其中一个时一起摘下（设给分组的不用管，认不出来的头像框当作没设）；
// 右栏正试戴着的被删了，换回现在戴着的。
function dropFrames(ids) {
  const gone = new Set(ids);
  removeCustomFrames(ids);
  if ([...selectedFrames.value].some((id) => gone.has(id)))
    selectedFrames.value = new Set([...selectedFrames.value].filter((id) => !gone.has(id)));
  if (gone.has(appSettings.user.avatar.wornFrame)) setSetting('user.avatar.wornFrame', '');
  if (gone.has(picked.value)) picked.value = wornOf(target.value);
}
function askRemove(id) {
  const worn = appSettings.user.avatar.wornFrame === id;
  showConfirmPop({
    title: () => t('frameDeleteTitle', frameName(id)),
    message: () => t('frameDeleteConfirm', worn),
    confirmText: () => t('frameDelete'),
    type: 'danger',
    onConfirm: () => dropFrames([id]),
  });
}
// 删除选中的：先问一下，删完退出选择。
function askRemoveChosen() {
  const ids = [...selectedFrames.value];
  if (!ids.length) return;
  const worn = ids.includes(appSettings.user.avatar.wornFrame);
  showConfirmPop({
    title: () => t('frameDeleteManyTitle', ids.length),
    message: () => t('frameDeleteManyConfirm', worn),
    confirmText: () => t('frameDelete'),
    type: 'danger',
    onConfirm: () => {
      dropFrames(ids);
      selecting.value = false;
    },
  });
}

// —— 格子：删掉的那一格淡出，旁边的格子同时滑过去补上 ——
// 删掉的那一格要先从排版里拿出来（绝对定位、钉在原处），别的格子才能在它淡出的同时滑过去；不然要等它淡完才一下子挪。
function pinLeaving(element) {
  const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = element;
  Object.assign(element.style, {
    position: 'absolute',
    left: offsetLeft + 'px',
    top: offsetTop + 'px',
    width: offsetWidth + 'px',
    height: offsetHeight + 'px',
    margin: '0',
  });
}

// —— 说明换字（平时的说明 / 批量时怎么选）：高度从旧的滑到新的，下面的格子跟着平滑挪 ——
// 说明是先淡出旧的、再淡入新的；旧的走之前把高度钉住，新的进来时再从钉住的高度滑到新的高度。
const notes = ref(null);
let notesFrom = 0;
let notesMotion = null;
function holdNotes() {
  const box = notes.value;
  if (!box) return;
  notesMotion?.cancel();
  notesFrom = box.offsetHeight;
  box.style.height = notesFrom + 'px';
}
function growNotes() {
  const box = notes.value;
  if (!box) return;
  box.style.height = '';
  const to = box.offsetHeight;
  if (!box.animate || matchMedia('(prefers-reduced-motion: reduce)').matches || to === notesFrom)
    return;
  box.style.overflow = 'hidden';
  notesMotion = box.animate([{ height: notesFrom + 'px' }, { height: to + 'px' }], {
    duration: 250,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  });
  notesMotion.onfinish = notesMotion.oncancel = () => (box.style.overflow = '');
}
const pickedCustom = computed(() => frameKind(picked.value) === 'custom');

// —— 试戴和按钮 ——
const preview = computed(() => {
  const id = picked.value;
  if (!id)
    return {
      name: t('locFrameNone'),
      kind: '',
      author: '',
      edition: 0,
      intro: t(target.value === ME ? 'locFrameNoneIntro' : 'frameNoneIntroGroup'),
    };
  const [name, intro] = frameIntro(id, appSettings.general.lang);
  const kind = KIND_LABELS[frameKind(id)];
  const { author = '', edition = 0 } = frameCredit(id) || {};
  return { name: name || t('frameUnnamed'), kind: kind ? t(kind) : '', author, edition, intro };
});
// 右下角那一行：左边是理由或状态（locked 时前面一把小锁），右边一个按钮（act 为空时灰掉）。
const action = computed(() => {
  const id = picked.value;
  const mine = target.value === ME;
  const chosen = chosenOf(target.value);
  // 按钮只写动作，不带分组名：给谁设写在左栏顶上「给谁戴」和最底下一行里，分组名长了也不会把按钮撑开。
  const wear = mine ? t('frameWear') : t('frameSetGroup');
  const takeOff = t('frameTakeOff');
  // 「不使用」也是一个可以戴上（设给分组）的选择：按钮和别的头像框一样写「佩戴」（「设给分组」），点了就是什么都不戴。
  // 现在本来就没挑（已经是「不使用」）时灰掉。
  if (!id)
    return chosen
      ? { why: '', label: wear, act: 'off' }
      : { why: t('frameWhyNothing'), label: wear };
  if (!wearableFrame(id)) {
    if (!mine) return { why: t('frameWhyGroupRank'), locked: true, label: wear };
    if (myFrame.value === id) return { why: t('frameWhyWornRank'), label: wear };
    return { why: t('frameWhyRank'), locked: true, label: wear };
  }
  if (chosen === id)
    return {
      why: mine ? t('locFrameWorn') : t('frameWhyGroupUsing'),
      label: takeOff,
      act: 'off',
      plain: true,
    };
  // 我自己没从库里挑、但所在的分组设了它：现在其实已经戴着了，点了是改成自己戴。
  return {
    why: mine && myFrame.value === id ? t('frameWhyWornGroup') : '',
    label: wear,
    act: 'wear',
  };
});
// 理由只占一行，放不下时省略；鼠标移上去提示全文。
function showWhy(event) {
  const text = event.currentTarget.lastElementChild;
  if (text && isTruncated(text)) tooltip.show(event.currentTarget, action.value.why);
}
function act(kind) {
  const value = kind === 'wear' ? picked.value : '';
  if (target.value === ME) setSetting('user.avatar.wornFrame', value);
  else changeAccount(owner.value, (own) => editGroup(own, target.value, { frame: value }) || false);
}

// 弹窗最底下一行：现在戴着哪个。我自己没从库里挑时，写上是跟着段位还是分组的。
const now = computed(() => {
  const id = wornOf(target.value);
  const mine = target.value === ME;
  let from = '';
  if (mine && id && id !== chosenOf(ME))
    from = t(wearableFrame(id) ? 'frameNowByGroup' : 'frameNowByRank');
  return {
    lead: mine ? t('frameNowMe') : t('frameNowGroup', groupName(groupOf(target.value))),
    id,
    name: (id ? frameName(id) : t('locFrameNone')) + from,
  };
});

// —— 左栏选中的那一块：换分类时滑过去（和分组管理弹窗一样）；打开时直接到位 ——
const side = ref(null),
  sideMark = ref(null);
let sideSpot = null;
function placeSideMark(animate = true) {
  const mark = sideMark.value;
  const row = side.value?.querySelector('.cf-frame-side-row.active');
  if (!mark || !row) return;
  const spot = { top: row.offsetTop, height: row.offsetHeight };
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
watch(category, () => nextTick(() => placeSideMark()));
// 换了分类：退出批量导出；编辑区开着时回到格子（不保存）；「已保存……」只在刚保存完的「自定义」里有。
watch(category, (id) => {
  selecting.value = false;
  if (id === 'custom') return;
  editor.value = null;
  savedShown.value = false;
});
// 换了分类（或者给谁挑）：格子那一栏淡出后回到最上面，再淡入新的。
const main = ref(null);
const toTop = () => main.value && (main.value.scrollTop = 0);

// 只有右上角的 × 和下面的「完成」能关，和分组管理弹窗一样。
const close = () => leaveEditor(() => (request.value = null));
// 点左栏的分类：编辑区开着时（那时在「自定义」里）换到别的分类就是离开编辑区。
function pickCategory(id) {
  if (id !== category.value) leaveEditor(() => (category.value = id));
}
let stopGroups, stopProfiles;
watch(request, (value) => {
  if (!value) return;
  owner.value = getCurrentUserHandle() || '';
  reload();
  target.value = value.target !== ME && groupOf(value.target) ? value.target : ME;
  category.value = 'all';
  query.value = '';
  picked.value = wornOf(target.value);
  editor.value = null;
  selecting.value = false;
  saved.value = null;
  savedShown.value = false;
  announce = false;
  sideSpot = null;
  if (owner.value) {
    requestProfiles([owner.value]).catch(() => {});
    if (appSettings.groups.enabled) refreshMembers(owner.value);
  }
  nextTick(() => placeSideMark(false));
});
watch(overlay, (node) => {
  if (node) preventScrollChaining(node);
});
onMounted(() => {
  stopGroups = subscribeGroups(() => request.value && reload());
  stopProfiles = subscribeProfiles(() => profilesSeen.value++);
});
onBeforeUnmount(() => {
  stopGroups?.();
  stopProfiles?.();
  clearTimeout(exportTimer);
  clearTimeout(exportOneTimer);
  leaving = (go) => go();
  request.value = null;
});
</script>
<template>
  <Teleport to="body"
    ><DialogTransition
      ><div
        class="cf-clist-modal-overlay cf-aurora-dialog cf-frame-modal"
        v-if="request"
        ref="overlay"
      >
        <div class="cf-clist-modal-card cf-aurora-card cf-frame-card">
          <div class="cf-clist-modal-header">
            <div class="cf-clist-modal-title">
              <span
                class="cf-modal-title-icon cf-aurora-emblem"
                :style="{ '--cf-emblem-petal': menuTabColor('user') }"
                ><InlineSvg :source="assets.menuUserIcon"
              /></span>
              <span>{{ t('frameDialogTitle') }}</span>
            </div>
            <button type="button" class="cf-modal-close-btn cf-aurora-close" @click="close">
              ×
            </button>
          </div>
          <div class="cf-frame-dialog-body">
            <!-- 左栏：给谁戴，下面是分类。 -->
            <div class="cf-frame-dialog-side">
              <FrameTarget
                :options="targets"
                :model-value="target"
                @update:model-value="chooseTarget"
              />
              <div class="cf-frame-side-label">{{ t('frameCategoryLabel') }}</div>
              <div ref="side" class="cf-frame-side-list cf-scrollbar">
                <span ref="sideMark" class="cf-frame-side-mark" aria-hidden="true"></span>
                <button
                  v-for="item in CATEGORIES"
                  :key="item.id"
                  type="button"
                  class="cf-frame-side-row"
                  :class="{ active: category === item.id, 'is-soon': item.soon }"
                  @click="pickCategory(item.id)"
                >
                  <span class="cf-frame-side-icon"
                    ><InlineSvg :source="assets.FRAME_ICONS[item.id]"
                  /></span>
                  <span class="cf-frame-side-name">{{ t(item.label) }}</span>
                  <span class="cf-frame-side-count">{{
                    item.soon ? '' : framesIn(item.id).length
                  }}</span>
                </button>
              </div>
            </div>
            <!-- 中栏和右栏：平时是格子和试戴；新建、编辑自定义头像框时整块换成编辑区，淡出淡入。 -->
            <Transition name="cf-frame-fade" mode="out-in" @after-enter="onViewEntered">
              <FrameEditor
                v-if="editor"
                ref="editorView"
                :key="'editor:' + editor.frameId"
                :frame-id="editor.frameId"
                :picture="picture"
                @back="backToGrid"
                @saved="onSaved"
              />
              <div v-else key="grid" class="cf-frame-view">
                <!-- 中间：搜索、这一类的说明、格子。自定义的那一类左上角还有「批量导出」，批量导出时这一行换成选择工具。 -->
                <div ref="main" class="cf-frame-dialog-main cf-scrollbar">
                  <div class="cf-frame-dialog-tools">
                    <Transition name="cf-frame-fade" mode="out-in">
                      <SelectTools
                        v-if="selecting"
                        key="select"
                        :count="selectedFrames.size"
                        :total="exportable.length"
                        @all="selectedFrames = new Set(exportable)"
                        @none="selectedFrames = new Set()"
                        @exit="selecting = false"
                      >
                        <button
                          v-if="selectMode === 'export'"
                          type="button"
                          class="cf-aurora-btn cf-aurora-btn--soft cf-frame-small cf-frame-copy"
                          :class="{ 'is-copied': exportedCount }"
                          :disabled="!selectedFrames.size"
                          @click="exportChosen"
                        >
                          <Transition name="cf-frame-fade" mode="out-in"
                            ><InlineSvg
                              :key="exportedCount ? 'done' : 'copy'"
                              :source="
                                exportedCount
                                  ? assets.FRAME_EDITOR_ICONS.check
                                  : assets.USER_MENU_ICONS.copy
                              "
                          /></Transition>
                          <SmoothText
                            :text="
                              exportedCount
                                ? t('frameExportedCount', exportedCount)
                                : t('frameExportChosen')
                            "
                          />
                        </button>
                        <button
                          v-else
                          type="button"
                          class="cf-aurora-btn cf-aurora-btn--soft cf-frame-small cf-frame-delete-chosen"
                          :disabled="!selectedFrames.size"
                          @click="askRemoveChosen"
                        >
                          <InlineSvg :source="assets.dialogDeleteIcon" />{{
                            t('frameDeleteChosen')
                          }}
                        </button>
                      </SelectTools>
                      <span v-else key="plain" class="cf-frame-tools-plain">
                        <Transition name="cf-frame-fade">
                          <span v-if="category === 'custom'" class="cf-frame-batch">
                            <button
                              type="button"
                              class="cf-aurora-btn cf-aurora-btn--soft cf-frame-small"
                              :disabled="!exportable.length"
                              @click="startSelecting('export')"
                            >
                              <InlineSvg :source="assets.USER_MENU_ICONS.copy" />{{
                                t('frameBatchExport')
                              }}
                            </button>
                            <button
                              type="button"
                              class="cf-aurora-btn cf-aurora-btn--soft cf-frame-small"
                              :disabled="!exportable.length"
                              @click="startSelecting('delete')"
                            >
                              <InlineSvg :source="assets.dialogDeleteIcon" />{{
                                t('frameBatchDelete')
                              }}
                            </button>
                          </span>
                        </Transition>
                        <input
                          v-model="query"
                          class="cf-frame-search"
                          type="search"
                          :placeholder="t('frameSearch')"
                        />
                      </span>
                    </Transition>
                  </div>
                  <Transition name="cf-frame-fade" mode="out-in" @after-leave="toTop">
                    <div :key="category + ':' + target">
                      <div v-if="current.soon" class="cf-frame-soon">
                        <span class="cf-frame-soon-icon"
                          ><InlineSvg :source="assets.FRAME_ICONS[current.id]"
                        /></span>
                        <b>{{ t('frameSoonTitle') }}</b>
                        <!-- 说明分段写（词条里用换行隔开），每段一个 p。分了段的（兑换）靠左排，方便读；只有一句的（成就）照旧居中。 -->
                        <div
                          class="cf-frame-soon-text"
                          :class="{ 'is-long': t(current.soon).includes('\n') }"
                        >
                          <p v-for="(line, index) in t(current.soon).split('\n')" :key="index">
                            {{ line }}
                          </p>
                        </div>
                      </div>
                      <template v-else>
                        <!-- 这一类的说明；自定义的批量导出时换成怎么选。保存之后它下面多一行「已保存……」。 -->
                        <div v-if="current.note" ref="notes" class="cf-frame-notes">
                          <Transition
                            name="cf-frame-fade"
                            mode="out-in"
                            @before-leave="holdNotes"
                            @enter="growNotes()"
                          >
                            <div
                              :key="selecting ? 'select:' + selectMode : 'note'"
                              class="cf-frame-note"
                            >
                              {{
                                selecting
                                  ? t(
                                      selectMode === 'delete'
                                        ? 'frameSelectDeleteNote'
                                        : 'frameSelectNote',
                                    )
                                  : t(current.note)
                              }}
                            </div>
                          </Transition>
                          <ExpandTransition v-if="category === 'custom'" :show="savedShown">
                            <div class="cf-frame-saved">
                              <InlineSvg :source="assets.FRAME_EDITOR_ICONS.check" /><span>{{
                                savedText
                              }}</span>
                            </div>
                          </ExpandTransition>
                        </div>
                        <TransitionGroup
                          name="cf-frame-tiles"
                          tag="div"
                          class="cf-frame-grid"
                          @before-leave="pinLeaving"
                        >
                          <FrameTile
                            v-for="tile in tiles"
                            :key="tile.key"
                            :frame="tile.frame"
                            :add="tile.add"
                            :picture="picture"
                            :label="
                              tile.add
                                ? t('frameNew')
                                : tile.frame
                                  ? tileLabel(tile.frame)
                                  : t('locFrameNone')
                            "
                            :picked="!tile.add && picked === tile.frame"
                            :badge="badgeOf(tile)"
                            :tone="toneOf(tile)"
                            :mark="tile.add ? '' : markOf(tile.frame)"
                            :chosen="selecting && !tile.add ? selectedFrames.has(tile.frame) : null"
                            @click="clickTile(tile)"
                          />
                        </TransitionGroup>
                        <div
                          v-if="
                            category === 'custom' && !framesIn('custom').length && !query.trim()
                          "
                          class="cf-frame-note is-after"
                        >
                          {{ t('frameCustomEmpty') }}
                        </div>
                        <div v-else-if="!tiles.length" class="cf-frame-note is-after">
                          {{ t('frameNoMatch') }}
                        </div>
                      </template>
                    </div>
                  </Transition>
                </div>
                <!-- 右栏：试戴的样子，最下面一行是理由和按钮。 -->
                <div class="cf-frame-dialog-aside">
                  <FramePreview
                    :frame="picked"
                    :picture="picture"
                    :name="preview.name"
                    :kind="preview.kind"
                    :author="preview.author"
                    :edition="preview.edition"
                    :intro="preview.intro"
                  >
                    <template #foot>
                      <!-- 自定义的：左边三个小按钮（编辑代码、导出、删除），不写理由；导出后图标换成绿勾，上面浮起「已复制代码」。 -->
                      <Transition name="cf-frame-fade" mode="out-in">
                        <span
                          v-if="pickedCustom"
                          key="tools"
                          class="cf-frame-tools"
                          :class="{ 'is-copied': exportedOne === picked }"
                        >
                          <button
                            type="button"
                            class="cf-frame-icon-btn"
                            :data-tooltip="t('frameEditCode')"
                            @click="openEditor(picked)"
                          >
                            <InlineSvg :source="assets.USER_MENU_ICONS.quill" />
                          </button>
                          <button
                            type="button"
                            class="cf-frame-icon-btn cf-frame-export"
                            :data-tooltip="t('frameExportCode')"
                            @click="exportOne(picked)"
                          >
                            <Transition name="cf-frame-fade" mode="out-in"
                              ><InlineSvg
                                :key="exportedOne === picked ? 'done' : 'copy'"
                                :source="
                                  exportedOne === picked
                                    ? assets.FRAME_EDITOR_ICONS.check
                                    : assets.USER_MENU_ICONS.copy
                                "
                            /></Transition>
                            <span class="cf-frame-export-bubble">{{ t('frameCodeCopied') }}</span>
                          </button>
                          <button
                            type="button"
                            class="cf-frame-icon-btn is-danger"
                            :data-tooltip="t('frameDelete')"
                            @click="askRemove(picked)"
                          >
                            <InlineSvg :source="assets.dialogDeleteIcon" />
                          </button>
                        </span>
                        <span
                          v-else
                          :key="action.why"
                          class="cf-frame-why"
                          @mouseenter="showWhy"
                          @mouseleave="tooltip.hide()"
                          ><InlineSvg
                            v-if="action.why && action.locked"
                            :source="assets.FRAME_ICONS.lock"
                          /><span>{{ action.why }}</span></span
                        >
                      </Transition>
                      <button
                        type="button"
                        class="cf-aurora-btn cf-frame-act"
                        :class="{ 'cf-aurora-btn--soft': !action.plain }"
                        :disabled="!action.act"
                        @click="act(action.act)"
                      >
                        <SmoothText :text="action.label" />
                      </button>
                    </template>
                  </FramePreview>
                </div>
              </div>
            </Transition>
          </div>
          <div class="cf-frame-dialog-foot">
            <span class="cf-frame-now">
              <SmoothText :text="now.lead" />
              <span class="cf-frame-now-face cf-frame-host"
                ><img v-if="picture" :src="picture" alt="" /><AvatarFrame :frame="now.id"
              /></span>
              <b><SmoothText :text="now.name" /></b>
            </span>
            <button type="button" class="cf-aurora-btn cf-aurora-btn--primary" @click="close">
              {{ t('groupsDone') }}
            </button>
          </div>
        </div>
      </div></DialogTransition
    ></Teleport
  >
</template>
<style>
/* 头像框库：外壳与配色来自幻彩主题，这里只写本弹窗的布局。 */
.cf-clist-modal-card.cf-frame-card {
  width: 880px;
  height: 580px;
  max-height: 88vh;
}
.cf-frame-dialog-body {
  display: grid;
  grid-template-columns: 172px 1fr;
  flex: 1;
  min-height: 0;
  color: var(--cf-aurora-text);
  font-size: var(--cf-font-size-base);
}
/* 中栏和右栏合成一块（格子和试戴，或者编辑区），整块换的时候一起淡出淡入。 */
.cf-frame-view {
  display: grid;
  grid-template-columns: 1fr 290px;
  min-width: 0;
  min-height: 0;
}
/* 左栏：给谁戴（不滚动，点开的列表要能伸到中间那一栏上），下面的分类可以滚。 */
.cf-frame-dialog-side {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px 8px;
  border-right: 1px solid var(--cf-surface-border);
}
.cf-frame-side-label {
  padding: 8px 8px 4px;
  border-top: 1px solid var(--cf-surface-border);
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-2xs);
}
.cf-frame-side-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
  overflow-y: auto;
}
/* 选中的那一块垫在分类底下，换分类时滑过去；选中的分类自己不再画底色。 */
.cf-frame-side-mark {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
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
.cf-frame-side-row {
  position: relative;
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
  line-height: 20px;
  text-align: left;
  cursor: pointer;
  transition:
    background-color var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease;
}
/* 悬停：半透明的主题色（实色的 --cf-card-hover 在弹窗偏蓝的左上角几乎看不出来）。 */
.cf-frame-side-row:hover {
  background: color-mix(in srgb, var(--cf-menu-accent) 12%, transparent);
}
.cf-frame-side-row.active,
.cf-frame-side-row.active:hover {
  background: none;
  color: var(--cf-control-ink);
  font-weight: var(--cf-font-weight-semibold);
}
.cf-frame-side-row.is-soon:not(.active) {
  color: var(--cf-aurora-muted);
}
.cf-frame-side-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 18px;
  height: 18px;
  color: var(--cf-aurora-muted);
  transition: color var(--cf-duration-fast) ease;
}
.cf-frame-side-row.active .cf-frame-side-icon {
  color: var(--cf-control-ink);
}
.cf-frame-side-icon svg {
  display: block;
  width: 16px;
  height: 16px;
}
.cf-frame-side-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cf-frame-side-count {
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
  font-weight: normal;
  font-variant-numeric: tabular-nums;
}
/* 中间：格子。 */
/* 中栏：右边一直给滚动条留着位置（滚动条 10px，右边距相应减成 4px，没有滚动条时和原来一样宽），
   内容变高、出现滚动条时里面的东西不会一下子被挤窄。 */
.cf-frame-dialog-main {
  min-width: 0;
  padding: 12px 4px 12px 14px;
  overflow-y: auto;
  scrollbar-gutter: stable;
}
.cf-frame-dialog-tools {
  display: flex;
  justify-content: flex-end;
  min-height: 28px;
  margin-bottom: 8px;
}
/* 平时那一行：自定义的左边是「批量导出」，搜索总在右边。 */
.cf-frame-tools-plain {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.cf-frame-tools-plain .cf-frame-search {
  margin-left: auto;
}
/* 小一号的淡色按钮：批量导出、全选、退出、导出选中的、批量保存。 */
.cf-aurora-btn.cf-frame-small {
  height: 28px;
  padding: 0 12px;
  font-size: var(--cf-font-size-xs);
}
.cf-aurora-btn.cf-frame-small svg {
  flex: none;
  width: 13px;
  height: 13px;
}
.cf-frame-search {
  width: 180px;
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--cf-surface-border);
  border-radius: 999px;
  outline: none;
  background: var(--cf-control-surface);
  box-sizing: border-box;
  color: var(--cf-aurora-text);
  font: inherit;
  font-size: var(--cf-font-size-base);
  transition:
    border-color var(--cf-duration-fast) ease,
    box-shadow var(--cf-duration-fast) ease;
}
.cf-frame-search:focus {
  border-color: color-mix(in srgb, var(--cf-menu-accent) 60%, var(--cf-surface-border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--cf-menu-accent) 18%, transparent);
}
.cf-frame-note {
  margin: -2px 0 8px;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
}
.cf-frame-note.is-after {
  margin: 6px 0 0;
}
/* 说明和它下面的「已保存……」一起占这一块的边距：「已保存」收起时高度和上边的空隙一起收到 0，格子不跳。 */
.cf-frame-notes {
  margin: -2px 0 8px;
}
.cf-frame-notes .cf-frame-note {
  margin: 0;
}
.cf-frame-saved {
  display: flex;
  align-items: center;
  gap: 5px;
  padding-top: 4px;
  color: #2f8f63;
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-semibold);
}
.cf-frame-saved svg {
  flex: none;
  width: 14px;
  height: 14px;
}
.cf-frame-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
  gap: 6px;
  align-content: start;
}
/* 搜索时新出现的格子淡入，删掉的格子淡出、缩一点，留下的滑到新位置。
   写成 .cf-frame-tile.…：格子自己（FrameTile）写了一整条 transition（边框、底色、透明度），和这里一样具体时
   后写的那条会把这里的盖掉，挪位置没有位移的过渡，Vue 就直接跳过滑动。删掉的那一格由 pinLeaving 钉在原处。 */
.cf-frame-grid {
  position: relative;
}
.cf-frame-tile.cf-frame-tiles-move {
  transition: transform var(--cf-duration-moderate) var(--cf-ease-out);
}
.cf-frame-tile.cf-frame-tiles-enter-active,
.cf-frame-tile.cf-frame-tiles-leave-active {
  transition:
    opacity var(--cf-duration-base) ease,
    transform var(--cf-duration-base) var(--cf-ease-out);
}
.cf-frame-tile.cf-frame-tiles-enter-from {
  opacity: 0;
}
.cf-frame-tile.cf-frame-tiles-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
/* 批量导出、批量删除两个按钮挨着。删除选中的：红一点的淡色按钮（灰掉时照常是灰掉的样子）。 */
.cf-frame-batch {
  display: inline-flex;
  gap: 6px;
}
.cf-aurora-btn.cf-frame-delete-chosen:not(:disabled) {
  border-color: #efc3cb;
  background: linear-gradient(135deg, #fdf1f3, #fbe9ef);
  color: #b2404a;
}
.cf-aurora-btn.cf-frame-delete-chosen:not(:disabled):hover {
  border-color: #e3a3ae;
  background: linear-gradient(135deg, #fbe5ea, #f8dde6);
}
/* 敬请期待：花瓣底的大图标，一句说明。 */
.cf-frame-soon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 70px 24px;
  color: var(--cf-aurora-muted);
  text-align: center;
}
/* 说明：只有一句时居中；分了段的靠左排、限一个宽度，块本身还在正中。 */
.cf-frame-soon-text {
  max-width: 380px;
  line-height: 20px;
}
.cf-frame-soon-text.is-long {
  align-self: stretch;
  margin: 4px auto 0;
  text-align: left;
}
.cf-frame-soon-text p {
  margin: 0;
}
.cf-frame-soon-text p + p {
  margin-top: 8px;
}
.cf-frame-soon b {
  color: var(--cf-control-ink);
  font-size: var(--cf-font-size-xl);
  letter-spacing: 0.1em;
}
.cf-frame-soon-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin-bottom: 6px;
  border-radius: 44% 26%;
  background: linear-gradient(135deg, #e3e8fb, #f1ecfa);
  box-shadow: inset 0 1px 0 #fff;
  color: var(--cf-control-ink);
}
.cf-frame-soon-icon svg {
  width: 32px;
  height: 32px;
}
/* 右栏。 */
.cf-frame-dialog-aside {
  min-height: 0;
  padding-top: 14px;
  border-left: 1px solid var(--cf-surface-border);
  background: #ffffff6b;
}
/* 理由：只占一行，放不下时末尾省略（鼠标移上去看全文），给右边的按钮让出位置。 */
.cf-frame-why {
  display: inline-flex;
  flex: 1;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
  line-height: 16px;
}
.cf-frame-why svg {
  flex: none;
  width: 13px;
  height: 13px;
}
.cf-frame-why > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 按钮一样宽（取最宽的「设给分组」），左右内边距也一样，换状态时左边的理由不跟着跳。 */
.cf-aurora-btn.cf-frame-act {
  flex: none;
  min-width: 92px;
  padding-right: 16px;
  padding-left: 16px;
}
/* 选着一个自定义的头像框：右栏底下左边三个小按钮。导出后图标换成绿勾，正上方浮起一个浅绿色的小气泡，按钮都不变大。 */
.cf-frame-tools {
  display: inline-flex;
  flex: 1;
  align-items: center;
  gap: 2px;
  min-width: 0;
}
.cf-frame-icon-btn {
  position: relative;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: var(--cf-radius-md);
  background: none;
  color: var(--cf-aurora-muted);
  cursor: pointer;
  transition:
    background-color var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease;
}
.cf-frame-icon-btn:hover {
  background: color-mix(in srgb, var(--cf-menu-accent) 12%, transparent);
  color: var(--cf-control-ink);
}
.cf-frame-icon-btn.is-danger:hover {
  background: #fdebec;
  color: #b2404a;
}
.cf-frame-icon-btn svg {
  width: 16px;
  height: 16px;
}
.cf-frame-tools.is-copied .cf-frame-export > svg {
  color: #2f9a6b;
}
.cf-frame-export-bubble {
  position: absolute;
  bottom: calc(100% + 9px);
  left: 50%;
  padding: 3px 10px;
  border: 1px solid #b9e5cf;
  border-radius: 999px;
  background: #effaf5;
  box-shadow: 0 8px 16px -10px #2f9a6b80;
  color: #2f8f63;
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-semibold);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 4px);
  transition:
    opacity var(--cf-duration-base) ease,
    transform var(--cf-duration-base) var(--cf-ease-out);
}
.cf-frame-export-bubble::after {
  position: absolute;
  top: 100%;
  left: 50%;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-right: 1px solid #b9e5cf;
  border-bottom: 1px solid #b9e5cf;
  background: #effaf5;
  content: '';
  transform: rotate(45deg);
}
.cf-frame-tools.is-copied .cf-frame-export-bubble {
  opacity: 1;
  transform: translate(-50%, 0);
}
/* 最底下一行：现在戴着哪个。 */
.cf-frame-dialog-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 16px 12px;
  border-top: 1px solid var(--cf-surface-border);
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
}
.cf-frame-now {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.cf-frame-now b {
  color: var(--cf-control-ink);
  font-weight: var(--cf-font-weight-semibold);
}
.cf-frame-now-face {
  position: relative;
  flex: none;
  width: 18px;
  height: 18px;
  margin: 0 9px;
  border-radius: 50%;
  background: var(--cf-gray-100);
}
.cf-frame-now-face > img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.cf-frame-fade-enter-active {
  transition: opacity 160ms ease;
}
.cf-frame-fade-leave-active {
  transition: opacity 100ms ease;
}
.cf-frame-fade-enter-from,
.cf-frame-fade-leave-to {
  opacity: 0;
}
/* 滚动条用公共的 cf-scrollbar（styles/scrollbar.css），左栏、中栏、右栏的介绍、「给谁戴」的列表都挂着它。 */
@media (prefers-reduced-motion: reduce) {
  .cf-frame-fade-enter-active,
  .cf-frame-fade-leave-active,
  .cf-frame-tile.cf-frame-tiles-move,
  .cf-frame-tile.cf-frame-tiles-enter-active,
  .cf-frame-tile.cf-frame-tiles-leave-active,
  .cf-frame-icon-btn,
  .cf-frame-export-bubble {
    transition: none;
  }
}
</style>
