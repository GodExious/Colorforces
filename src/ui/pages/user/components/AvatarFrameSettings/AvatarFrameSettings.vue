<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { appSettings, saveSettings, setSetting } from '../../../../../settings.js';
import { translate as t } from '../../../../../i18n/index.js';
import { toggleFromRow } from '../../../../../utils/row-toggle.js';
import { getCurrentUserHandle } from '../../../../../features/page/account.js';
import {
  profileOf,
  requestProfiles,
  subscribeProfiles,
} from '../../../../../features/user/groups/profiles.js';
import { chooseFrame } from '../../../../../features/user/frames/choose.js';
import { avatarShownAt } from '../../../../../features/user/avatars/places.js';
import {
  KNOWN_FRAMES,
  frameIntro,
  wearableFrame,
} from '../../../../../features/user/frames/catalog.js';
import { chosenFrames, watchChosenFrames } from '../../../../../features/user/frames/chosen.js';
import ToggleSwitch from '../../../../components/forms/ToggleSwitch/ToggleSwitch.vue';
import SegmentedSwitch from '../../../../components/forms/SegmentedSwitch/SegmentedSwitch.vue';
import ActionButton from '../../../../components/forms/ActionButton/ActionButton.vue';
import ExpandTransition from '../../../../components/transitions/ExpandTransition/ExpandTransition.vue';
import SmoothText from '../../../../components/transitions/SmoothText/SmoothText.vue';
import InfoHint from '../../../../components/tooltips/InfoHint/InfoHint.vue';
import AvatarFrame from '../../../../components/avatars/AvatarFrame/AvatarFrame.vue';
import SettingSection from '../../../../components/settings/SettingSection/SettingSection.vue';
import { showFrameDialog } from '../FrameDialog/FrameDialog.vue';
// 显示位置：个人主页、表格里、右键菜单、分组管理、其他页面，各一个开关（头像框库、设置里的预览照常显示）。
const PLACES = [
  ['profile', 'placeProfile'],
  ['tables', 'placeTables'],
  ['menus', 'placeMenus'],
  ['groups', 'placeGroups'],
  ['others', 'placeOthers'],
];
const placesOn = computed(
  () => PLACES.filter(([key]) => appSettings.user.avatar.frameAt[key]).length,
);

// 「显示用户头像」下面的头像框：总开关「显示头像框」，打开后是动效、段位头像框，
// 和「我的头像框」一行：现在戴着哪个，旁边一个按钮打开头像框库（预览、佩戴都在那里）。
const owner = getCurrentUserHandle() || '';
const profilesSeen = ref(0);
const me = computed(() => (profilesSeen.value >= 0 && owner ? profileOf(owner) : null));
const picture = computed(() => me.value?.fallback || me.value?.avatar || '');
watchChosenFrames();
// 自己现在实际戴着哪个：库里戴的、分组的、段位的，按 choose.js 的先后。
const wearing = computed(() => {
  const worn = wearableFrame(appSettings.user.avatar.wornFrame)
    ? appSettings.user.avatar.wornFrame
    : '';
  if (!owner) return worn;
  const profile = me.value && !me.value.missing ? me.value : null;
  return chooseFrame({
    ...chosenFrames(owner),
    rank: profile?.rank,
    maxRank: profile?.maxRank,
    mode: appSettings.user.avatar.rankFrame,
    known: KNOWN_FRAMES,
  });
});
// 名字后面写上是不是跟着段位、分组（没从库里挑的时候）。
const wearingName = computed(() => {
  const id = wearing.value;
  if (!id) return t('locFrameNone');
  const name = frameIntro(id, appSettings.general.lang)[0] || t('frameUnnamed');
  if (id === appSettings.user.avatar.wornFrame) return name;
  return name + t(wearableFrame(id) ? 'frameNowByGroup' : 'frameNowByRank');
});

let stop;
onMounted(() => {
  stop = subscribeProfiles(() => profilesSeen.value++);
  if (owner) requestProfiles([owner]).catch(() => {});
});
onBeforeUnmount(() => stop?.());
</script>
<template>
  <div class="cf-frame-settings">
    <!-- 这一行里有个 i（按钮），整行不能是 label：label 会把点击交给里面的第一个按钮，开关就点不动了。
         所以照分组页的写法：只有文字是 label，空白处的点击由 toggleFromRow 转给开关。
         后面的 i：头像框只在自己这边显示，别人看不到。 -->
    <div class="cf-setting-item cf-frame-settings-master" @click="toggleFromRow">
      <span class="cf-setting-sublabel"
        ><label for="cf-frame-control-frames" v-text="t('locAvatarFrames')"></label
        ><InfoHint :text="t('locFrameNote')"
      /></span>
      <ToggleSwitch
        as="label"
        input-id="cf-frame-control-frames"
        v-model="appSettings.user.avatar.frames"
        data-control="avatarFrames"
        @change="saveSettings()"
      />
    </div>
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
        <!-- 我的头像框：现在戴着哪个，点按钮打开头像框库。 -->
        <div class="cf-setting-item">
          <span class="cf-setting-sublabel" v-text="t('frameMine')"></span>
          <span class="cf-frame-mine">
            <span class="cf-frame-mine-face cf-frame-host"
              ><img v-if="picture" :src="picture" alt="" /><AvatarFrame :frame="wearing"
            /></span>
            <span class="cf-frame-mine-name"><SmoothText :text="wearingName" /></span>
            <ActionButton data-control="openFrameLibrary" @click="showFrameDialog()">{{
              t('frameOpenLibrary')
            }}</ActionButton>
          </span>
        </div>
        <!-- 显示位置放在这一块的最后：展开的底板在最下面，不把「我的头像框」往下挤。 -->
        <SettingSection
          :title="t('showAtTitle')"
          foldable
          plate
          :summary="t('settingSelected', placesOn, PLACES.length)"
          :muted="placesOn === 0"
        >
          <!-- 头像在那一处不显示时，头像框也戴不上：那一行淡一些（开关照样能拨，头像显示出来后就按它）。 -->
          <label
            v-for="[key, label] in PLACES"
            :key="key"
            class="cf-setting-item cf-frame-place"
            :class="{ 'is-off': key !== 'profile' && !avatarShownAt(key) }"
          >
            <span class="cf-setting-sublabel" v-text="t(label)"></span>
            <ToggleSwitch
              as="div"
              v-model="appSettings.user.avatar.frameAt[key]"
              @change="saveSettings()"
            />
          </label>
        </SettingSection>
      </div>
    </ExpandTransition>
  </div>
</template>
<style>
.cf-frame-settings-body {
  margin-top: 8px;
}
.cf-frame-place {
  transition: opacity var(--cf-duration-base) ease;
}
.cf-frame-place.is-off {
  opacity: 0.5;
}
@media (prefers-reduced-motion: reduce) {
  .cf-frame-place {
    transition: none;
  }
}
.cf-frame-mine {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
/* 头像 22px，头像框是它的两倍，四周让出框多出来的那一圈。 */
.cf-frame-mine-face {
  position: relative;
  flex: none;
  width: 22px;
  height: 22px;
  margin: 11px;
  border-radius: 50%;
  background: var(--cf-gray-100);
}
.cf-frame-mine-face > img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.cf-frame-mine-name {
  color: var(--cf-gray-600);
  font-size: var(--cf-font-size-base);
  white-space: nowrap;
}
</style>
