import { appStorage } from '../../storage/gm.js';
import { resetSettings } from '../../settings.js';
import { clearRuntimeData, removeRuntimeValues } from '../../storage/runtime.js';
import {
  CACHE_KEY,
  PARALLEL_CONTESTS_KEY,
  CLIST_STORAGE_KEY,
  AVATAR_CACHE_KEY,
  PREDICTION_STORAGE_KEYS,
} from '../../storage/keys.js';
import { clearRatingsMemory } from '../ratings/data.js';
import { clearClistMemory } from '../ratings/clist/sync.js';
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
  if (group === 'runtime' || group === 'all') clearRuntimeData();
  // 题库缓存清掉后，插件数据里对应的更新时间和语言标记也一并去掉，下次访问会重新拉取。
  if (group === 'cf' || group === 'all') {
    [CACHE_KEY, PARALLEL_CONTESTS_KEY].forEach((key) => appStorage.removeItem(key));
    removeRuntimeValues(['ratingsTime', 'ratingsLocale']);
    clearRatingsMemory();
  }
  if (group === 'clist' || group === 'all') {
    appStorage.removeItem(CLIST_STORAGE_KEY);
    removeRuntimeValues(['clistSyncTime']);
    clearClistMemory();
  }
  if (group === 'user' || group === 'all') {
    appStorage.removeItem(AVATAR_CACHE_KEY);
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
