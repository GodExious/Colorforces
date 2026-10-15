<script>
import { shallowRef } from 'vue';
const request = shallowRef(null);
// 打开头像框库。target 是给谁挑：'me'（我自己，默认）或者分组的 id。弹窗始终只有一个。
export function showFrameDialog(target = 'me') {
  request.value = { target };
}
// 快捷键用（见 App.vue）：开着没有、关上。
export const frameDialogShown = () => Boolean(request.value);
export function closeFrameDialog() {
  request.value = null;
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
  frameIntro,
  frameKind,
  framesOfKind,
  wearableFrame,
} from '../../../../../features/user/frames/catalog.js';
import { chosenFrames, watchChosenFrames } from '../../../../../features/user/frames/chosen.js';
import FrameTile from './components/FrameTile/FrameTile.vue';
import FrameTarget from './components/FrameTarget/FrameTarget.vue';
import FramePreview from './components/FramePreview/FramePreview.vue';

// 头像框库：左栏是「给谁戴」和分类，中间是格子，右栏是试戴的样子和按钮。
// 点格子只是试戴，按右下角的按钮才真的戴上、取下（给分组挑时是设给这个分组）。
// 段位、特别两类跟着段位走：能看、能试戴，不能手动佩戴，也不能设给分组。成就、兑换两类还没有，点进去是「敬请期待」。
const ME = 'me';
// 左栏的先后（用户定的）：全部、段位、特别、常规、成就、兑换、导入。
const CATEGORIES = [
  { id: 'all', label: 'frameCatAll' },
  { id: 'ranks', label: 'frameCatRanks', note: 'frameCatRanksNote' },
  { id: 'special', label: 'frameCatSpecial', note: 'frameCatSpecialNote' },
  { id: 'decor', label: 'frameCatDecor', note: 'frameCatDecorNote' },
  { id: 'achieve', label: 'frameCatAchieve', soon: 'frameSoonAchieve' },
  { id: 'shop', label: 'frameCatShop', soon: 'frameSoonShop' },
  { id: 'imported', label: 'frameCatImported', note: 'frameCatImportedNote' },
];
// 「全部」里有的种类，先后和左栏一样：段位、特别、常规、导入（「不使用」那一格仍在最前面）。
const ALL_KINDS = ['ranks', 'special', 'decor', 'imported'];
const KIND_LABELS = {
  ranks: 'locFrameKindRank',
  special: 'locFrameKindSpecial',
  decor: 'locFrameKindBuiltin',
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
const frameName = (id) => frameIntro(id, appSettings.general.lang)[0];
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
// 这一类的格子：「全部」「常规」最前面是「不使用」；「导入」最后是「导入」那一格。
const tiles = computed(() => {
  const id = category.value;
  const list = framesIn(id).map((frame) => ({ key: frame, frame }));
  if ((id === 'all' || id === 'decor') && !query.value.trim())
    list.unshift({ key: ':none', frame: '' });
  if (id === 'imported') list.push({ key: ':add', add: true });
  return list;
});
// 格子右上角的小牌子：给谁挑，就标出它现在实际用着的那一格；什么都没用时标在「不使用」上（写「当前」）。
function badgeOf(tile) {
  if (tile.add) return '';
  const worn = wornOf(target.value);
  if (!tile.frame) return worn ? '' : t('frameCurrent');
  return tile.frame === worn ? t('locFrameWorn') : '';
}

// —— 试戴和按钮 ——
const preview = computed(() => {
  const id = picked.value;
  if (!id)
    return {
      name: t('locFrameNone'),
      kind: '',
      intro: t(target.value === ME ? 'locFrameNoneIntro' : 'frameNoneIntroGroup'),
    };
  const [name, intro] = frameIntro(id, appSettings.general.lang);
  const kind = KIND_LABELS[frameKind(id)];
  return { name, kind: kind ? t(kind) : '', intro };
});
// 右下角那一行：左边是理由或状态（locked 时前面一把小锁），右边一个按钮（act 为空时灰掉）。
const action = computed(() => {
  const id = picked.value;
  const mine = target.value === ME;
  const chosen = chosenOf(target.value);
  // 按钮只写动作，不带分组名：给谁设写在左栏顶上「给谁戴」和最底下一行里，分组名长了也不会把按钮撑开。
  const wear = mine ? t('frameWear') : t('frameSetGroup');
  const takeOff = t('frameTakeOff');
  if (!id)
    return chosen
      ? { why: '', label: takeOff, act: 'off', plain: true }
      : { why: t('frameWhyNothing'), label: takeOff, plain: true };
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
// 换了分类（或者给谁挑）：格子那一栏淡出后回到最上面，再淡入新的。
const main = ref(null);
const toTop = () => main.value && (main.value.scrollTop = 0);

// 只有右上角的 × 和下面的「完成」能关，和分组管理弹窗一样。
function close() {
  request.value = null;
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
  close();
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
                  @click="category = item.id"
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
            <!-- 中间：搜索、这一类的说明、格子。 -->
            <div ref="main" class="cf-frame-dialog-main cf-scrollbar">
              <div class="cf-frame-dialog-tools">
                <input
                  v-model="query"
                  class="cf-frame-search"
                  type="search"
                  :placeholder="t('frameSearch')"
                />
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
                    <div v-if="current.note" class="cf-frame-note">{{ t(current.note) }}</div>
                    <TransitionGroup name="cf-frame-tiles" tag="div" class="cf-frame-grid">
                      <FrameTile
                        v-for="tile in tiles"
                        :key="tile.key"
                        :frame="tile.frame"
                        :add="tile.add"
                        :disabled="tile.add"
                        :data-tooltip="tile.add ? t('frameSoonTitle') : null"
                        :picture="picture"
                        :label="
                          tile.add
                            ? t('frameImport')
                            : tile.frame
                              ? tileLabel(tile.frame)
                              : t('locFrameNone')
                        "
                        :picked="!tile.add && picked === tile.frame"
                        :badge="badgeOf(tile)"
                        @click="!tile.add && (picked = tile.frame)"
                      />
                    </TransitionGroup>
                    <div v-if="category === 'imported'" class="cf-frame-note is-after">
                      {{ t('frameImportedEmpty') }}
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
                :intro="preview.intro"
              >
                <template #foot>
                  <Transition name="cf-frame-fade" mode="out-in">
                    <span
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
  grid-template-columns: 172px 1fr 290px;
  flex: 1;
  min-height: 0;
  color: var(--cf-aurora-text);
  font-size: var(--cf-font-size-base);
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
.cf-frame-dialog-main {
  min-width: 0;
  padding: 12px 14px;
  overflow-y: auto;
}
.cf-frame-dialog-tools {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
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
.cf-frame-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
  gap: 6px;
  align-content: start;
}
/* 搜索时新出现的格子淡入，留下的滑到新位置。 */
.cf-frame-tiles-move {
  transition: transform var(--cf-duration-moderate) var(--cf-ease-out);
}
.cf-frame-tiles-enter-active {
  transition: opacity var(--cf-duration-base) ease;
}
.cf-frame-tiles-enter-from {
  opacity: 0;
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
/* 戴不了时按钮灰掉：浅灰底、灰字、没有阴影，和能点的一样高。 */
.cf-aurora-btn.cf-frame-act:disabled,
.cf-aurora-btn.cf-frame-act:disabled:hover {
  border-color: transparent;
  background: #e9ecf4;
  box-shadow: none;
  color: #a7b0c4;
  filter: none;
  cursor: not-allowed;
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
  .cf-frame-tiles-move,
  .cf-frame-tiles-enter-active {
    transition: none;
  }
}
</style>
