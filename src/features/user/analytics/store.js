// 数据分析的缓存：各个账号的数据合存在一个键里，结构是
// { users: { 小写账号名: 数据集 }, ratings: { 小写账号名: 评级历史 } }。
// users 是提交记录整理成的数据集；ratings 是「评级曲线对比」用的评级历史，两者各缓存各的。
// 这里只整理结构，不碰存储；读写在 data.js。
import { isDataset } from './pack.js';
import { isRatingHistory } from './rating-history.js';

export const userId = (handle) => handle.toLowerCase();

// 把读到的内容整理成可用的结构：不是这个结构的当作空的，其中残缺或旧版本的数据集丢掉。
export function readStore(value) {
  const pick = (source, valid) => {
    const entries = {};
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      for (const [id, entry] of Object.entries(source)) if (valid(entry)) entries[id] = entry;
    }
    return entries;
  };
  return { users: pick(value?.users, isDataset), ratings: pick(value?.ratings, isRatingHistory) };
}

// 把合并前按账号各存一个键的数据集并进来：残缺的丢掉；同一个账号两边都有时留刷新得晚的那份。
// 直接改 store，返回并进来了几个。
export function adoptDatasets(store, datasets) {
  let adopted = 0;
  for (const dataset of datasets) {
    if (!isDataset(dataset)) continue;
    const id = userId(dataset.handle);
    if (store.users[id]?.fetchedAt >= dataset.fetchedAt) continue;
    store.users[id] = dataset;
    adopted++;
  }
  return adopted;
}

// 去掉多出来的账号：自己的账号（own）和 keep 里的账号一直保留，其余的按刷新时间只留最近的若干个。
// limit 是除自己以外最多保留几个账号，keep 里的也占名额。直接改 entries，返回被去掉的账号。
// entries 是「小写账号名 → 带刷新时间的数据」的表，数据集和评级历史各有一张，各清各的。
export function pruneEntries(entries, { keep = [], own = '', limit }) {
  const ownId = own ? userId(own) : '';
  const kept = new Set(keep.filter(Boolean).map(userId));
  if (ownId) kept.add(ownId);
  const used = [...kept].filter((id) => id !== ownId).length;
  const removed = Object.keys(entries)
    .filter((id) => !kept.has(id))
    .sort((a, b) => entries[b].fetchedAt - entries[a].fetchedAt)
    .slice(Math.max(0, limit - used));
  for (const id of removed) delete entries[id];
  return removed;
}

// 查看存储时用的缩略版：账号按刷新时间从近到远只列前面若干个，每份数据里的各张表和记录只留开头几项。
// 被省掉的地方放一个标记（数组里是一项，对象里是一个键），由查看器换成「已截断」的说明。原来的数据不动。
export function previewStore(store, marker, { users = 6, entries = 4 } = {}) {
  const cutList = (list) => (list.length > entries ? [...list.slice(0, entries), marker] : list);
  const cutMap = (map) => {
    const keys = Object.keys(map);
    if (keys.length <= entries) return map;
    return {
      ...Object.fromEntries(keys.slice(0, entries).map((key) => [key, map[key]])),
      [marker]: true,
    };
  };
  const brief = (dataset) =>
    Object.fromEntries(
      Object.entries(dataset).map(([field, value]) => {
        if (Array.isArray(value)) return [field, cutList(value)];
        return [field, value && typeof value === 'object' ? cutMap(value) : value];
      }),
    );
  const list = (entries) => {
    const ids = Object.keys(entries).sort((a, b) => entries[b].fetchedAt - entries[a].fetchedAt);
    const shown = Object.fromEntries(ids.slice(0, users).map((id) => [id, brief(entries[id])]));
    if (ids.length > users) shown[marker] = true;
    return shown;
  };
  return { users: list(store.users), ratings: list(store.ratings) };
}
