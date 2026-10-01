<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { translate as t } from '../../../i18n/index.js';
import * as assets from '../../../assets/index.js';
import InlineSvg from '../../components/icons/InlineSvg/InlineSvg.vue';
import { readStorageOverview } from '../../../features/storage/overview.js';
import { clearStorageGroup, subscribeStorageChanges } from '../../../features/storage/cleanup.js';
import { appStorage, subscribeStorageWrites } from '../../../storage/gm.js';
import { latestRatingsMap, parallelContestsCache } from '../../../features/ratings/data.js';
import { sortProblemKeys } from '../../../utils/problem.js';
import { CACHE_KEY, PARALLEL_CONTESTS_KEY, AVATAR_CACHE_KEY } from '../../../storage/keys.js';
import { showConfirmPop } from '../../components/dialogs/ConfirmDialog/ConfirmDialog.vue';
import {
  showStorageJsonModal,
  showStorageJsonDocument,
} from './components/StorageJsonDialog/StorageJsonDialog.vue';
import StorageCard from './components/StorageCard/StorageCard.vue';
import StorageUsageChart from './components/StorageUsageChart/StorageUsageChart.vue';
const props = defineProps({ active: Boolean });
const groups = [
  {
    id: 'settings',
    title: 'storageSettingsTitle',
    description: 'storageSettingsDesc',
    action: 'storageSettingsResetBtn',
    confirm: 'storageSettingsResetConfirm',
    bar: 'storageBarSettings',
  },
  {
    id: 'runtime',
    title: 'storageRuntimeTitle',
    description: 'storageRuntimeDesc',
    action: 'storageRuntimeClearBtn',
    confirm: 'storageRuntimeClearConfirm',
    bar: 'storageBarRuntime',
  },
  {
    id: 'cf',
    title: 'storageCfTitle',
    description: 'storageCfDesc',
    action: 'storageCfClearBtn',
    confirm: 'storageCfClearConfirm',
    bar: 'storageBarCf',
  },
  {
    id: 'clist',
    title: 'storageClistTitle',
    description: 'storageClistDesc',
    action: 'storageClistClearBtn',
    confirm: 'storageClistClearConfirm',
    bar: 'storageBarClist',
  },
  {
    id: 'user',
    title: 'storageUserTitle',
    description: 'storageUserDesc',
    action: 'storageUserClearBtn',
    confirm: 'storageUserClearConfirm',
    bar: 'storageUserTitle',
  },
  {
    id: 'prediction',
    title: 'storagePredictionTitle',
    description: 'storagePredictionDesc',
    action: 'storagePredictionClearBtn',
    confirm: 'storagePredictionClearConfirm',
    bar: 'storagePredictionTitle',
  },
  {
    id: 'local',
    title: 'storageLegacyTitle',
    description: 'storageLegacyDesc',
    action: 'storageLegacyClearBtn',
    confirm: 'storageLegacyClearConfirm',
    bar: 'storageBarLegacy',
  },
];
const overview = ref(readStorageOverview());
// 重新枚举实际存储，不在模板中重复解析大对象。
function refresh() {
  overview.value = readStorageOverview();
}

