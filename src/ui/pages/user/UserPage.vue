<script setup>
import { computed } from 'vue';
import ExpandTransition from '../../components/transitions/ExpandTransition/ExpandTransition.vue';
import { appSettings, saveSettings } from '../../../settings.js';
import { translate as t } from '../../../i18n/index.js';
import { AVATAR_PLACES } from '../../../features/user/avatars/places.js';
import ToggleSwitch from '../../components/forms/ToggleSwitch/ToggleSwitch.vue';
import RangeSlider from '../../components/forms/RangeSlider/RangeSlider.vue';
import SettingSection from '../../components/settings/SettingSection/SettingSection.vue';
import AvatarFrameSettings from './components/AvatarFrameSettings/AvatarFrameSettings.vue';
import AnalyticsSettings from './components/AnalyticsSettings/AnalyticsSettings.vue';
// 头像的显示位置：每一处一个开关，标题右边写着开了几处。
const PLACE_LABELS = {
  tables: 'placeTables',
  menus: 'placeMenus',
  groups: 'placeGroups',
  others: 'placeOthers',
};
const placesOn = computed(
  () => AVATAR_PLACES.filter((key) => appSettings.user.avatar.showAt[key]).length,
);
</script>
<template>
  <div class="cf-tab-panel">
    <label class="cf-setting-item" style="cursor: pointer; user-select: none; margin: 0px"
      ><span class="cf-setting-label" v-text="t().locUserAvatar"></span
      ><toggle-switch
        as="div"
        v-model="appSettings.user.avatar.enabled"
        input-class="cf-toggle-user-avatar"
        data-control="cbAvatar"
        @change="saveSettings()"
      ></toggle-switch
    ></label>
    <ExpandTransition :show="appSettings.user.avatar.enabled"
      ><div class="cf-setting-item cf-row-avatar-size" style="padding-left: 12px">
        <span class="cf-setting-sublabel" v-text="t().locAvatarSize"></span>
        <div style="display: flex; align-items: center; gap: 5px">
          <RangeSlider
            v-model="appSettings.user.avatar.size"
            :min="0.8"
            :max="5"
            :step="0.1"
            data-control="avatarSizeInput"
            @change="saveSettings()"
          /><span
            style="
              font-size: var(--cf-font-size-base);
              width: 28px;
              text-align: right;
              display: inline-block;
              color: rgb(100, 116, 139);
              font-weight: var(--cf-font-weight-medium);
            "
            v-text="parseFloat(appSettings.user.avatar.size).toFixed(1) + 'x'"
          ></span>
        </div></div
    ></ExpandTransition>
    <ExpandTransition :show="appSettings.user.avatar.enabled"
      ><label
        class="cf-setting-item cf-row-format-teams"
        style="padding-left: 12px; cursor: pointer; user-select: none; margin: 0px"
        ><span class="cf-setting-sublabel" v-text="t().locFormatTeams"></span
        ><toggle-switch
          as="div"
          v-model="appSettings.user.formatTeams"
          data-control="cbFormatTeams"
          @change="saveSettings()"
        ></toggle-switch></label
    ></ExpandTransition>
    <!-- 头像的显示位置：表格里、右键菜单、分组管理、其他页面（个人主页本来就有大照片，不在这里）。
         这一段是「显示用户头像」下面的第二级，里面的开关是第三级：用缩进加左边竖线（cf-nested-options），不用底板
         （底板是给头像框那边的第四级用的）。 -->
    <ExpandTransition :show="appSettings.user.avatar.enabled"
      ><div style="padding-left: 12px">
        <SettingSection
          :title="t('showAtTitle')"
          foldable
          :summary="t('settingSelected', placesOn, AVATAR_PLACES.length)"
          :muted="placesOn === 0"
        >
          <label v-for="key in AVATAR_PLACES" :key="key" class="cf-setting-item">
            <span class="cf-setting-sublabel" v-text="t(PLACE_LABELS[key])"></span>
            <ToggleSwitch
              as="div"
              v-model="appSettings.user.avatar.showAt[key]"
              @change="saveSettings()"
            />
          </label>
        </SettingSection></div
    ></ExpandTransition>
    <!-- 头像框：显示头像框，以及它下面的动效、段位头像框。 -->
    <ExpandTransition :show="appSettings.user.avatar.enabled"
      ><div style="padding-left: 12px"><AvatarFrameSettings /></div
    ></ExpandTransition>
    <AnalyticsSettings />
  </div>
</template>
