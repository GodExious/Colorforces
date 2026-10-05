<script setup>
import { appSettings, saveSettings } from '../../../../../settings.js';
import { translate as t } from '../../../../../i18n/index.js';
import ToggleSwitch from '../../../../components/forms/ToggleSwitch/ToggleSwitch.vue';
import ExpandTransition from '../../../../components/transitions/ExpandTransition/ExpandTransition.vue';
</script>

<template>
  <label class="cf-setting-item cf-tag-visibility-setting">
    <span class="cf-setting-label" data-cf-language-text v-text="t().locHideTags"></span>
    <ToggleSwitch
      as="div"
      v-model="appSettings.appearance.tags.hide"
      input-class="cf-toggle-hide-tags"
      data-control="cbHideTags"
      @change="saveSettings()"
    />
  </label>
  <ExpandTransition :show="appSettings.appearance.tags.hide">
    <label
      class="cf-setting-item cf-sub-setting-item cf-tag-visibility-setting cf-tag-visibility-subitem"
    >
      <span class="cf-setting-sublabel" data-cf-language-text v-text="t().locHideRatingTag"></span>
      <ToggleSwitch
        as="div"
        v-model="appSettings.appearance.tags.hideRating"
        data-control="cbHideRatingTag"
        @change="saveSettings()"
      />
    </label>
  </ExpandTransition>
  <ExpandTransition :show="appSettings.appearance.tags.hide">
    <label
      class="cf-setting-item cf-sub-setting-item cf-tag-visibility-setting cf-tag-visibility-subitem"
    >
      <span class="cf-setting-sublabel" data-cf-language-text v-text="t().locNotHideAcTags"></span>
      <ToggleSwitch
        as="div"
        v-model="appSettings.appearance.tags.keepSolved"
        data-control="cbNotHideAcTags"
        @change="saveSettings()"
      />
    </label>
  </ExpandTransition>
</template>

<style scoped>
.cf-tag-visibility-setting {
  cursor: pointer;
  user-select: none;
  margin: 0;
}
.cf-tag-visibility-subitem {
  align-items: center;
  justify-content: space-between;
  font-size: var(--cf-font-size-base);
  min-height: 28px;
  padding-left: 14px;
}
</style>
