<script setup>
import ActionButton from '../../components/forms/ActionButton/ActionButton.vue';
import ExpandTransition from '../../components/transitions/ExpandTransition/ExpandTransition.vue';
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { appSettings, saveSettings, setSetting as choose } from '../../../settings.js';
import { translate as t } from '../../../i18n/index.js';
import * as assets from '../../../assets/index.js';
import InlineSvg from '../../components/icons/InlineSvg/InlineSvg.vue';
import { tooltip } from '../../components/tooltips/FloatingTooltip/FloatingTooltip.vue';
import { openClistKeyGuide } from './components/ClistKeyGuide/ClistKeyGuide.vue';
import { openClistSyncGuide } from './components/ClistSyncGuide/ClistSyncGuide.vue';
import {
  syncClistRatings,
  isClistSyncing,
  subscribeClistProgress,
  currentClistSyncProgress,
  getClistCooldownRemaining,
} from '../../../features/ratings/clist/sync.js';
import ToggleSwitch from '../../components/forms/ToggleSwitch/ToggleSwitch.vue';
import SegmentedSwitch from '../../components/forms/SegmentedSwitch/SegmentedSwitch.vue';
import InfoHint from '../../components/tooltips/InfoHint/InfoHint.vue';
import { getRatingBgColor, getRatingTagStyle } from '../../../features/ratings/rules.js';
// 打开评分页面专用指南。
function openGuide(kind, event) {
  tooltip.hide();
  if (kind === 'clist-key') openClistKeyGuide(event.currentTarget);
  else openClistSyncGuide(event.currentTarget);
}

const tick = ref(0);
const syncing = ref(isClistSyncing);
const syncDisabled = computed(() => {
  tick.value;
  return syncing.value || getClistCooldownRemaining() > 0;
});
const syncLabel = computed(() => {
  tick.value;
  const cooldown = getClistCooldownRemaining();
  return syncing.value
    ? t('clistSyncBtnSyncing', currentClistSyncProgress?.percent || 0)
    : cooldown > 0
      ? t(
          'clistSyncBtnCooldown',
          Math.floor(cooldown / 60000),
          String(Math.floor((cooldown % 60000) / 1000)).padStart(2, '0'),
        )
      : t().clistSyncBtn;
});
// 非同步中且冷却结束后才允许发起新任务。
function startSync() {
  if (syncDisabled.value) return;
  syncClistRatings(t, () => {
    syncing.value = isClistSyncing;
    tick.value++;
  });
}
let timer;
let stop;
onMounted(() => {
  timer = setInterval(() => tick.value++, 1000);
  stop = subscribeClistProgress(() => {
    syncing.value = isClistSyncing;
    tick.value++;
  });
});
onBeforeUnmount(() => {
  clearInterval(timer);
  stop?.();
});

// 「难度分展示区域」下的各项，顺序即菜单中的排列。
const locations = [
  ['submissions', 'locSubmissions'],
  ['status', 'locStatus'],
  ['hacks', 'locHacks'],
  ['problemset', 'locProblemset'],
  ['contestProblems', 'locContestProblems'],
  ['standings', 'locStandings'],
  ['problemTags', 'locProblemTags'],
];

