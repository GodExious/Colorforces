<script setup>
import { ref } from 'vue';
import { appSettings, saveSettings } from '../../../settings.js';
import { translate as t } from '../../../i18n/index.js';
import ToggleSwitch from '../../components/forms/ToggleSwitch/ToggleSwitch.vue';
import ExpandTransition from '../../components/transitions/ExpandTransition/ExpandTransition.vue';
import InfoHint from '../../components/tooltips/InfoHint/InfoHint.vue';
import InlineSvg from '../../components/icons/InlineSvg/InlineSvg.vue';
import DialogTransition from '../../components/transitions/DialogTransition/DialogTransition.vue';
import rankIcon from '../../../assets/icons/prediction/rank-up.svg?raw';
import { toggleFromRow } from '../../../utils/row-toggle.js';
const showIdentityDetails = ref(false);
const identityRows = [
  ['rated', 'participationIdentityRated', 'participationIdentityRatedDesc'],
  ['unrated', 'participationIdentityUnrated', 'participationIdentityUnratedDesc'],
  ['virtual', 'participationIdentityVirtual', 'participationIdentityVirtualDesc'],
];
const groups = [
  {
    key: 'prediction',
    title: 'predictionEnable',
    hint: 'predictionSettingsHint',
    options: [
      ['delta', 'predictionDelta'],
      ['performance', 'predictionPerformance'],
      ['rankChange', 'predictionRankChange'],
      ['ratedRank', 'predictionRatedRank'],
      ['analysis', 'predictionAnalyze'],
      ['followRatingStyle', 'predictionFollowStyle'],
    ],
  },
  {
    key: 'participationTags',
    title: 'participationEnable',
    hint: 'participationHint',
    options: [
      ['rated', 'participationRated'],
      ['unrated', 'participationUnrated'],
      ['virtual', 'participationVirtual'],
    ],
  },
];
</script>
<template>
  <div class="cf-tab-panel">
    <section class="cf-contest-settings">
      <div v-for="group in groups" :key="group.key">
        <div class="cf-setting-item" @click="toggleFromRow">
          <span class="cf-setting-label"
            ><label :for="`cf-participation-control-${group.key}`">{{ t(group.title) }}</label
            ><InfoHint
              :text="
                group.key === 'participationTags' ? t('participationHintShort') : t(group.hint)
              "
              :symbol="group.key === 'participationTags' ? '?' : 'i'"
              :variant="group.key === 'participationTags' ? 'question' : 'info'"
              :clickable="group.key === 'participationTags'"
              @click="group.key === 'participationTags' && (showIdentityDetails = true)"
          /></span>
          <ToggleSwitch
            as="label"
            :input-id="`cf-participation-control-${group.key}`"
            v-model="appSettings[group.key].enabled"
            :data-control="group.key"
            @change="saveSettings()"
          />
        </div>
        <ExpandTransition :show="appSettings[group.key].enabled">
          <div class="cf-prediction-subsettings">
            <label v-for="[key, label] in group.options" :key="key" class="cf-setting-item">
              <span class="cf-setting-sublabel"
                >{{ t(label)
                }}<InlineSvg
                  v-if="key === 'rankChange'"
                  :source="rankIcon"
                  class="cf-prediction-option-icon"
              /></span>
              <ToggleSwitch
                as="div"
                v-model="appSettings[group.key][key]"
                @change="saveSettings()"
              />
            </label>
          </div>
        </ExpandTransition>
      </div>
    </section>
  </div>
  <Teleport to="body">
    <DialogTransition>
      <div
        v-if="showIdentityDetails"
        class="cf-identity-help-overlay"
        @click.self="showIdentityDetails = false"
      >
        <section
          class="cf-identity-help-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cf-identity-help-title"
        >
          <header>
            <strong id="cf-identity-help-title">{{ t('participationIdentityTitle') }}</strong>
            <button
              type="button"
              :aria-label="t('participationIdentityClose')"
              @click="showIdentityDetails = false"
            >
              ×
            </button>
          </header>
          <div class="cf-identity-help-table-wrap">
            <table class="cf-identity-help-table">
              <thead>
                <tr>
                  <th scope="col">{{ t('participationIdentityType') }}</th>
                  <th scope="col">{{ t('participationIdentityMeaning') }}</th>
                  <th scope="col">{{ t('participationIdentityPreview') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="[status, label, desc] in identityRows" :key="status">
                  <td>{{ t(label) }}</td>
                  <td>{{ t(desc) }}</td>
                  <td>
                    <span class="cf-participation-tag" :data-status="status">
                      {{ t(label) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <button type="button" class="cf-identity-help-close" @click="showIdentityDetails = false">
            {{ t('participationIdentityClose') }}
          </button>
        </section>
      </div>
    </DialogTransition>
  </Teleport>
</template>
<style scoped>
.cf-contest-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cf-setting-item {
  cursor: pointer;
  user-select: none;
  margin: 0;
}
.cf-prediction-subsettings {
  padding-left: 12px;
}
.cf-setting-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.cf-setting-sublabel {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.cf-prediction-option-icon {
  width: 13px;
  height: 13px;
}
.cf-identity-help-overlay {
  box-sizing: border-box;
  position: fixed;
  inset: 0;
  z-index: 2147483645;
  display: grid;
  place-items: center;
  padding: 18px;
  background: #26344942;
  backdrop-filter: blur(3px);
}
.cf-identity-help-card {
  box-sizing: border-box;
  width: min(540px, 100%);
  max-height: 88vh;
  overflow-y: auto;
  padding: 18px;
  border: 1px solid #ffffffd9;
  border-radius: 16px;
  background: linear-gradient(135deg, #f1f6ff, #fff4f6 58%, #effaf5);
  box-shadow: 0 20px 60px #26344935;
  color: #4e5d73;
}
.cf-identity-help-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.cf-identity-help-card header button {
  border: 0;
  background: none;
  color: #708097;
  font-size: 21px;
  cursor: pointer;
}
.cf-identity-help-table-wrap {
  overflow-x: auto;
  border: 1px solid #ffffffc7;
  border-radius: 12px;
  background: #ffffff70;
}
.cf-identity-help-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 11.5px;
  line-height: 1.45;
}
.cf-identity-help-table th,
.cf-identity-help-table td {
  padding: 8px 9px;
  border-bottom: 1px solid #ffffffb8;
  text-align: left;
  vertical-align: middle;
  overflow-wrap: break-word;
}
/* 榜单标签本来是绝对定位并在进入时展开，表内预览必须独立静态展示。 */
.cf-identity-help-table .cf-participation-tag {
  position: static;
  transform: none;
  clip-path: none;
  opacity: 1;
  transition: none;
}
/* 与其他幻彩说明框一致：表头加深，表体不使用斑马纹。 */
.cf-identity-help-table thead tr {
  background: linear-gradient(90deg, #d9e4f3, #e6def1 55%, #d8ece6);
}
.cf-identity-help-table th {
  color: #4b5c76;
  background: transparent;
  border-bottom-color: #c9d6e7;
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: 0.02em;
}
.cf-identity-help-table tbody tr,
.cf-identity-help-table tbody tr:nth-child(even),
.cf-identity-help-table tbody tr:nth-child(odd),
.cf-identity-help-table tbody td {
  background: transparent !important;
}
.cf-identity-help-table td {
  color: #53647c;
}
.cf-identity-help-table tr:last-child td {
  border-bottom: 0;
}
.cf-identity-help-table th:first-child,
.cf-identity-help-table td:first-child {
  width: 18%;
  font-weight: 600;
}
.cf-identity-help-table td:last-child,
.cf-identity-help-table th:last-child {
  width: 25%;
  text-align: center;
}
.cf-identity-help-close {
  display: block;
  margin: 15px 0 0 auto;
  padding: 6px 14px;
  border: 1px solid #b8c9df;
  border-radius: 8px;
  background: #ffffff9c;
  color: #506b8e;
  cursor: pointer;
}
</style>
