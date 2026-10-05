<script setup>
import ExpandTransition from '../../components/transitions/ExpandTransition/ExpandTransition.vue';
import { appSettings, saveSettings } from '../../../settings.js';
import { translate as t } from '../../../i18n/index.js';
import ToggleSwitch from '../../components/forms/ToggleSwitch/ToggleSwitch.vue';
import RangeSlider from '../../components/forms/RangeSlider/RangeSlider.vue';
import AnalyticsSettings from './components/AnalyticsSettings/AnalyticsSettings.vue';
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
            :max="3"
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
    <AnalyticsSettings />
  </div>
</template>