// 确认后按功能清理，保留其他组和原有存储键格式。
function requestClear(id) {
  refresh();
  const group =
    groups.find((group) => group.id === id) ||
    (id === 'avatar' || id === 'solved'
      ? {
          title: id === 'avatar' ? 'storageAvatarTitle' : 'storageSolvedTitle',
          action: id === 'avatar' ? 'storageAvatarClearBtn' : 'storageSolvedClearBtn',
          confirm: id === 'avatar' ? 'storageAvatarClearConfirm' : 'storageSolvedClearConfirm',
        }
      : null);
  const item = overview.value.items[id] || overview.value.userParts[id];
  if (['local', 'solved'].includes(id) && !item.keys.length) {
    showConfirmPop({
      title: t(group.title),
      type: 'info',
      message: t(id === 'local' ? 'storageLegacyNoneTip' : 'storageSolvedNoneTip'),
      confirmText: t('popGotItBtn'),
    });
    return;
  }
  showConfirmPop({
    title: t(group?.title || 'storageClearAllBtn'),
    message: t(group?.confirm || 'storageClearAllConfirm', overview.value.items.local.keys.length),
    confirmText: t(group?.action || 'storageClearAllBtn'),
    type: 'danger',
    onConfirm: () => {
      clearStorageGroup(id);
      refresh();
    },
  });
}
// 查看原版使用的内存优先快照，复制动作仍导出完整数据。
function view(group) {
  refresh();
  const item = overview.value.items[group.id];
  // 插件数据统一查看和复制，实际存储键与清理边界保持不变。
  if (group.id === 'runtime') {
    showStorageJsonDocument(t(group.title), item.dataMap, item.bytes);
    return;
  }
  const keyLabels =
    group.id === 'user'
      ? Object.fromEntries(
          item.keys.map((key) => [
            key,
            key === AVATAR_CACHE_KEY
              ? t('storageAvatarTitle')
              : t('storageSolvedTitle') + ' · ' + key.slice('cf_user_solved_'.length),
          ]),
        )
      : {};
  showStorageJsonModal(
    t(group.title),
    item.keys,
    (key) => {
      if (item.dataMap && key in item.dataMap) return item.dataMap[key];
      if (group.id === 'cf' && key === CACHE_KEY)
        return sortProblemKeys(
          Object.keys(latestRatingsMap).length ? latestRatingsMap : appStorage.getJSON(key, {}),
        );
      if (group.id === 'cf' && key === PARALLEL_CONTESTS_KEY)
        return parallelContestsCache || appStorage.getJSON(key, []);
      const value = appStorage.getJSON(key, null);
      return group.id === 'clist' ? sortProblemKeys(value) : value;
    },
    {
      keyLabels,
      onClear:
        group.id === 'user'
          ? (key) => requestClear(key === AVATAR_CACHE_KEY ? 'avatar' : 'solved')
          : null,
    },
  );
}
let stopStorage, stopWrites, refreshTimer;
// 可见时合并密集缓存写入；持续写入也按短窗口刷新，关闭菜单后不扫描。
function scheduleRefresh() {
  if (!props.active || refreshTimer) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    if (props.active) refresh();
  }, 120);
}
onMounted(() => {
  stopStorage = subscribeStorageChanges(scheduleRefresh);
  stopWrites = subscribeStorageWrites(scheduleRefresh);
});
onBeforeUnmount(() => {
  stopStorage?.();
  stopWrites?.();
  clearTimeout(refreshTimer);
});
watch(
  () => props.active,
  (active) => {
    clearTimeout(refreshTimer);
    refreshTimer = null;
    if (active) refresh();
  },
);
</script>
<template>
  <div class="cf-tab-panel">
    <div class="cf-storage-header">
      <h3 class="cf-storage-title">
        <span class="cf-section-title-icon"
          ><inline-svg v-bind:source="assets.menuStorageIcon"></inline-svg></span
        ><span class="cf-storage-title-text">{{ t('storageSectionTitle') }}</span>
      </h3>
      <p class="cf-storage-subtitle" v-text="t().storageSectionSubtitle"></p>
    </div>
    <div class="cf-storage-overview">
      <div class="cf-storage-overview-top">
        <div class="cf-storage-overview-info">
          <span class="cf-storage-overview-label" v-text="t().storageTotalTitle"></span>
        </div>
        <button
          type="button"
          class="cf-storage-btn btn-clear cf-storage-clear-all-btn"
          v-on:click="requestClear('all')"
        >
          <inline-svg v-bind:source="assets.storageClearIcon"></inline-svg
          ><span class="btn-text">{{ t('storageClearAllBtn') }}</span>
        </button>
      </div>
      <StorageUsageChart :overview="overview" :groups="groups" :active="active" />
    </div>
    <div class="cf-storage-list">
      <storage-card
        v-for="group in groups"
        v-bind:key="group.id"
        v-bind:group="group"
        v-bind:data="overview.items[group.id]"
        v-on:clear="requestClear(group.id)"
        v-on:view="view(group)"
      ></storage-card>
    </div>
  </div>
