<script setup>
import {
  ref,
  shallowRef,
  reactive,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from 'vue';
import { translate as t } from '../../../../../i18n/index.js';
import { USER_MENU_ICONS } from '../../../../../assets/index.js';
import { appSettings } from '../../../../../settings.js';
import { menuTabColor } from '../../../../../utils/petal-palette.js';
import { preventScrollChaining } from '../../../../../utils/scroll.js';
import { isTruncated } from '../../../../../utils/text-overflow.js';
import InlineSvg from '../../../../components/icons/InlineSvg/InlineSvg.vue';
import { tooltip } from '../../../../components/tooltips/FloatingTooltip/FloatingTooltip.vue';
import { getCurrentUserHandle } from '../../../../../features/page/account.js';
import {
  RATING_RANKS,
  rankForRating,
} from '../../../../../features/contest/rating-prediction/algorithm/ranks.js';
import { DEFAULT_AVATAR_URL } from '../../../../../features/user/avatars/data.js';
import { avatarShownAt } from '../../../../../features/user/avatars/places.js';
import { adminOnPage } from '../../../../../features/user/frames/admins.js';
import { frameReach, measuredReach } from '../../../../../features/user/frames/catalog.js';
import { profileFrame, watchChosenFrames } from '../../../../../features/user/frames/chosen.js';
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
  BLACK_INK,
  TOP_RATING,
  blackFirstLetter,
  nameInk,
} from '../../../../../features/user/groups/progress.js';
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
import { showGroupsDialog } from '../GroupsDialog/GroupsDialog.vue';
import AvatarFrame from '../../../../components/avatars/AvatarFrame/AvatarFrame.vue';
import ExpandTransition from '../../../../components/transitions/ExpandTransition/ExpandTransition.vue';
import RankProgress from './components/RankProgress/RankProgress.vue';
import ProfileStats from './components/ProfileStats/ProfileStats.vue';
import MemoCard from './components/MemoCard/MemoCard.vue';
import { keepWithinLimit } from '../../../../../utils/input-limit.js';

// 用户名上的右键菜单。用户分组开着、又登录着时，右键点页面上的「头像 + 用户名」（见 features/user/groups/targets.js）
// 弹出这个菜单，原站的右键菜单不再出现；原来常用的「在新标签页打开」「复制」在菜单最下面补上（并成一排）。
// 菜单里有这个人的名片：放大的头像连同头像框、名字、段位和评分，到下一档的经验条，最高分、贡献、被关注、注册四项资料。
// 名片有两种排法（设置 groups.menuCard，打开时定下，开着的时候不变）：纵向在菜单项上面；横向是左边一栏，
// 右边是菜单项，备注换成右栏里撑满空处的一张卡片。
// 分组管理弹窗里成员的名字和头像也能右键出这个菜单。

