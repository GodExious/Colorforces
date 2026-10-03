import { appStorage } from './gm.js';
import { RUNTIME_DATA_KEY, LEGACY_RUNTIME_KEYS } from './keys.js';

// 插件数据的唯一读写入口。整份数据是一个对象，存在一个键里，字段有：
// ratingsTime（CF 题库更新时间，毫秒）、ratingsLocale（题库语言标记）、
// clistSyncTime（CList 同步时间，毫秒）、updateCheck（更新检查状态）。

// 把旧键里的值并入现有数据，返回合并后的新对象。
// 时间取较新的一个；语言标记只在缺失时补上；更新检查状态取检查时间较新的一份。
export function mergeLegacyRuntime(current, legacy) {
  const merged = { ...current };
  for (const field of ['ratingsTime', 'clistSyncTime']) {
    const time = Number(legacy[field]) || 0;
    if (time > (Number(merged[field]) || 0)) merged[field] = time;
  }
  if (merged.ratingsLocale == null && typeof legacy.ratingsLocale === 'string')
    merged.ratingsLocale = legacy.ratingsLocale;
  const check = legacy.updateCheck;
  if (
    check &&
    typeof check === 'object' &&
    (!merged.updateCheck ||
      (Number(check.lastCheckTime) || 0) > (Number(merged.updateCheck.lastCheckTime) || 0))
  )
    merged.updateCheck = check;
  return merged;
}

function load() {
  const value = appStorage.getJSON(RUNTIME_DATA_KEY, null);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

// 每次页面加载检查一遍旧键：有就并入新键，然后删掉旧键。
let migrated = false;
function migrate() {
  if (migrated) return;
  migrated = true;
  const legacy = {};
  for (const [field, key] of Object.entries(LEGACY_RUNTIME_KEYS)) {
    if (appStorage.getItem(key) == null) continue;
    legacy[field] =
      field === 'updateCheck' ? appStorage.getJSON(key, null) : appStorage.getItem(key);
  }
  if (!Object.keys(legacy).length) return;
  appStorage.setJSON(RUNTIME_DATA_KEY, mergeLegacyRuntime(load(), legacy));
  for (const key of Object.values(LEGACY_RUNTIME_KEYS)) appStorage.removeItem(key);
}

// 读出整份插件数据；没有时返回空对象。
export function readRuntimeData() {
  migrate();
  return load();
}

// 读出一个字段；没有时返回 null。
export function getRuntimeValue(field) {
  return readRuntimeData()[field] ?? null;
}

// 写入若干字段，其余字段保持不变。写之前重新读一遍，尽量不覆盖其他标签页刚写入的字段。
export function setRuntimeValues(values) {
  appStorage.setJSON(RUNTIME_DATA_KEY, { ...readRuntimeData(), ...values });
}

// 删除若干字段；删空后连键一起删掉，本来就没有这些字段时不写存储。
export function removeRuntimeValues(fields) {
  const data = { ...readRuntimeData() };
  if (!fields.some((field) => field in data)) return;
  for (const field of fields) delete data[field];
  if (Object.keys(data).length) appStorage.setJSON(RUNTIME_DATA_KEY, data);
  else appStorage.removeItem(RUNTIME_DATA_KEY);
}

// 清空整份插件数据。
export function clearRuntimeData() {
  migrate();
  appStorage.removeItem(RUNTIME_DATA_KEY);
}
