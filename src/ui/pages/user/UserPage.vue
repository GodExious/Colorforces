<script setup>
import ExpandTransition from '../../components/transitions/ExpandTransition/ExpandTransition.vue';
import { appSettings, saveSettings } from '../../../settings.js';
import { translate as t } from '../../../i18n/index.js';
import ToggleSwitch from '../../components/forms/ToggleSwitch/ToggleSwitch.vue';
</script>
<template>
  <div class="cf-tab-panel">
    <label class="cf-setting-item" style="cursor: pointer; user-select: none; margin: 0px"
      ><span class="cf-setting-label" v-text="t().locUserAvatar"></span
      ><toggle-switch
        as="div"
        v-model="appSettings.show.userAvatar"
        input-class="cf-toggle-user-avatar"
        data-control="cbAvatar"
        @change="saveSettings()"
      ></toggle-switch
    ></label>
    <ExpandTransition :show="appSettings.show.userAvatar"
      ><div class="cf-setting-item cf-row-avatar-size" style="padding-left: 12px">
        <span class="cf-setting-sublabel" v-text="t().locAvatarSize"></span>
        <div style="display: flex; align-items: center; gap: 5px">
          <input
            type="range"
            min="0.8"
            max="3.0"
            step="0.1"
            style="width: 100px; cursor: pointer"
            v-model.number="appSettings.avatarSize"
            v-on:input="saveSettings()"
            data-control="avatarSizeInput"
          /><span
            style="
              font-size: 12px;
              width: 28px;
              text-align: right;
              display: inline-block;
              color: rgb(100, 116, 139);
              font-weight: 500;
            "
            v-text="parseFloat(appSettings.avatarSize).toFixed(1) + 'x'"
          ></span>
        </div></div
    ></ExpandTransition>
    <ExpandTransition :show="appSettings.show.userAvatar"
      ><label
        class="cf-setting-item cf-row-format-teams"
        style="padding-left: 12px; cursor: pointer; user-select: none; margin: 0px"
        ><span class="cf-setting-sublabel" v-text="t().locFormatTeams"></span
        ><toggle-switch
          as="div"
          v-model="appSettings.show.formatTeams"
          data-control="cbFormatTeams"
          @change="saveSettings()"
        ></toggle-switch></label
    ></ExpandTransition>
  </div>
</template>