// 正在看的用户：{ handle, href, x, y, key, admin, wide }，x、y 是右键点下的位置，key 每打开一次换一个，
// admin 是这一页上认出他是管理员（接口里查到的是未评级，见 features/user/frames/admins.js），
// wide 是名片横着排（打开时照设置定下）。没打开时是 null。
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
// 管理员照原站的写法：名字和下面那一行是黑色，写 Headquarters，戴管理员的头像框。
// 4000 分以上照原站全黑（见 progress.js），3000～3999 第一个字是黑的。
const admin = computed(() => Boolean(target.value?.admin));
const wide = computed(() => Boolean(target.value?.wide));
// 现在的评分：管理员、未评级、查不到、还没读到的是 null。
const rating = computed(() =>
  !admin.value && profile.value && !profile.value.missing && Number.isFinite(profile.value.rating)
    ? profile.value.rating
    : null,
);
const ink = computed(() => (admin.value ? BLACK_INK : nameInk(rating.value)));
const legendary = computed(() => blackFirstLetter(rating.value));
// 段位名：4000 分以上原站用这个人自己的名字当段位名；未评级的写 Unrated；查不到的写「查无此人」；还没读到时是空的。
const titleCase = (text) => text.replace(/(^|\s)\S/g, (char) => char.toUpperCase());
const rankName = computed(() => {
  const own = profile.value;
  if (!own) return '';
  if (own.missing) return t('groupsNotFound');
  if (admin.value) return 'Headquarters';
  if (rating.value === null) return 'Unrated';
  if (rating.value >= TOP_RATING) return name.value;
  return titleCase(own.rank || rankForRating(rating.value).name);
});
// 名字下面那一行：纵向写「段位 · 评分」；横向只写段位，评分另起一行写大一号。
const rankLine = computed(() =>
  wide.value || rating.value === null ? rankName.value : `${rankName.value} · ${rating.value}`,
);
// 四项资料（旧的缓存里没有时是 undefined，见 groups/profiles.js；打开菜单时补查，见 open）。
// 收起时内容还在（展开、收起有过渡），没有时先放一份空的。
const stats = computed(() =>
  profile.value && !profile.value.missing ? profile.value.stats : undefined,
);
const NO_STATS = { maxRating: null, contribution: 0, friends: 0, registered: 0 };
// 没有四项资料时：到过更高的段位，名片上写一行「最高 …」（段位的颜色；4000 分以上的段位名是本人的名字，全黑）。
const best = computed(() => {
  const own = profile.value;
  if (!own || own.missing || admin.value || !own.maxRank || own.maxRank === own.rank) return null;
  const rank = RATING_RANKS.find(
    (item) => item.name.toLowerCase() === own.maxRank && item.high <= TOP_RATING,
  );
  return rank ? { name: rank.name, ink: rank.color } : { name: own.maxRank, ink: BLACK_INK };
});
// 头像先放小头像：页面上显示过的话浏览器里已经有了，一打开就看得到。小头像打不开时依次试主页大图、原站的默认图。
const sources = computed(() =>
  profile.value && !profile.value.missing
    ? [...new Set([profile.value.avatar, profile.value.fallback, DEFAULT_AVATAR_URL])].filter(
        Boolean,
      )
    : [DEFAULT_AVATAR_URL],
);
const failed = ref(0);
watch(sources, () => (failed.value = 0));
const source = computed(() => sources.value[Math.min(failed.value, sources.value.length - 1)]);
// 这里画得比表格里大，小头像放大了会糊：主页大图另外叠在上面，下载好了淡入盖住小头像。
// 页面上只用小头像，大图是第一次打开这个人的菜单时才下载的。下载好、打不开的记下来：
// 下好过的再打开时直接显示（不再淡入一次），打不开的不再叠。
const sharpLoaded = reactive(new Set()),
  sharpBroken = reactive(new Set());
const sharp = computed(() => {
  const url = profile.value && !profile.value.missing ? profile.value.fallback : '';
  return url && url !== profile.value.avatar && !sharpBroken.has(url) ? url : '';
});
const isSelf = computed(() => Boolean(owner.value) && userId(owner.value) === userId(name.value));

// —— 名片的头：头像放大（纵向 96px、横向 128px）居中，四周按戴着的头像框实际伸出去多少留；底色是很淡的段位色 ——
// 横向的名片那一栏至少 272px 宽，戴着左右伸得宽的头像框时按头像加两边伸出去的撑宽。
const AVATAR = 96,
  WIDE_AVATAR = 128,
  WIDE_COLUMN = 272;
// 头像框伸出头像多少，用画板的单位（头像直径是 80，见 catalog.js 的 frameReach）。没戴时不留；
// 还没量过的先量（很快），量好了留白滑过去；量不了时按画板的边留。
const NO_REACH = { up: 0, down: 0, left: 0, right: 0 };
const EDGE_REACH = { up: 40, down: 40, left: 40, right: 40 };
watchChosenFrames();
const wornFrame = computed(() =>
  avatarShownAt('menus') && appSettings.user.avatar.frameAt.menus !== false
    ? profileFrame(profile.value, admin.value)
    : '',
);
const reach = shallowRef(NO_REACH);
watch(
  wornFrame,
  (id) => {
    if (!id) return (reach.value = NO_REACH);
    const known = measuredReach(id);
    if (known !== undefined) return (reach.value = known || EDGE_REACH);
    frameReach(id).then((measured) => {
      if (wornFrame.value === id) reach.value = measured || EDGE_REACH;
    });
  },
  { immediate: true },
);
const cardStyle = computed(() => {
  const size = wide.value ? WIDE_AVATAR : AVATAR;
  const pixels = (units) => Math.ceil(((units || 0) * size) / 80);
  const style = {
    '--cf-user-menu-tint': ink.value,
    '--cf-user-menu-up': pixels(reach.value.up) + 'px',
    '--cf-user-menu-down': pixels(reach.value.down) + 'px',
  };
  if (wide.value) {
    const side = Math.max(pixels(reach.value.left), pixels(reach.value.right));
    style['--cf-user-menu-column'] = Math.max(WIDE_COLUMN, size + 2 * side + 32) + 'px';
  }
  return style;
});

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
// 横向名片右栏的备注卡片改好了。
const saveMemoText = (text) => changeAccount(owner.value, (own) => setMemo(own, name.value, text));
// 备注太长被省略时，鼠标移上去提示全文。
function showMemo(event) {
  if (isTruncated(event.currentTarget)) tooltip.show(event.currentTarget, memo.value);
}