</template>
<style>
.cf-storage-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cf-storage-header {
  margin-bottom: 2px;
}

.cf-storage-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 4px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cf-storage-subtitle {
  font-size: 12px;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

.cf-storage-overview {
  background: linear-gradient(135deg, var(--cf-control-surface), var(--cf-control-active));
  border: 1px solid var(--cf-surface-border, #e2e8f0);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  box-sizing: border-box;
}

.cf-storage-overview-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.cf-storage-overview-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cf-storage-overview-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--cf-control-ink);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* 固定图标与文字的对齐尺寸，不随页面的通用 SVG 规则伸缩。 */
.cf-storage-btn > svg {
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
}

.cf-storage-btn:focus-visible {
  outline: 2px solid #e8798f;
  outline-offset: 2px;
}

.cf-storage-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cf-storage-item {
  background: var(--cf-card-surface, #fff);
  border: 1px solid var(--cf-surface-border, #e2e8f0);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  box-sizing: border-box;
}

.cf-storage-item:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.05);
}

.cf-storage-item-main {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.cf-storage-icon-box {
  --cf-storage-tone: #64748b;
  background: color-mix(in srgb, var(--cf-storage-tone) 10%, var(--cf-card-surface));
  color: color-mix(in srgb, var(--cf-storage-tone) 78%, #354458);
  border: 1px solid color-mix(in srgb, var(--cf-storage-tone) 24%, var(--cf-surface-border));
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.cf-storage-icon-box svg,
.cf-storage-icon-box img {
  width: 17px;
  height: 17px;
  display: block;
  flex-shrink: 0;
  object-fit: contain;
}

.cf-storage-icon-box.icon-settings {
  --cf-storage-tone: #ad8438;
}

.cf-storage-icon-box.icon-runtime {
  --cf-storage-tone: #7371b7;
}

.cf-storage-icon-box.icon-cf {
  --cf-storage-tone: #359574;
}

.cf-storage-icon-box.icon-clist {
  --cf-storage-tone: #438caa;
}

.cf-storage-icon-box.icon-avatar,
.cf-storage-icon-box.icon-user {
  --cf-storage-tone: #8869b5;
}

.cf-storage-icon-box.icon-solved,
.cf-storage-icon-box.icon-prediction {
  --cf-storage-tone: #36979d;
}

.cf-storage-item-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.cf-storage-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  gap: 8px;
}

.cf-storage-item-title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cf-storage-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.cf-storage-size-val {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  white-space: nowrap;
}

.cf-storage-meta-dot {
  color: #cbd5e1;
  font-size: 11px;
  line-height: 1;
  user-select: none;
}

.cf-storage-count-tag {
  font-size: 10.5px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--cf-menu-accent) 24%, var(--cf-card-surface));
  color: color-mix(in srgb, var(--cf-menu-accent) 38%, #26374b);
  border: 1px solid color-mix(in srgb, var(--cf-menu-accent) 40%, var(--cf-card-surface));
  white-space: nowrap;
  flex-shrink: 0;
}

.cf-storage-item-desc {
  font-size: 11px;
  color: #64748b;
  line-height: 1.45;
  margin: 0;
  white-space: normal;
  word-break: break-word;
}

.cf-storage-btn-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.cf-storage-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.cf-storage-btn.btn-view {
  color: #0284c7;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
}

.cf-storage-btn.btn-view:hover {
  background: #e0f2fe;
  color: #0369a1;
  border-color: #7dd3fc;
}

.cf-storage-btn.btn-reset {
  color: #d97706;
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.cf-storage-btn.btn-reset:hover {
  background: #fef3c7;
  color: #b45309;
  border-color: #fcd34d;
}

.cf-storage-btn.btn-clear {
  color: #e11d48;
  background: #fff1f2;
  border: 1px solid #fecdd3;
}

.cf-storage-btn.btn-clear:hover {
  background: #ffe4e6;
  color: #be123c;
  border-color: #fda4af;
}
</style>
