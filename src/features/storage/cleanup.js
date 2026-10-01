import { appStorage } from '../../storage/gm.js';
import { resetSettings } from '../../settings.js';
import {
  CACHE_KEY,
  CACHE_TIME_KEY,
  CACHE_LOCALE_KEY,
  PARALLEL_CONTESTS_KEY,
  CLIST_STORAGE_KEY,
  CLIST_LAST_SYNC_KEY,
  AVATAR_CACHE_KEY,
  PREDICTION_STORAGE_KEYS,
  RUNTIME_STORAGE_KEYS,
} from '../../storage/keys.js';
import { clearRatingsMemory } from '../ratings/data.js';
import { clearClistMemory } from '../ratings/clist.js';
import { clearSolvedMemory } from '../general/solved.js';
import { getUserSolvedStorageDetails, getLocalStorageDetails } from './overview.js';
const listeners = new Set();
// 清理后通知统计和页脚刷新，不让 UI 直接修改业务模块变量。
export function subscribeStorageChanges(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
// 仅按原有功能范围清理 GM 键；不清空站点 localStorage。
export function clearStorageGroup(group) {
  if (group === 'settings') resetSettings();
  if (group === 'runtime' || group === 'all') {
    RUNTIME_STORAGE_KEYS.forEach((key) => appStorage.removeItem(key));
  }
  if (group === 'cf' || group === 'all') {
    [CACHE_KEY, CACHE_TIME_KEY, CACHE_LOCALE_KEY, PARALLEL_CONTESTS_KEY].forEach((key) =>
      appStorage.removeItem(key),
    );
    clearRatingsMemory();
  }
  if (group === 'clist' || group === 'all') {
    [CLIST_STORAGE_KEY, CLIST_LAST_SYNC_KEY].forEach((key) => appStorage.removeItem(key));
    clearClistMemory();
  }
  if (group === 'avatar' || group === 'user' || group === 'all')
    appStorage.removeItem(AVATAR_CACHE_KEY);
  if (group === 'solved' || group === 'user' || group === 'all') {
    getUserSolvedStorageDetails().keys.forEach((key) => appStorage.removeItem(key));
    clearSolvedMemory();
  }
  if (group === 'prediction' || group === 'all')
    PREDICTION_STORAGE_KEYS.forEach((key) => appStorage.removeItem(key));
  if (group === 'local' || group === 'all')
    getLocalStorageDetails().keys.forEach((key) => appStorage.removeItem(key));
  if (group === 'all') resetSettings();
  listeners.forEach((listener) => listener(group));
}
