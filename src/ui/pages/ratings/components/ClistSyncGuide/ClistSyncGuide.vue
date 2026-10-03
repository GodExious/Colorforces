<script>
import { ref } from 'vue';
const visible = ref(false);
const origin = ref(null);
// 打开「CList 同步说明」，弹窗从触发它的图标位置展开。
export function openClistSyncGuide(anchor) {
  origin.value = anchor?.getBoundingClientRect().toJSON();
  visible.value = true;
}
</script>
<script setup>
import { computed } from 'vue';
import * as cfAssets from '../../../../../assets/index.js';
import { translate as t } from '../../../../../i18n/index.js';
import GuideDialog from '../../../../components/dialogs/GuideDialog/GuideDialog.vue';
// 三个关键数字、三步流程、三种异常，文案全部来自语言文件。
const facts = [
  ['specFactRequestsValue', 'specFactRequestsLabel'],
  ['specFactDurationValue', 'specFactDurationLabel'],
  ['specFactCooldownValue', 'specFactCooldownLabel'],
];
const steps = [
  ['specStepFetchTitle', 'specStepFetchDesc'],
  ['specStepWaitTitle', 'specStepWaitDesc'],
  ['specStepSaveTitle', 'specStepSaveDesc'],
];
const notes = [
  ['specNoteRateLimitLabel', 'specNoteRateLimitDesc'],
  ['specNoteFailureLabel', 'specNoteFailureDesc'],
  ['specNoteBackgroundLabel', 'specNoteBackgroundDesc'],
];
const options = computed(() => ({
  className: 'cf-clist-spec-modal',
  width: '560px',
  iconSvg: cfAssets.clistSyncGuideIcon,
  title: t('specModalTitle'),
  confirmText: t('specConfirmBtn'),
}));
</script>
<template>
  <GuideDialog :visible="visible" :origin="origin" :options="options" @close="visible = false">
    <div class="cf-sync-guide">
      <div class="cf-sync-facts">
        <div v-for="[value, label] in facts" :key="value" class="cf-sync-fact">
          <strong>{{ t(value) }}</strong>
          <span>{{ t(label) }}</span>
        </div>
      </div>

      <div class="cf-sync-section-title">{{ t('specStepsTitle') }}</div>
      <div class="cf-sync-steps" role="list">
        <div v-for="[title, desc] in steps" :key="title" class="cf-sync-step" role="listitem">
          <div class="cf-sync-step-title">{{ t(title) }}</div>
          <div class="cf-sync-step-desc">{{ t(desc) }}</div>
        </div>
      </div>

      <div class="cf-sync-notes">
        <div class="cf-sync-section-title">{{ t('specNotesTitle') }}</div>
        <div v-for="[label, desc] in notes" :key="label" class="cf-sync-note">
          <b>{{ t(label) }}</b
          ><span>{{ t(desc) }}</span>
        </div>
      </div>
    </div>
  </GuideDialog>
</template>
<style scoped>
/*
 * 三段内容用三种不同的版式，避免「三张一样的卡片」：
 * 关键数字是一条分栏的色带，同步流程是带编号和连线的时间轴，异常处理是一块左侧描边的提示。
 */
.cf-sync-guide {
  display: flex;
  flex-direction: column;
  color: var(--cf-gray-600);
  font-size: var(--cf-font-size-md);
  line-height: 1.65;
}

.cf-sync-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid color-mix(in srgb, var(--cf-menu-accent) 22%, #ffffff);
  border-radius: var(--cf-radius-xl);
  background: linear-gradient(
    120deg,
    color-mix(in srgb, var(--cf-menu-accent) 15%, #ffffff),
    color-mix(in srgb, var(--cf-menu-secondary) 12%, #ffffff)
  );
  box-shadow: inset 0 1px 0 #ffffffb3;
}
.cf-sync-fact {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  padding: 12px 16px 13px;
}
.cf-sync-fact + .cf-sync-fact {
  border-left: 1px solid color-mix(in srgb, var(--cf-menu-accent) 20%, #ffffff);
}
.cf-sync-fact strong {
  color: var(--cf-control-ink);
  font-size: 20px;
  font-weight: var(--cf-font-weight-bold);
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
}
.cf-sync-fact span {
  color: color-mix(in srgb, var(--cf-control-ink) 62%, var(--cf-gray-400));
  font-size: var(--cf-font-size-sm);
  line-height: 1.4;
}

.cf-sync-section-title {
  margin: 20px 0 10px;
  color: color-mix(in srgb, var(--cf-control-ink) 70%, var(--cf-gray-400));
  font-size: var(--cf-font-size-sm);
  font-weight: var(--cf-font-weight-semibold);
  letter-spacing: 0.06em;
}

.cf-sync-steps {
  counter-reset: cf-sync-step;
}
.cf-sync-step {
  position: relative;
  padding: 0 0 16px 38px;
  counter-increment: cf-sync-step;
}
.cf-sync-step:last-child {
  padding-bottom: 0;
}
.cf-sync-step::before {
  content: counter(cf-sync-step);
  position: absolute;
  left: 0;
  top: 0;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--cf-menu-accent) 70%, #2b3a55);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--cf-menu-accent) 16%, #ffffff);
  color: #fff;
  font:
    700 12px/1 Arial,
    sans-serif;
}
.cf-sync-step:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 11.5px;
  top: 32px;
  bottom: 4px;
  width: 1px;
  background: color-mix(in srgb, var(--cf-menu-accent) 34%, #e3e8f0);
}
.cf-sync-step-title {
  color: var(--cf-control-ink);
  font-size: var(--cf-font-size-lg);
  font-weight: var(--cf-font-weight-semibold);
  line-height: 24px;
}

.cf-sync-notes {
  margin-top: 20px;
  padding: 12px 14px 12px 15px;
  border-left: 3px solid color-mix(in srgb, var(--cf-menu-accent) 62%, #ffffff);
  border-radius: 4px var(--cf-radius-lg) var(--cf-radius-lg) 4px;
  background: var(--cf-control-surface);
}
.cf-sync-notes .cf-sync-section-title {
  margin: 0 0 6px;
}
.cf-sync-note {
  display: grid;
  grid-template-columns: minmax(8em, 30%) minmax(0, 1fr);
  gap: 2px 12px;
  padding: 4px 0;
  font-size: var(--cf-font-size-base);
}
.cf-sync-note b {
  color: var(--cf-gray-700);
  font-weight: var(--cf-font-weight-semibold);
}
@media (max-width: 520px) {
  .cf-sync-note {
    grid-template-columns: 1fr;
  }
}
</style>
