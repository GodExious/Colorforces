<script>
import * as cfAssets from '../../../../../assets/index.js';
import InlineSvg from '../../../../components/icons/InlineSvg/InlineSvg.vue';
import { reactive } from 'vue';
import { translate as t } from '../../../../../i18n/index.js';
const initial = {
  exists: false,
  visible: false,
  status: 'connecting',
  data: {},
  percent: 0,
  pulled: 0,
  total: 11614,
  etaSeconds: null,
  successCount: 0,
  error: '',
  retry: null,
};
export const sync = reactive({ ...initial });
// 各同步阶段共用总剩余时间，等待重试的秒数只在状态行显示。
function etaText() {
  if (sync.status === 'success') return t('syncStatusFinished');
  if (sync.status === 'error') return '—';
  if (sync.etaSeconds > 0) {
    const min = Math.floor(sync.etaSeconds / 60),
      sec = sync.etaSeconds % 60;
    return min > 0 ? t('syncEtaMinutesSeconds', min, sec) : t('syncEtaSeconds', sec);
  }
  return t('syncEtaEstimating');
}
const controller = {
  show() {
    sync.visible = true;
  },
  hide() {
    sync.visible = false;
  },
  destroy() {
    sync.visible = false;
    sync.exists = false;
  },
  getEtaText: etaText,
  updateLanguage() {},
  update(info) {
    if (info.statusType) {
      sync.status = info.statusType;
      sync.data = info.statusData || {};
    } else if (info.status) {
      sync.status = 'custom';
      sync.data = { rawStatus: info.status };
    }
    if (info.etaSeconds !== undefined) sync.etaSeconds = info.etaSeconds;
    else if (info.eta) sync.data.rawEta = info.eta;
    if (info.percent !== undefined) sync.percent = Math.min(100, Math.max(0, info.percent));
    if (info.pulled !== undefined) sync.pulled = info.pulled;
    if (info.total !== undefined) sync.total = info.total;
  },
  setSuccess(count) {
    sync.status = 'success';
    sync.successCount = count;
  },
  setError(message, retry) {
    sync.status = 'error';
    sync.error = message;
    sync.retry = retry;
  },
};
// 打开或恢复唯一进度视图，不启动第二个同步任务。
export function openClistSyncProgress() {
  if (!sync.exists) Object.assign(sync, { ...initial, data: {}, exists: true });
  sync.visible = true;
  return controller;
}
</script>
<script setup>
import DialogTransition from '../../../../components/transitions/DialogTransition/DialogTransition.vue';
import ActionButton from '../../../../components/forms/ActionButton/ActionButton.vue';
import { computed, ref, watch } from 'vue';
import { preventScrollChaining } from '../../../../../utils/scroll.js';
const overlay = ref(null);
const eta = computed(etaText);
const finished = computed(() => ['success', 'error'].includes(sync.status));
const percent = computed(() => (sync.status === 'success' ? 100 : sync.percent));
const fillStyle = computed(() => ({
  width: percent.value + '%',
}));
const statusHtml = computed(() => {
  if (sync.status === 'connecting') return t('syncInitConnecting');
  if (sync.status === 'fetching')
    return t(
      'syncStatusFetching',
      sync.pulled,
      sync.total,
      sync.data.page || 1,
      sync.data.totalPages || 3,
    );
  if (sync.status === 'waiting') return t('syncWaitIntervalStatus', sync.data.seconds || 8);
  if (sync.status === 'rate_limited') return t('syncRateLimitedStatus', sync.data.seconds || 60);
  if (sync.status === 'success')
    return (
      '<span style=' +
      String.fromCharCode(34) +
      'color:#16a34a;font-weight:600;' +
      String.fromCharCode(34) +
      '>✓ ' +
      t('syncStatusSuccess', sync.successCount) +
      '</span>'
    );
  if (sync.status === 'error')
    return (
      '<span style=' +
      String.fromCharCode(34) +
      'color:#dc2626;font-weight:600;' +
      String.fromCharCode(34) +
      '>✗ ' +
      t('syncStatusInterrupted') +
      '</span>'
    );
  // 外部错误或状态按纯文本显示，只有内置翻译允许富文本。
  return String(sync.data.rawStatus || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
});
// 同步中只隐藏弹窗；失败后关闭释放视图。
function backgroundAction() {
  if (sync.status === 'error') controller.destroy();
  else controller.hide();
}
// 完成后关闭；失败时执行任务提供的原重试回调。
function primaryAction() {
  if (sync.status === 'success') {
    controller.destroy();
    return;
  }
  const retry = sync.retry;
  sync.status = 'connecting';
  sync.retry = null;
  sync.error = '';
  retry?.();
}
watch(overlay, (node) => {
  if (node) preventScrollChaining(node);
});
</script>
<template>
  <Teleport to="body"
    ><DialogTransition
      ><div
        class="cf-clist-modal-overlay cf-clist-progress-modal"
        :class="{
          'is-syncing': !finished,
          'is-success': sync.status === 'success',
          'is-error': sync.status === 'error',
        }"
        v-if="sync.exists"
        v-show="sync.visible"
        ref="overlay"
      >
        <div class="cf-clist-modal-card" style="width: 520px">
          <div class="cf-clist-modal-header">
            <div class="cf-clist-modal-title">
              <span class="cf-progress-sync-icon"
                ><InlineSvg :source="cfAssets.clistSyncDialogIcon"
              /></span>
              <span class="cf-progress-modal-title" v-text="t('syncModalTitle')"></span>
            </div>
            <button
              type="button"
              class="cf-modal-close-btn"
              style="
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #64748b;
              "
              v-on:click="controller.hide"
              v-bind:title="t('syncBtnBackground')"
            >
              ×
            </button>
          </div>
          <div class="cf-clist-modal-body">
            <div class="cf-progress-heading">
              <div class="cf-progress-status" v-html="statusHtml"></div>
              <strong class="cf-progress-percent">{{ Math.round(percent) }}%</strong>
            </div>

            <div
              class="cf-clist-progress-track"
              role="progressbar"
              :aria-label="t('syncModalTitle')"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-valuenow="percent"
            >
              <div class="cf-clist-progress-fill" v-bind:style="fillStyle"></div>
            </div>

            <div class="cf-progress-metrics">
              <div>
                <span class="cf-label-pulled" v-text="t('syncLabelPulled')"></span>:
                <strong class="cf-val-pulled" v-text="sync.pulled.toLocaleString()"></strong>
                /
                <span
                  class="cf-val-total"
                  v-text="t('syncApproxCount', sync.total.toLocaleString())"
                ></span>
              </div>
              <div class="cf-progress-eta">
                <span class="cf-label-eta" v-text="t('syncLabelEta')"></span>:
                <strong class="cf-val-eta" v-text="eta"></strong>
              </div>
            </div>

            <div class="cf-progress-tip" v-text="t('syncNoticeTip')" v-show="!finished"></div>

            <div
              class="cf-progress-error"
              style="
                background: rgb(254, 242, 242);
                border: 1px solid rgb(254, 202, 202);
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 12px;
                color: rgb(185, 28, 28);
                margin-top: 12px;
                line-height: 1.5;
              "
              v-text="sync.error"
              v-show="sync.status === 'error'"
            ></div>
          </div>
          <div class="cf-clist-modal-footer" style="gap: 8px">
            <ActionButton
              type="button"
              class="cf-clist-sync-btn cf-btn-bg"
              style="font-size: 12px; display: inline-flex"
              v-text="sync.status === 'error' ? t('syncBtnClose') : t('syncBtnBackground')"
              v-show="sync.status !== 'success'"
              v-on:click="backgroundAction"
            ></ActionButton>
            <ActionButton
              type="button"
              class="cf-clist-sync-btn cf-btn-action"
              v-show="sync.status==='success'||(sync.status==='error'&amp;&amp;sync.retry)"
              v-text="sync.status === 'success' ? t('syncBtnDone') : t('syncBtnRetry')"
              v-on:click="primaryAction"
            ></ActionButton>
          </div>
        </div></div></DialogTransition
  ></Teleport>
