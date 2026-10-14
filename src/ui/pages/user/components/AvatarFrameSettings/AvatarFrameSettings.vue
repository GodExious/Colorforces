<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { appSettings, saveSettings, setSetting } from '../../../../../settings.js';
import { translate as t } from '../../../../../i18n/index.js';
import { getCurrentUserHandle } from '../../../../../features/page/account.js';
import {
  profileOf,
  requestProfiles,
  subscribeProfiles,
} from '../../../../../features/user/groups/profiles.js';
import { chooseFrame } from '../../../../../features/user/frames/choose.js';
import { KNOWN_FRAMES } from '../../../../../features/user/frames/catalog.js';
import ToggleSwitch from '../../../../components/forms/ToggleSwitch/ToggleSwitch.vue';
import SegmentedSwitch from '../../../../components/forms/SegmentedSwitch/SegmentedSwitch.vue';
import ExpandTransition from '../../../../components/transitions/ExpandTransition/ExpandTransition.vue';
import InfoHint from '../../../../components/tooltips/InfoHint/InfoHint.vue';
import AvatarFrame from '../../../../components/avatars/AvatarFrame/AvatarFrame.vue';

// 「显示用户头像」下面的头像框：总开关「显示头像框」，打开后是动效、段位头像框，以及整套段位头像框的预览。
// 预览里每一格是一个段位的头像框，套在自己的头像上；自己现在戴的那一格带「佩戴中」。
// 段位头像框跟着段位走，不能在这里单独摘下或换戴（头像框库在后面做）。
const RANK_TILES = [
  ['unrated', 'Unrated'],
  ['newbie', 'Newbie'],
  ['pupil', 'Pupil'],
  ['specialist', 'Specialist'],
  ['expert', 'Expert'],
  ['cm', 'CM'],
  ['master', 'Master'],
  ['im', 'IM'],
  ['gm', 'GM'],
  ['igm', 'IGM'],
  ['lgm', 'LGM'],
  ['tourist', 'tourist'],
  ['jiangly', 'jiangly'],
  ['headquarters', ''],
].filter(([id]) => KNOWN_FRAMES.has(id));

// 自己的资料：头像（格子里套框用）和段位（哪一格是「佩戴中」）。没登录时格子里是空的圆。
const owner = getCurrentUserHandle() || '';
const profilesSeen = ref(0);
const me = computed(() => (profilesSeen.value >= 0 && owner ? profileOf(owner) : null));
const picture = computed(() => me.value?.fallback || me.value?.avatar || '');
const wearing = computed(() =>
  me.value && !me.value.missing
    ? chooseFrame({
        rank: me.value.rank,
        maxRank: me.value.maxRank,
        mode: appSettings.user.avatar.rankFrame,
        known: KNOWN_FRAMES,
      })
    : '',
);
let stop;
onMounted(() => {
  stop = subscribeProfiles(() => profilesSeen.value++);
  if (owner) requestProfiles([owner]).catch(() => {});
});
onBeforeUnmount(() => stop?.());
</script>
<template>
  <div class="cf-frame-settings">
    <label class="cf-setting-item cf-frame-settings-master"
      ><span class="cf-setting-sublabel" v-text="t('locAvatarFrames')"></span
      ><ToggleSwitch
        as="div"
        v-model="appSettings.user.avatar.frames"
        data-control="avatarFrames"
        @change="saveSettings()"
    /></label>
    <ExpandTransition :show="appSettings.user.avatar.frames">
      <div class="cf-nested-options cf-frame-settings-body">
        <div class="cf-setting-item">
          <span class="cf-setting-sublabel" v-text="t('locFrameMotion')"></span>
          <SegmentedSwitch
            style="width: 216px"
            :model-value="appSettings.user.avatar.frameMotion"
            :options="[
              { value: 'off', label: t('locFrameMotionOff') },
              { value: 'hover', label: t('locFrameMotionHover') },
              { value: 'on', label: t('locFrameMotionOn') },
            ]"
            data-control="frameMotion"
            @update:model-value="setSetting('user.avatar.frameMotion', $event)"
          />
        </div>
        <div class="cf-setting-item">
          <span class="cf-setting-sublabel"
            ><span v-text="t('locRankFrame')"></span><InfoHint :text="t('locRankFrameHint')"
          /></span>
          <SegmentedSwitch
            style="width: 216px"
            :model-value="appSettings.user.avatar.rankFrame"
            :options="[
              { value: 'off', label: t('locRankFrameOff') },
              { value: 'current', label: t('locRankFrameCurrent') },
              { value: 'max', label: t('locRankFrameMax') },
            ]"
            data-control="rankFrame"
            @update:model-value="setSetting('user.avatar.rankFrame', $event)"
          />
        </div>
        <!-- 整套段位头像框：段位头像框不使用时收起来。 -->
        <ExpandTransition :show="appSettings.user.avatar.rankFrame !== 'off'">
          <div class="cf-frame-tiles">
            <div
              v-for="[id, label] in RANK_TILES"
              :key="id"
              class="cf-frame-tile cf-frame-host"
              :class="{ 'is-worn': wearing === id }"
            >
              <span class="cf-frame-tile-face"
                ><img v-if="picture" :src="picture" alt="" /><AvatarFrame :frame="id"
              /></span>
              <span class="cf-frame-tile-name">{{ label || t('locFrameAdmin') }}</span>
              <span class="cf-frame-tile-worn" v-text="t('locFrameWorn')"></span>
            </div>
          </div>
        </ExpandTransition>
      </div>
    </ExpandTransition>
  </div>
</template>
<style>
.cf-frame-settings-body {
  margin-top: 8px;
}
/* 整套段位头像框：一格一个，上面是套着框的头像，下面是段位名。 */
.cf-frame-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 4px;
  padding-top: 4px;
}
.cf-frame-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 2px 4px;
  border: 1px solid transparent;
  border-radius: var(--cf-radius-md);
  color: var(--cf-gray-600);
  font-size: var(--cf-font-size-xs);
  line-height: 16px;
  transition:
    border-color var(--cf-duration-fast) ease,
    background-color var(--cf-duration-fast) ease;
}
.cf-frame-tile:hover {
  border-color: var(--cf-surface-border);
  background: var(--cf-card-surface);
}
/* 头像占格子正中的一半，框是头像的两倍大，正好占满 52px 的方块。 */
.cf-frame-tile-face {
  position: relative;
  width: 26px;
  height: 26px;
  margin: 13px;
  border-radius: 50%;
  background: var(--cf-gray-100);
}
.cf-frame-tile-face > img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.cf-frame-tile-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 「佩戴中」的小牌子：自己现在戴的那一格才显示。 */
.cf-frame-tile-worn {
  position: absolute;
  top: 2px;
  right: 2px;
  padding: 0 4px;
  border-radius: var(--cf-radius-xs);
  background: var(--cf-menu-accent);
  color: var(--cf-white-ink);
  font-size: var(--cf-font-size-2xs);
  line-height: 14px;
  opacity: 0;
  transform: scale(0.8);
  transition:
    opacity var(--cf-duration-base) ease,
    transform var(--cf-duration-base) ease;
}
.cf-frame-tile.is-worn .cf-frame-tile-worn {
  opacity: 1;
  transform: scale(1);
}
@media (prefers-reduced-motion: reduce) {
  .cf-frame-tile-worn {
    transition: none;
  }
}
</style>