// 管理分组：关掉菜单，打开分组管理弹窗，停在这个人所在的第一个分组上（不在任何分组里就停在「好友」），他那一行闪一下。
function openManage() {
  const first = groups.value.find((group) => joined.value.has(group.id));
  const handle = name.value;
  close();
  showGroupsDialog(first ? first.id : FRIENDS_GROUP, handle);
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
  target.value = {
    ...user,
    x,
    y,
    key: ++opened,
    admin: adminOnPage(user.handle),
    wide: appSettings.groups.menuCard === 'horizontal',
  };
  place.value = { left: x, top: y, origin: 'left top' };
  // 菜单进场的第一帧之前摆好，不会先在点下的地方出现再跳开。
  nextTick(placeMenu);
  requestProfiles([user.handle])
    .then(() => backfillStats(user.handle))
    .catch(() => {});
}
// 缓存里这个人还没有四项资料（旧的条目）：页面上查头像时本来会顺带补（见 avatars/enhance.js），
// 没开头像、这一处不显示头像、或者那次没查成时，这里再单独查他一次，查到了名片上淡入；查不成照旧写「最高 …」。每个人只补查一次。
// 上面那次查询要是已经去接口查过（缓存过期了），四项资料就跟着来了，用不着补。
const statsAsked = new Set();
function backfillStats(handle) {
  const own = profileOf(handle);
  if (!own || own.missing || own.stats !== undefined || statsAsked.has(userId(handle))) return;
  statsAsked.add(userId(handle));
  return requestProfiles([handle], { force: true });
}
function close() {
  if (!target.value) return;
  // 正在写的备注、分组名先收尾（失去焦点时存下备注），再关：关了以后就不知道是谁的了。
  if (menu.value?.contains(document.activeElement)) document.activeElement.blur();
  tooltip.hide();
  target.value = null;
}