</template>

<style>
.cf-clist-progress-modal {
  --cf-menu-accent: #c999d8;
  --cf-menu-secondary: #8fc8c1;
  --cf-card-surface: #fbf9ff;
  --cf-control-surface: #f4f1fa;
  --cf-control-active: #f2e8f3;
  --cf-surface-border: #e1d8ec;
  --cf-control-ink: #5a5872;
  background: rgba(65, 57, 91, 0.38);
}
.cf-clist-progress-modal .cf-clist-modal-body {
  min-width: 0;
  overflow-wrap: anywhere;
}
.cf-clist-progress-modal .cf-clist-modal-card {
  background:
    radial-gradient(ellipse at 0% 0%, #e7e2ffcc, transparent 63%),
    radial-gradient(ellipse at 100% 22%, #ffe2efc4, transparent 58%),
    radial-gradient(ellipse at 72% 100%, #dff5edc4, transparent 64%), #fbf9ff;
}
.cf-clist-progress-modal .cf-progress-status {
  min-width: 0;
}
.cf-clist-progress-modal .cf-progress-sync-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex: none;
}
.cf-clist-progress-modal.is-syncing .cf-progress-sync-icon {
  animation: cfSpin 1.8s linear infinite;
}
.cf-clist-progress-modal .cf-progress-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: var(--cf-control-ink);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.6;
}
.cf-clist-progress-modal .cf-progress-percent {
  flex: none;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
.cf-clist-progress-modal .cf-clist-progress-track {
  /* 百分比宽度包含边框，避免额外两像素撑出横向滚动条。 */
  box-sizing: border-box;
  height: 9px;
  margin: 10px 0;
  border: 1px solid var(--cf-surface-border);
  border-radius: 99px;
  background: var(--cf-control-surface);
}
.cf-clist-progress-modal .cf-clist-progress-fill {
  position: relative;
  overflow: hidden;
  border-radius: inherit;
  background: linear-gradient(100deg, var(--cf-menu-secondary), var(--cf-menu-accent));
  transition: width 650ms cubic-bezier(0.22, 1, 0.36, 1);
}
.cf-clist-progress-modal.is-syncing .cf-clist-progress-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 20%, #ffffff65 50%, transparent 80%);
  animation: cf-sync-progress-sheen 2.6s ease-in-out infinite;
}
.cf-clist-progress-modal.is-success .cf-clist-progress-fill {
  background: linear-gradient(100deg, #74c5a1, #29976b);
}
.cf-clist-progress-modal.is-error .cf-clist-progress-fill {
  background: #d88c93;
}
.cf-clist-progress-modal .cf-progress-metrics {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px 16px;
  font-size: 12px;
  line-height: 1.7;
  color: color-mix(in srgb, var(--cf-control-ink) 65%, #64748b);
  font-variant-numeric: tabular-nums;
}
.cf-clist-progress-modal .cf-progress-metrics strong {
  color: var(--cf-control-ink);
}
.cf-clist-progress-modal .cf-progress-eta {
  margin-left: auto;
  text-align: right;
}
.cf-clist-progress-modal .cf-val-eta {
  display: inline-block;
  min-width: 7.5em;
}
.cf-clist-progress-modal .cf-progress-tip {
  background: var(--cf-control-active);
  border: 1px solid var(--cf-surface-border);
  border-radius: 8px;
  padding: 10px 12px;
  margin-top: 16px;
  font-size: 12px;
  color: var(--cf-control-ink);
  line-height: 1.6;
}
.cf-clist-progress-modal .cf-btn-action {
  font-weight: 600;
}
@keyframes cf-sync-progress-sheen {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .cf-clist-progress-modal .cf-progress-sync-icon,
  .cf-clist-progress-modal .cf-clist-progress-fill::after {
    animation: none !important;
  }
  .cf-clist-progress-modal .cf-clist-progress-fill {
    transition: none;
  }
}
.cf-clist-input-box {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 10px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  border-radius: 6px;
  outline: none;
  color: #334155;
}
</style>
