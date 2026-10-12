<script setup>
import { ref } from 'vue';
import { appSettings, saveSettings } from '../../../settings.js';
import { PREDICTION_CACHE_CONTESTS } from '../../../config/defaults.js';
import { translate as t } from '../../../i18n/index.js';
import { participationIdentityIcon } from '../../../assets/index.js';
import { menuTabColor } from '../../../utils/petal-palette.js';
import ToggleSwitch from '../../components/forms/ToggleSwitch/ToggleSwitch.vue';
import NumberInput from '../../components/forms/NumberInput/NumberInput.vue';
import ActionButton from '../../components/forms/ActionButton/ActionButton.vue';
import ExpandTransition from '../../components/transitions/ExpandTransition/ExpandTransition.vue';
import InfoHint from '../../components/tooltips/InfoHint/InfoHint.vue';
import SettingSection from '../../components/settings/SettingSection/SettingSection.vue';
import InlineSvg from '../../components/icons/InlineSvg/InlineSvg.vue';
import DialogTransition from '../../components/transitions/DialogTransition/DialogTransition.vue';
import rankIcon from '../../../assets/icons/prediction/rank-up.svg?raw';
import { toggleFromRow } from '../../../utils/row-toggle.js';
import { backdropClose } from '../../../utils/backdrop.js';
const showIdentityDetails = ref(false);
// 点遮罩关闭身份说明；在弹窗里按下、拖到弹窗外才松开不算。
const identityBackdrop = backdropClose(() => (showIdentityDetails.value = false));
// 每行：身份、类型一栏的文字、说明、个人有没有这种标签、队伍的标签怎么预览
//（数字：末尾带这个人数；null：没有，写 N/A）。
// untrusted 只会出现在个人身上（队伍不在这套补算里）；ghost 只会是队伍，现场赛一般三个人。
const identityRows = [
  ['rated', 'participationIdentityRated', 'participationIdentityRatedDesc', true, 2],
  ['unrated', 'participationIdentityUnrated', 'participationIdentityUnratedDesc', true, 2],
  ['untrusted', 'participationIdentityUntrusted', 'participationIdentityUntrustedDesc', true, null],
  ['virtual', 'participationIdentityVirtual', 'participationIdentityVirtualDesc', true, 2],
  ['practice', 'participationIdentityPractice', 'participationIdentityPracticeDesc', true, 2],
  ['ghost', 'participationIdentityGhost', 'participationIdentityGhostDesc', false, 3],
];
// 每个功能下面的子选项分成几段（功能、样式、内容，见 SettingSection）。options 是这一段里的开关；
// cache 为真的一段末尾另有「缓存比赛场数」的数字框；fold 为真的一段可以折叠，标题右边写已选了几项。
const groups = [
  {
    key: 'prediction',
    title: 'predictionEnable',
    hint: 'predictionSettingsHint',
    sections: [
      {
        id: 'function',
        title: 'settingSectionFunction',
        cache: true,
        options: [['syncStandings', 'predictionSyncStandings']],
      },
      {
        id: 'style',
        title: 'settingSectionStyle',
        options: [['followRatingStyle', 'predictionFollowStyle']],
      },
      {
        id: 'content',
        title: 'settingSectionContent',
        fold: true,
        options: [
          ['delta', 'predictionDelta'],
          ['performance', 'predictionPerformance'],
          ['rankChange', 'predictionRankChange'],
          ['ratedRank', 'predictionRatedRank'],
          ['analysis', 'predictionAnalyze'],
        ],
      },
    ],
  },
  {
    key: 'participationTags',
    title: 'participationEnable',
    hint: 'participationHint',
    sections: [
      {
        id: 'content',
        title: 'settingSectionContent',
        fold: true,
        options: [
          ['rated', 'participationRated'],
          ['unrated', 'participationUnrated'],
          ['untrusted', 'participationUntrusted'],
          ['virtual', 'participationVirtual'],
          ['practice', 'participationPractice'],
          ['ghost', 'participationGhost'],
        ],
      },
    ],
  },
];
// 一段里开着几项。
const selected = (group, section) =>
  section.options.filter(([key]) => appSettings.contest[group.key][key]).length;
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
            v-model="appSettings.contest[group.key].enabled"
            :data-control="group.key"
            @change="saveSettings()"
          />
        </div>
        <ExpandTransition :show="appSettings.contest[group.key].enabled">
          <div class="cf-prediction-subsettings">
            <SettingSection
              v-for="section in group.sections"
              :key="section.id"
              :title="t(section.title)"
              :foldable="section.fold"
              :summary="
                section.fold
                  ? t('settingSelected', selected(group, section), section.options.length)
                  : ''
              "
              :muted="section.fold && selected(group, section) === 0"
            >
              <label v-for="[key, label] in section.options" :key="key" class="cf-setting-item">
                <span class="cf-setting-sublabel"
                  ><span>{{ t(label) }}</span
                  ><InlineSvg
                    v-if="key === 'rankChange'"
                    :source="rankIcon"
                    class="cf-prediction-option-icon"
                /></span>
                <ToggleSwitch
                  as="div"
                  v-model="appSettings.contest[group.key][key]"
                  @change="saveSettings()"
                />
              </label>
              <!-- 整行不做成 label：否则行里的说明图标会被当成它对应的控件，鼠标停在空白处也显示成悬停。 -->
              <div v-if="section.cache" class="cf-setting-item cf-prediction-number-row">
                <span class="cf-setting-sublabel"
                  ><label for="cf-prediction-control-cache-contests">{{
                    t('predictionCacheContests')
                  }}</label
                  ><InfoHint :text="t('predictionCacheContestsHint')"
                /></span>
                <NumberInput
                  v-model="appSettings.contest.prediction.cacheContests"
                  clamp
                  :min="PREDICTION_CACHE_CONTESTS.min"
                  :max="PREDICTION_CACHE_CONTESTS.max"
                  input-id="cf-prediction-control-cache-contests"
                  data-control="predictionCacheContests"
                  @change="saveSettings()"
                />
              </div>
            </SettingSection>
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
              <span
                class="cf-modal-title-icon cf-aurora-emblem"
                :style="{ '--cf-emblem-petal': menuTabColor('prediction') }"
                ><InlineSvg :source="participationIdentityIcon"
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
                    <th scope="col">{{ t('participationIdentityTeamPreview') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="[status, label, desc, solo, team] in identityRows" :key="status">
                    <td>{{ t(label) }}</td>
                    <td>{{ t(desc) }}</td>
                    <td>
                      <span v-if="solo" class="cf-participation-tag" :data-status="status">{{
                        status
                      }}</span>
                      <template v-else>N/A</template>
                    </td>
                    <td>
                      <span
                        v-if="team !== null"
                        class="cf-participation-tag"
                        :data-status="status"
                        :data-team-size="team"
                        >{{ status }}</span
                      >
                      <template v-else>N/A</template>
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
/* 数字输入这一行没有开关，行内空白处不可点，只有文字可点（点了聚焦输入框）。 */
.cf-prediction-number-row {
  cursor: default;
}
.cf-prediction-number-row label {
  cursor: pointer;
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
/* 弹窗宽度跟随表格内容，但有上限：说明都短的时候各排一行，有长说明时在说明一栏里折行，
   不让弹窗跟着最长的那一句一直变宽。 */
.cf-identity-help-card {
  width: max-content;
  max-width: min(800px, 92vw);
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
}
/*
 * 按「第几列」写的规则都限定成行的直接子元素（tr > td）。换语言的过渡会把旧内容的格子复制一份贴在格子里面
 *（见 utils/language-wave.js），那份副本是格子里唯一的子元素，既是第一个也是最后一个：不限定的话，
 * 说明一栏的副本会被当成第一列和最后一列，过渡的那一瞬间变成加粗、居中、不折行。
 */
/* 类型和两栏标签预览不折行，折行只发生在说明一栏。 */
.cf-identity-help-table th,
.cf-identity-help-table tr > td:first-child,
.cf-identity-help-table tr > td:nth-last-child(-n + 2) {
  white-space: nowrap;
}
.cf-identity-help-table td {
  color: var(--cf-aurora-text);
}
.cf-identity-help-table tbody tr:last-child td {
  border-bottom: 0;
}
.cf-identity-help-table tr > th:first-child,
.cf-identity-help-table tr > td:first-child {
  color: var(--cf-control-ink);
  font-weight: var(--cf-font-weight-semibold);
}
.cf-identity-help-table tr > td:nth-last-child(-n + 2),
.cf-identity-help-table tr > th:nth-last-child(-n + 2) {
  text-align: center;
}
/* 窗口窄时格子的左右留白收一点。 */
@media (max-width: 760px) {
  .cf-identity-help-table th,
  .cf-identity-help-table td {
    padding: 9px 12px;
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
