<script setup>
import { ref } from 'vue';
import { appSettings, saveSettings } from '../../../settings.js';
import { translate as t } from '../../../i18n/index.js';
import { menuPredictionIcon } from '../../../assets/index.js';
import ToggleSwitch from '../../components/forms/ToggleSwitch/ToggleSwitch.vue';
import ActionButton from '../../components/forms/ActionButton/ActionButton.vue';
import ExpandTransition from '../../components/transitions/ExpandTransition/ExpandTransition.vue';
import InfoHint from '../../components/tooltips/InfoHint/InfoHint.vue';
import InlineSvg from '../../components/icons/InlineSvg/InlineSvg.vue';
import DialogTransition from '../../components/transitions/DialogTransition/DialogTransition.vue';
import rankIcon from '../../../assets/icons/prediction/rank-up.svg?raw';
import { toggleFromRow } from '../../../utils/row-toggle.js';
import { backdropClose } from '../../../utils/backdrop.js';
const showIdentityDetails = ref(false);
// 点遮罩关闭身份说明；在弹窗里按下、拖到弹窗外才松开不算。
const identityBackdrop = backdropClose(() => (showIdentityDetails.value = false));
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
        class="cf-clist-modal-overlay cf-aurora-dialog cf-guide-theme"
        v-on="identityBackdrop"
      >
        <section
          class="cf-clist-modal-card cf-aurora-card cf-identity-help-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cf-identity-help-title"
        >
          <div class="cf-clist-modal-header">
            <div class="cf-clist-modal-title">
              <span class="cf-modal-title-icon cf-aurora-emblem"
                ><InlineSvg :source="menuPredictionIcon"
              /></span>
              <span id="cf-identity-help-title">{{ t('participationIdentityTitle') }}</span>
            </div>
            <button
              type="button"
              class="cf-modal-close-btn cf-aurora-close"
              :aria-label="t('participationIdentityClose')"
              @click="showIdentityDetails = false"
            >
              ×
            </button>
          </div>
          <div class="cf-clist-modal-body">
            <div class="cf-guide-table-wrap">
              <table class="cf-guide-table cf-identity-help-table">
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
                      <span class="cf-participation-tag" :data-status="status">{{ t(label) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="cf-clist-modal-footer">
            <ActionButton
              type="button"
              class="cf-modal-primary-btn"
              @click="showIdentityDetails = false"
            >
              {{ t('participationIdentityClose') }}
            </ActionButton>
          </div>
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
/* 间距与「难度分」页的展示位置列表一致：总开关与首个子项隔 12px，子项行高 28px、彼此隔 8px。 */
.cf-prediction-subsettings {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0 0 12px;
}
.cf-prediction-subsettings .cf-setting-item {
  min-height: 28px;
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
/* 外壳、表头与按钮沿用共用的说明弹窗样式，这里只补充本表格的列宽与单元格间距。 */
/* 弹窗宽度跟随表格内容：每行说明都排在一行里，三列各自对齐，不因固定宽度而折行。 */
.cf-identity-help-card {
  width: max-content;
  max-width: 92vw;
}
.cf-identity-help-table {
  line-height: 1.5;
}
.cf-identity-help-table th,
.cf-identity-help-table td {
  padding: 9px 16px;
  border-bottom: 1px solid var(--cf-surface-border);
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}
.cf-identity-help-table td {
  color: var(--cf-aurora-text);
}
.cf-identity-help-table tbody tr:last-child td {
  border-bottom: 0;
}
.cf-identity-help-table th:first-child,
.cf-identity-help-table td:first-child {
  color: var(--cf-control-ink);
  font-weight: var(--cf-font-weight-semibold);
}
.cf-identity-help-table td:last-child,
.cf-identity-help-table th:last-child {
  text-align: center;
}
/* 窗口窄到放不下一行时，才允许说明文字折行。 */
@media (max-width: 760px) {
  .cf-identity-help-table th,
  .cf-identity-help-table td {
    padding: 9px 12px;
    white-space: normal;
  }
  .cf-identity-help-table td:first-child,
  .cf-identity-help-table td:last-child {
    white-space: nowrap;
  }
}
/* 榜单标签本来是绝对定位并在进入时展开，表内预览必须独立静态展示。 */
.cf-identity-help-table .cf-participation-tag {
  position: static;
  transform: none;
  clip-path: none;
  opacity: 1;
  transition: none;
}
</style>