const ratingSliderStyle = computed(() => {
  const tag = getRatingTagStyle(2400);
  return appSettings.ratings.style === 'block'
    ? { background: getRatingBgColor(2400), border: '1px solid ' + getRatingBgColor(2400) }
    : { background: tag.bg, border: '1px solid ' + tag.border };
});
</script>
<template>
  <div class="cf-tab-panel">
    <div class="cf-clist-section">
      <label
        class="cf-setting-item"
        style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: var(--cf-font-size-lg);
          font-weight: var(--cf-font-weight-semibold);
          cursor: pointer;
          user-select: none;
          margin: 0px;
        "
        ><span class="cf-setting-label" v-text="t().clistEnable"></span
        ><toggle-switch
          as="div"
          v-model="appSettings.ratings.clist.enabled"
          input-class="cf-toggle-clist-enabled"
          data-control="cbClistEnabled"
          @change="saveSettings()"
        ></toggle-switch
      ></label>
      <ExpandTransition :show="appSettings.ratings.clist.enabled"
        ><div class="cf-clist-subgroup">
          <div
            class="cf-setting-item"
            style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              min-height: 28px;
              margin: 0px;
            "
          >
            <span class="cf-setting-sublabel" v-text="t().clistAuthMode"></span
            ><segmented-switch
              style="width: 110px"
              :model-value="appSettings.ratings.clist.authMode"
              @update:model-value="value=&gt;choose('ratings.clist.authMode',value)"
              :options="[
                {
                  value: 'cookie',
                  label: t('clistAuthLogin'),
                  tooltip: t('clistLoginHelpTooltip'),
                },
                { value: 'api', label: t('clistAuthApi') },
              ]"
            ></segmented-switch>
          </div>
          <ExpandTransition :show="appSettings.ratings.clist.authMode === 'api'"
            ><div style="display: flex; flex-direction: column; gap: 6px">
              <div style="display: flex; align-items: center; justify-content: space-between">
                <div
                  style="display: flex; align-items: center; font-size: var(--cf-font-size-base)"
                >
                  <span class="cf-setting-sublabel" v-text="t().clistApiKeyLabel"></span
                  ><InfoHint
                    :text="t('clistHelpTooltip')"
                    variant="question"
                    :clickable="true"
                    @click="openGuide('clist-key', $event)"
                  />
                </div>
              </div>
              <input
                type="text"
                class="cf-clist-input-box"
                v-model.trim="appSettings.ratings.clist.apiKey"
                v-on:input="saveSettings()"
                v-bind:placeholder="t().clistApiKeyPlaceholder"
                data-control="inputClistApiKey"
              /></div
          ></ExpandTransition>
          <div
            style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              min-height: 32px;
            "
          >
            <div style="display: inline-flex; align-items: center">
              <span class="cf-setting-sublabel" v-text="t().clistSyncTitle"></span
              ><InfoHint
                :text="t('clistSyncTooltip')"
                variant="warning"
                :clickable="true"
                @click="openGuide('clist-sync', $event)"
              />
            </div>
            <ActionButton
              class="cf-clist-sync-btn"
              type="button"
              v-on:click="startSync"
              v-bind:disabled="syncDisabled"
              :class="{ syncing, cooldown: !syncing && syncDisabled }"
            >
              <inline-svg v-bind:source="assets.syncIcon"></inline-svg
              ><span v-text="syncLabel"></span>
            </ActionButton>
          </div></div
      ></ExpandTransition>
    </div>
    <label class="cf-setting-item" style="cursor: pointer; user-select: none; margin: 0px"
      ><span class="cf-setting-label" v-text="t().masterColorRatings"></span
      ><toggle-switch
        as="div"
        v-model="appSettings.ratings.enabled"
        input-class="cf-toggle-color-ratings"
        data-control="cbColorRatings"
        @change="saveSettings()"
      ></toggle-switch
    ></label>
    <ExpandTransition :show="appSettings.ratings.enabled"
      ><div class="cf-setting-item cf-row-display-style" style="padding-left: 12px">
        <span class="cf-setting-sublabel" v-text="t().displayStyleTitle"></span
        ><segmented-switch
          style="width: 120px"
          :model-value="appSettings.ratings.style"
          @update:model-value="value=&gt;choose('ratings.style',value)"
          :options="[
            { value: 'block', label: t('styleBlock'), class: 'cf-btn-style-block' },
            { value: 'tag', label: t('styleTag'), class: 'cf-btn-style-tag' },
          ]"
          :active-style="ratingSliderStyle"
          :active-color="
            appSettings.ratings.style === 'block' ? 'white' : getRatingTagStyle(2400).text
          "
        ></segmented-switch></div
    ></ExpandTransition>
    <ExpandTransition
      :show="appSettings.ratings.enabled &amp;&amp; appSettings.ratings.style === 'tag'"
      ><div class="cf-ratings-nested">
        <div class="cf-nested-options">
          <label class="cf-setting-item cf-ratings-nested-item cf-row-tag-fill-cell"
            ><span class="cf-setting-sublabel" v-text="t().locTagFillCell"></span
            ><toggle-switch
              as="div"
              v-model="appSettings.ratings.tagFillCell"
              data-control="cbTagFillCell"
              @change="saveSettings()"
            ></toggle-switch
          ></label>
        </div></div
    ></ExpandTransition>
    <ExpandTransition :show="appSettings.ratings.enabled"
      ><div
        class="cf-show-group"
        style="display: flex; flex-direction: column; gap: 8px; padding-left: 12px"
      >
        <div
          class="cf-setting-sublabel"
          style="margin-bottom: 2px"
          v-text="t().locationsTitle"
        ></div>
        <div class="cf-nested-options">
          <label
            v-for="[key, label] in locations"
            :key="key"
            class="cf-setting-item cf-ratings-nested-item"
            ><span class="cf-setting-sublabel">{{ t(label) }}</span
            ><toggle-switch
              as="div"
              v-model="appSettings.ratings.show[key]"
              @change="saveSettings()"
            ></toggle-switch
          ></label>
        </div></div
    ></ExpandTransition>
  </div>
</template>

<style>
.cf-clist-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cf-clist-section-title {
  font-size: var(--cf-font-size-lg);
  font-weight: var(--cf-font-weight-semibold);
  color: var(--cf-gray-700);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cf-clist-subgroup {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-left: 12px;
  transition: all 0.25s ease;
}

/* 子选项下面再分一级的选项行；左侧细线与缩进来自公共样式 cf-nested-options。 */
.cf-ratings-nested {
  padding-left: 12px;
}

.cf-ratings-nested-item {
  font-size: var(--cf-font-size-base);
  cursor: pointer;
  user-select: none;
  margin: 0;
}

.cf-clist-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  cursor: pointer;
  user-select: none;
  position: relative;
  flex-shrink: 0;
  margin-left: 6px;
  font-size: var(--cf-font-size-2xs);
  font-weight: var(--cf-font-weight-bold);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1;
  box-sizing: border-box;
  transition: all 0.2s ease;
  vertical-align: middle;
}

.cf-clist-icon-help {
  background: #e0f2fe;
  color: #0284c7;
  border: 1px solid #bae6fd;
}

.cf-clist-icon-help:hover {
  background: #0284c7;
  color: #ffffff;
  box-shadow: 0 0 6px rgba(2, 132, 199, 0.4);
}

.cf-clist-icon-warn {
  background: #fef3c7;
  color: #d97706;
  border: 1px solid #fde68a;
}

.cf-clist-icon-warn:hover {
  background: #d97706;
  color: #ffffff;
  box-shadow: 0 0 6px rgba(217, 119, 6, 0.4);
}
</style>
