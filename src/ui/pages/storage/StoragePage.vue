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
import {
  SETTINGS_KEY,
  CACHE_KEY,
  PARALLEL_CONTESTS_KEY,
  CLIST_STORAGE_KEY,
  AVATAR_CACHE_KEY,
  PREDICTION_CACHE_KEY,
  PREDICTION_RATINGS_KEY,
  PREDICTION_LOCK_KEY,
  RUNTIME_DATA_KEY,
  ANALYTICS_KEY,
} from '../../../storage/keys.js';
import { showConfirmPop } from '../../components/dialogs/ConfirmDialog/ConfirmDialog.vue';
import { readStore, previewStore } from '../../../features/user/analytics/store.js';
import { showStorageJsonModal } from './components/StorageJsonDialog/StorageJsonDialog.vue';
import { TRUNCATE_MARKER } from './components/StorageJsonDialog/json-preview.js';
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
// 查看数据时，页签上显示的是存储键的说明文字，实际键名在页签上方单独标出。
const KEY_LABELS = {
  [SETTINGS_KEY]: 'storageSettingsTitle',
  [RUNTIME_DATA_KEY]: 'storageRuntimeTitle',
  [CACHE_KEY]: 'storageKeyRatings',
  [PARALLEL_CONTESTS_KEY]: 'storageKeyParallel',
  [CLIST_STORAGE_KEY]: 'storageKeyClist',
  [AVATAR_CACHE_KEY]: 'storageAvatarTitle',
  [ANALYTICS_KEY]: 'storageAnalyticsTitle',
  [PREDICTION_CACHE_KEY]: 'storageKeySnapshots',
  [PREDICTION_RATINGS_KEY]: 'storageKeyRatingSources',
  [PREDICTION_LOCK_KEY]: 'storageKeyRequestLease',
};
const SOLVED_PREFIX = 'cf_user_solved_';
// 每次渲染时现取文案，切换语言后页签跟着变。已弃用的缓存里是不认识的旧键，原样显示键名。
function keyLabel(key) {
  if (key.startsWith(SOLVED_PREFIX))
    return t('storageSolvedTitle') + ' · ' + key.slice(SOLVED_PREFIX.length);
  return KEY_LABELS[key] ? t(KEY_LABELS[key]) : key;
}
const overview = ref(readStorageOverview());
// 重新枚举实际存储，不在模板中重复解析大对象。
function refresh() {
  overview.value = readStorageOverview();
}

// 确认后按功能清理，保留其他组和原有存储键格式。
function requestClear(id) {
  refresh();
  const group = groups.find((group) => group.id === id);
  if (id === 'local' && !overview.value.items.local.keys.length) {
    showConfirmPop({
      title: t(group.title),
      type: 'info',
      message: t('storageLegacyNoneTip'),
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
// 数据分析的缓存里是各个账号的全部提交记录，账号一多就很大。查看时只列出前面若干个账号、
// 每个账号各项数据的开头几条，项数写的是缓存了多少个账号；复制的仍是完整数据。
function previewOf(key, content) {
  if (key !== ANALYTICS_KEY) return null;
  const store = readStore(content);
  return {
    content: previewStore(store, TRUNCATE_MARKER),
    count: Object.keys(store.users).length,
  };
}
// 查看原版使用的内存优先快照，复制动作仍导出完整数据。
function view(group) {
  refresh();
  const item = overview.value.items[group.id];
  showStorageJsonModal(
    group.title,
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
    { keyLabel, preview: previewOf },
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
  font-size: var(--cf-font-size-xl);
  font-weight: var(--cf-font-weight-bold);
  color: var(--cf-gray-900);
  margin: 0 0 4px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cf-storage-subtitle {
  font-size: var(--cf-font-size-base);
  color: var(--cf-gray-500);
  margin: 0;
  line-height: 1.5;
}

.cf-storage-overview {
  background: linear-gradient(135deg, var(--cf-control-surface), var(--cf-control-active));
  border: 1px solid var(--cf-surface-border, var(--cf-gray-200));
  border-radius: var(--cf-radius-xl);
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
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-semibold);
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
  border: 1px solid var(--cf-surface-border, var(--cf-gray-200));
  border-radius: var(--cf-radius-lg);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  box-sizing: border-box;
}

.cf-storage-item:hover {
  border-color: var(--cf-gray-300);
  box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.05);
}

.cf-storage-item-main {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.cf-storage-icon-box {
  --cf-storage-tone: var(--cf-gray-500);
  background: color-mix(in srgb, var(--cf-storage-tone) 10%, var(--cf-card-surface));
  color: color-mix(in srgb, var(--cf-storage-tone) 78%, #354458);
  border: 1px solid color-mix(in srgb, var(--cf-storage-tone) 24%, var(--cf-surface-border));
  width: 32px;
  height: 32px;
  border-radius: var(--cf-radius-md);
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
  font-size: var(--cf-font-size-lg);
  font-weight: var(--cf-font-weight-semibold);
  color: var(--cf-gray-900);
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
  font-size: var(--cf-font-size-base);
  font-weight: var(--cf-font-weight-semibold);
  color: var(--cf-gray-700);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  white-space: nowrap;
}

.cf-storage-meta-dot {
  color: var(--cf-gray-300);
  font-size: var(--cf-font-size-xs);
  line-height: 1;
  user-select: none;
}

.cf-storage-count-tag {
  font-size: 10.5px;
  font-weight: var(--cf-font-weight-semibold);
  padding: 1px 6px;
  border-radius: var(--cf-radius-xs);
  background: color-mix(in srgb, var(--cf-menu-accent) 24%, var(--cf-card-surface));
  color: color-mix(in srgb, var(--cf-menu-accent) 38%, #26374b);
  border: 1px solid color-mix(in srgb, var(--cf-menu-accent) 40%, var(--cf-card-surface));
  white-space: nowrap;
  flex-shrink: 0;
}

.cf-storage-item-desc {
  font-size: var(--cf-font-size-xs);
  color: var(--cf-gray-500);
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
  border-radius: var(--cf-radius-sm);
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-semibold);
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