function onContextMenu(event) {
  // 菜单自己里面：不出原站的菜单；输入框除外（要能粘贴）。
  if (menu.value?.contains(event.target)) {
    if (!event.target.closest('input, textarea')) event.preventDefault();
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
// 菜单开着时换了资料卡的排法（快捷键、别的标签页）：在原处按新的排法重新打开，旧的淡出、新的进场。
watch(
  () => appSettings.groups.menuCard,
  (card) => {
    const at = target.value;
    if (at && at.wide !== (card === 'horizontal')) open(at, at.x, at.y);
  },
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
        :class="{ 'is-wide': target.wide }"
        role="menu"
        data-cf-language-surface
        :style="{
          left: place.left + 'px',
          top: place.top + 'px',
          transformOrigin: place.origin,
          '--cf-menu-accent': accent,
        }"
      >
        <div class="cf-user-menu-card cf-frame-host" :style="cardStyle">
          <Transition name="cf-user-menu-avatar">
            <span v-if="avatarShownAt('menus')" class="cf-user-menu-avatar"
              ><img :src="source" alt="" @error="failed < sources.length - 1 && failed++" /><img
                v-if="sharp"
                :key="sharp"
                class="cf-user-menu-sharp"
                :class="{ 'is-ready': sharpLoaded.has(sharp) }"
                :src="sharp"
                alt=""
                @load="sharpLoaded.add($event.target.getAttribute('src'))"
                @error="sharpBroken.add($event.target.getAttribute('src'))" /><AvatarFrame
                :profile="profile"
                :admin="admin"
                place="menus"
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
            <span
              v-if="target.wide && rating !== null"
              class="cf-user-menu-rating"
              :style="{ color: ink }"
              >{{ rating }}</span
            >
            <RankProgress
              v-if="!profile?.missing"
              class="cf-user-menu-progress"
              :rating="rating"
              :handle="name"
              :admin="admin"
              :pending="!profile"
            />
          </span>
          <!-- 四项资料：缓存里有就显示；补查到了展开。没有时到过更高的段位就写一行「最高 …」，两样换着展开、收起。 -->
          <ExpandTransition :show="Boolean(stats)">
            <div class="cf-user-menu-stats"><ProfileStats :stats="stats || NO_STATS" /></div>
          </ExpandTransition>
          <ExpandTransition :show="!stats && Boolean(best)">
            <div class="cf-user-menu-best">
              {{ t('groupsMenuBest') }} <b :style="{ color: best?.ink }">{{ best?.name }}</b>
            </div>
          </ExpandTransition>
        </div>
        <!-- 菜单项。横向时是右边一栏：备注换成撑满中间空处的卡片，最下面一排按钮贴底。 -->
        <div class="cf-user-menu-list">
          <div class="cf-user-menu-title">{{ t('groupsMenuGroups') }}</div>
          <div class="cf-user-menu-groups cf-scrollbar">
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
            <!-- 重名时输入框标红，撞了名的那个分组那一行的名字部分（勾选框和小标后面）也标红。 -->
            <form v-if="creating" class="cf-user-menu-item is-input" @submit.prevent="submitCreate">
              <InlineSvg class="cf-user-menu-icon" :source="USER_MENU_ICONS.plus" />
              <label class="cf-user-menu-field">
                <input
                  ref="draftInput"
                  v-model="draft"
                  class="cf-user-menu-input"
                  :class="{ 'has-conflict': conflict }"
                  type="text"
                  :maxlength="NAME_LIMIT"
                  @beforeinput="keepWithinLimit"
                  :placeholder="t('groupsNamePlaceholder')"
                  @keydown.esc.stop="cancelCreate"
                  @blur="draft.trim() || cancelCreate()"
                />
                <span class="cf-user-menu-count" :class="{ 'is-full': draft.length >= NAME_LIMIT }"
                  >{{ draft.length }}/{{ NAME_LIMIT }}</span
                >
              </label>
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
          <button type="button" role="menuitem" class="cf-user-menu-item" @click="openManage">
            <InlineSvg class="cf-user-menu-icon" :source="USER_MENU_ICONS.manage" />
            <span class="cf-user-menu-label">{{ t('groupsMenuManage') }}</span>
          </button>
          <MemoCard
            v-if="target.wide"
            class="cf-user-menu-memo"
            :memo="memo"
            :locked="!canMemo"
            @save="saveMemoText"
          />
          <hr v-if="!target.wide" class="cf-user-menu-rule" />
          <Transition v-if="!target.wide" name="cf-user-menu-swap" mode="out-in">
            <form v-if="editingMemo" class="cf-user-menu-item is-input" @submit.prevent="saveMemo">
              <InlineSvg class="cf-user-menu-icon" :source="USER_MENU_ICONS.quill" />
              <label class="cf-user-menu-field">
                <input
                  ref="memoInput"
                  v-model="memoDraft"
                  class="cf-user-menu-input"
                  type="text"
                  :maxlength="MEMO_LIMIT"
                  @beforeinput="keepWithinLimit"
                  :placeholder="t('groupsMemoPlaceholder')"
                  @keydown.esc.stop="editingMemo = false"
                  @blur="saveMemo"
                />
                <span
                  class="cf-user-menu-count"
                  :class="{ 'is-full': memoDraft.length >= MEMO_LIMIT }"
                  >{{ memoDraft.length }}/{{ MEMO_LIMIT }}</span
                >
              </label>
            </form>
            <button
              v-else
              type="button"
              role="menuitem"
              class="cf-user-menu-item is-memo-row"
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
              <span v-else-if="!canMemo" class="cf-user-menu-end is-memo">{{
                t('groupsMemoLocked')
              }}</span>
            </button>
          </Transition>
          <hr class="cf-user-menu-rule" />
          <!-- 最下面三个常用的并成一排：图标在上、字在下。 -->
          <div class="cf-user-menu-actions">
            <button
              type="button"
              role="menuitem"
              class="cf-user-menu-item is-action"
              @click="openTab"
            >
              <InlineSvg class="cf-user-menu-icon" :source="USER_MENU_ICONS.open" />
              <span class="cf-user-menu-label">{{ t('groupsMenuOpen') }}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              class="cf-user-menu-item is-action"
              @click="copy(name)"
            >
              <InlineSvg class="cf-user-menu-icon" :source="USER_MENU_ICONS.copy" />
              <span class="cf-user-menu-label">{{ t('groupsMenuCopyName') }}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              class="cf-user-menu-item is-action"
              @click="copy(target.href)"
            >
              <InlineSvg class="cf-user-menu-icon" :source="USER_MENU_ICONS.link" />
              <span class="cf-user-menu-label">{{ t('groupsMenuCopyLink') }}</span>
            </button>
          </div>
        </div>
      </div></Transition
    ></Teleport
  >
</template>
<style>
/* 宽度跟着内容走：段位名、分组名长的时候撑宽，不到 280px 时按 280px，最宽 360px（再长的才省略）。
   280px 时经验条下面的小字「距成为 International Grandmaster 还差 N」放得下一行。 */
.cf-user-menu {
  position: fixed;
  z-index: 2147483640;
  width: max-content;
  min-width: 280px;
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

/* 顶上是一张名片：放大的头像居中，下面是名字、段位和评分（照原站表格里用户名的写法，和分组页的成员一样）。
   上下的留白按戴着的头像框实际伸出去多少留（--cf-user-menu-up / -down，脚本量好写上），换框时滑过去；
   底色是很淡的段位色，往下渐变成白（渐变本身不变，变的是下面那层底色，所以读到段位、换人时能渐变过去）。 */
.cf-user-menu-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: -6px -6px 4px;
  padding: calc(var(--cf-user-menu-up, 0px) + 16px) 12px 16px;
  border-radius: calc(var(--cf-radius-lg) - 1px) calc(var(--cf-radius-lg) - 1px) 0 0;
  background-color: color-mix(
    in srgb,
    var(--cf-user-menu-tint, var(--cf-gray-400)) 10%,
    var(--cf-white-surface)
  );
  transition:
    padding var(--cf-duration-moderate) var(--cf-ease-out),
    background-color var(--cf-duration-moderate) ease;
}
.cf-user-menu-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(to bottom, transparent, var(--cf-white-surface));
  pointer-events: none;
}
/* 头像框要伸到圆的外面，所以这一层不裁，圆形裁在图片上。下面让出框伸下去的那一截再接名字。
   打开时头像连框晚一点从下面升上来，名字再淡入。 */
.cf-user-menu-avatar {
  position: relative;
  flex: none;
  width: 96px;
  height: 96px;
  margin-bottom: calc(var(--cf-user-menu-down, 0px) + 14px);
  border: 1px solid rgb(0 0 0 / 10%);
  border-radius: 50%;
  background: var(--cf-gray-100);
  box-sizing: border-box;
  animation: cf-user-menu-rise var(--cf-duration-moderate) var(--cf-ease-out) 40ms backwards;
  transition: margin-bottom var(--cf-duration-moderate) var(--cf-ease-out);
}
@keyframes cf-user-menu-rise {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.96);
  }
}
@keyframes cf-user-menu-show {
  from {
    opacity: 0;
  }
}
.cf-user-menu-avatar > img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
/* 主页大图叠在小头像上面，下载好了淡入。 */
.cf-user-menu-avatar > .cf-user-menu-sharp {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity var(--cf-duration-base) ease;
}
.cf-user-menu-avatar > .cf-user-menu-sharp.is-ready {
  opacity: 1;
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
  margin-bottom: 0;
  border-width: 0;
  opacity: 0;
}
/* 名字压在头像框上面，居中。 */
.cf-user-menu-who {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-weight: var(--cf-font-weight-bold);
  text-align: center;
  animation: cf-user-menu-show var(--cf-duration-base) ease 90ms backwards;
}
.cf-user-menu-name,
.cf-user-menu-rank {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--cf-duration-base) ease;
}
.cf-user-menu-name {
  font-size: calc(16px * var(--cf-font-scale));
  line-height: 20px;
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
/* 经验条、四项资料、「最高 …」铺满名片的宽（名字那一块也铺满，经验条的长短不随名字、段位的长短变）；
   和上面隔开的距离写成上内边距，收起时一起收掉。
   四项资料和「最高 …」和名字一样抬到名片底色那层渐变白的上面（不然被它盖得发白）。 */
.cf-user-menu-card > .cf-user-menu-who {
  width: 100%;
}
.cf-user-menu-progress {
  width: 100%;
  margin-top: 6px;
}
.cf-user-menu-card > .cf-expand-region {
  align-self: stretch;
}
.cf-user-menu-stats {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  padding-top: 14px;
}
.cf-user-menu-stats > .cf-profile-stats {
  width: 100%;
}
.cf-user-menu-best {
  position: relative;
  z-index: 1;
  padding-top: 6px;
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-xs);
  line-height: 16px;
  text-align: center;
}
.cf-user-menu-best b {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

/* —— 横向：左边一栏是名片，右边一栏是菜单项 ——
   名片那一栏上下左贴满菜单的边（抵掉菜单的内边距），和右栏隔 6px；宽度至少 272px，头像框左右伸得宽时撑宽（脚本算好）。
   名片的底色从上往下渐变成白；头像 128px，外面一圈淡淡的段位色光。右栏 208px，备注卡片撑满分组和按钮之间的空处。 */
.cf-user-menu.is-wide {
  display: flex;
  align-items: stretch;
  max-width: calc(100vw - 16px);
}
.cf-user-menu.is-wide .cf-user-menu-card {
  flex: none;
  justify-content: flex-start;
  width: var(--cf-user-menu-column, 272px);
  margin: -6px 6px -6px -6px;
  padding: calc(var(--cf-user-menu-up, 0px) + 22px) 14px 16px;
  border-radius: calc(var(--cf-radius-lg) - 1px) 0 0 calc(var(--cf-radius-lg) - 1px);
  background-color: color-mix(
    in srgb,
    var(--cf-user-menu-tint, var(--cf-gray-400)) 13%,
    var(--cf-white-surface)
  );
  box-sizing: border-box;
}
.cf-user-menu.is-wide .cf-user-menu-card::before {
  background: linear-gradient(to bottom, transparent 15%, var(--cf-white-surface) 92%);
}
.cf-user-menu.is-wide .cf-user-menu-avatar {
  width: 128px;
  height: 128px;
  box-shadow:
    0 0 0 6px color-mix(in srgb, var(--cf-user-menu-tint, var(--cf-gray-400)) 9%, transparent),
    0 8px 24px color-mix(in srgb, var(--cf-user-menu-tint, var(--cf-gray-400)) 26%, transparent);
}
.cf-user-menu.is-wide .cf-user-menu-who {
  width: 100%;
}
.cf-user-menu.is-wide .cf-user-menu-name {
  font-size: calc(18px * var(--cf-font-scale));
  line-height: 24px;
}
.cf-user-menu.is-wide .cf-user-menu-rank {
  font-size: var(--cf-font-size-base);
}
.cf-user-menu-rating {
  font-size: calc(24px * var(--cf-font-scale));
  font-variant-numeric: tabular-nums;
  line-height: 28px;
  transition: color var(--cf-duration-base) ease;
}
.cf-user-menu.is-wide .cf-user-menu-progress,
.cf-user-menu.is-wide .cf-user-menu-stats > .cf-profile-stats {
  width: 100%;
}
.cf-user-menu.is-wide .cf-user-menu-list {
  display: flex;
  flex-direction: column;
  width: 208px;
  min-width: 0;
  padding-top: 2px;
}
.cf-user-menu.is-wide .cf-user-menu-memo {
  flex: 1;
  margin: 6px 0 2px;
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
  /* 滚动条用公共的 cf-scrollbar（styles/scrollbar.css），滑块跟着主题色。 */
  --cf-scrollbar-thumb: color-mix(in srgb, var(--cf-menu-accent) 35%, transparent);
  --cf-scrollbar-thumb-hover: color-mix(in srgb, var(--cf-menu-accent) 55%, transparent);
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
    box-shadow var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease,
    opacity var(--cf-duration-base) ease;
}
.cf-user-menu-item:hover:not(:disabled, .is-input) {
  background: color-mix(in srgb, var(--cf-menu-accent) 14%, transparent);
}
.cf-user-menu-item:disabled {
  opacity: 0.4;
  cursor: default;
}
/* 备注那一行不能写时（不在任何分组里）：和横向的备注卡片一样，行尾写着要先加入分组，鼠标是「不能点」。 */
.cf-user-menu-item.is-memo-row:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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
/* 重名：撞了名的那个分组，小标和名字（勾选框后面，到这一行的右边）套一个红框、名字变红，淡入淡出。
   红框和下面新建分组的输入框一样宽、一样高：上下各让 3px，右边让出这一行的内边距 8px，
   左边在 26px（这一行的内边距 8px + 勾选框 14px + 间隔 8px 是小标的左边 30px，再往回 4px），
   输入框的左边也挪到 26px（见下面的 .cf-user-menu-field）。
   红框垫在字下面：这一行单独成一层（isolation），红框在这一层的最底下。 */
.cf-user-menu-groups .cf-user-menu-item {
  position: relative;
  isolation: isolate;
}
.cf-user-menu-groups .cf-user-menu-item::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 3px 8px 3px 26px;
  border-radius: var(--cf-radius-xs);
  background: #fff1f2;
  box-shadow: inset 0 0 0 1px #e65b70;
  opacity: 0;
  transition: opacity var(--cf-duration-fast) ease;
  pointer-events: none;
}
.cf-user-menu-groups .cf-user-menu-item.has-conflict::before {
  opacity: 1;
}
.cf-user-menu-item.has-conflict .cf-user-menu-label {
  color: #bd2542;
}
.cf-user-menu-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--cf-duration-fast) ease;
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
/* 最下面一排三个：图标在上、字在下，三格一样宽。 */
.cf-user-menu-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
}
.cf-user-menu-item.is-action {
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  height: 46px;
  padding: 0 4px;
  font-size: var(--cf-font-size-xs);
}
.cf-user-menu-item.is-action .cf-user-menu-label {
  max-width: 100%;
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
    background-color var(--cf-duration-fast) ease,
    box-shadow var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease;
}
.cf-user-menu-input:focus {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--cf-menu-accent) 22%, transparent);
}
.cf-user-menu-input::placeholder {
  color: var(--cf-gray-400);
}
/* 重名：输入框标红，和撞了名的那个分组的名字红框一样。 */
.cf-user-menu-input.has-conflict {
  border-color: #e65b70;
  background: #fff1f2;
  color: #bd2542;
}
.cf-user-menu-input.has-conflict:focus {
  box-shadow: 0 0 0 2px #e65b7033;
}
/* 新建分组的输入框和它的字数：字数一直在输入框里面的最右边（和分组管理弹窗里改名字的输入框一样），
   输入框右边让出它的位置，打的字不会盖到它。写满了字数变深，重名时变红。 */
.cf-user-menu-field {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
}
/* 输入框左边在 26px（这一行的内边距 8px + 图标 16px + 间隔 8px 是 32px，往回挪 6px），和重名时分组那一行的红框对齐。 */
.cf-user-menu-item.is-input > .cf-user-menu-field {
  margin-left: -6px;
}
.cf-user-menu-field .cf-user-menu-input {
  padding-right: 38px;
}
.cf-user-menu-count {
  position: absolute;
  top: 50%;
  right: 6px;
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-2xs);
  font-variant-numeric: tabular-nums;
  line-height: 12px;
  white-space: nowrap;
  transform: translateY(-50%);
  pointer-events: none;
  transition: color var(--cf-duration-fast) ease;
}
.cf-user-menu-count.is-full {
  color: color-mix(in srgb, var(--cf-menu-accent) 46%, #27364e);
}
.cf-user-menu-input.has-conflict + .cf-user-menu-count {
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
  .cf-user-menu-row-leave-active,
  .cf-user-menu-card,
  .cf-user-menu-avatar,
  .cf-user-menu-avatar > .cf-user-menu-sharp,
  .cf-user-menu-who,
  .cf-user-menu-rating {
    transition: none;
    animation: none;
  }
}
</style>
