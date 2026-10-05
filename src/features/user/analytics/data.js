// 用户提交记录的请求与缓存。已通过题目和数据分析共用这里的一次请求。
import { fetchUserStatus, fetchUserRating } from '../../../api/codeforces.js';
import { appStorage } from '../../../storage/gm.js';
import {
  ANALYTICS_KEY,
  LEGACY_ANALYTICS_PREFIX,
  PREDICTION_LOCK_KEY,
} from '../../../storage/keys.js';
import { USER_STATUS_CACHE, PREDICTION_API_GAP } from '../../../config/cache-policy.js';
import { appSettings } from '../../../settings.js';
import { latestRatingsMap } from '../../ratings/data.js';
import { getCurrentUserHandle } from '../../page/account.js';
import { packSubmissions } from './pack.js';
import { packRatingHistory } from './rating-history.js';
import { readStore, adoptDatasets, pruneEntries, userId } from './store.js';

const REQUEST_TIMEOUT = 60000;
// 随某个账号的缓存一起保存的设置项。streakZone：计算「最长连续」时用的时区（相对 UTC 的小时数）。
const DATASET_PREFERENCES = ['streakZone'];
const inflight = new Map();
const listeners = new Set();
// 评级历史至少留这么多个账号的：对比时一次会放上好几个账号，缓存用户数设得很小时也不该互相挤掉。
const RATINGS_KEEP = 8;
const ratingsInflight = new Map();

// 各个账号的数据集合存在一个键里。读一次是解析整个键，改一处也要把整个键写回去，
// 所以每次改动都是「读出来、改、写回去」一气做完，中间不留给别的标签页插进来的空当。
const writeStore = (store) => appStorage.setJSON(ANALYTICS_KEY, store);
// 读的时候顺带迁移：合并前每个账号各占一个键，还留着的就并进来，写好新键后把旧键删掉。
// 升级时还开着的旧版本页面之后可能再写出旧键，下次读到时同样并进来。
function loadStore() {
  const store = readStore(appStorage.getJSON(ANALYTICS_KEY, null));
  const legacy = appStorage.keys().filter((key) => key.startsWith(LEGACY_ANALYTICS_PREFIX));
  if (legacy.length) {
    const adopted = adoptDatasets(
      store,
      legacy.map((key) => appStorage.getJSON(key, null)),
    );
    if (adopted) writeStore(store);
    legacy.forEach((key) => appStorage.removeItem(key));
  }
  return store;
}
// 只做上面的迁移，不取数据。存储页在列出各个键之前调用，旧键就不会被算进已弃用的缓存。
export function migrateDatasets() {
  loadStore();
}
// 自己的账号一直保留；其他账号按刷新时间只留最近的若干个，数量由设置决定。keep 里的账号也保留，并占名额。
const prune = (store, keep) =>
  pruneEntries(store.users, {
    keep,
    own: getCurrentUserHandle(),
    limit: appSettings.user.analytics.cacheUsers,
  });

// 每次请求成功后收到（账号，原始提交列表）；已通过题目靠它更新，不必自己再请求一次。
export function subscribeUserStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// 读取某个账号的缓存；没有或结构不对时返回 null。
export function readDataset(handle) {
  return loadStore().users[userId(handle)] || null;
}

// 把改过设置项的数据集写回缓存（数据本身和刷新时间不变）。
export function saveDataset(dataset) {
  const store = loadStore();
  store.users[userId(dataset.handle)] = dataset;
  writeStore(store);
}

// 缓存是否还在有效期内。
export function isFresh(dataset) {
  return Boolean(dataset) && Date.now() - dataset.fetchedAt < USER_STATUS_CACHE;
}

// 缓存的账号数超出设置时，去掉多出来的；没有多出来的就不写。
export function pruneDatasets(keep = []) {
  const store = loadStore();
  if (prune(store, keep).length) writeStore(store);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

// 和评分预测共用同一个请求间隔：等到允许的时刻，再把下一次允许的时刻往后推。
// 这里只读写间隔，不占用预测的租约，预测正在抓取时两边的请求会自然错开。
async function waitTurn(notify) {
  const lease = appStorage.getJSON(PREDICTION_LOCK_KEY, {}) || {};
  const delay = (lease.nextAt || 0) - Date.now();
  if (delay > 0) {
    notify({ stage: 'queue', until: lease.nextAt });
    await wait(delay);
  }
  const latest = appStorage.getJSON(PREDICTION_LOCK_KEY, {}) || {};
  appStorage.setJSON(PREDICTION_LOCK_KEY, { ...latest, nextAt: Date.now() + PREDICTION_API_GAP });
}

// 边接收边报告已收到的字节数。服务器不提供总大小，所以给不出百分比。
async function readJson(response, notify) {
  if (!response.body?.getReader) return response.json();
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    notify({ stage: 'receive', received });
  }
  return JSON.parse(await new Blob(chunks).text());
}

// 错误分三类：network（连不上或返回的不是数据）、api（接口明确拒绝，附原因）、timeout。
function failure(code, comment = '') {
  const error = new Error(`analytics:${code}`);
  error.code = code;
  error.comment = comment;
  return error;
}

// 向接口要一份列表。send(signal) 发出请求；排队、等服务器、接收各阶段通过 notify 报告。
async function request(send, notify) {
  await waitTurn(notify);
  notify({ stage: 'server' });
  let body;
  try {
    const response = await send(AbortSignal.timeout(REQUEST_TIMEOUT));
    body = await readJson(response, notify);
  } catch (error) {
    throw failure(error?.name === 'TimeoutError' ? 'timeout' : 'network');
  }
  if (body?.status !== 'OK' || !Array.isArray(body.result))
    throw failure('api', body?.comment || '');
  return body.result;
}

// 请求某个账号的全部提交并整理成数据集。同一账号同时只发一次请求，后来者共用结果和进度。
// 数据分析开启时才写入缓存；关闭时只把结果交给订阅者（已通过题目）。
export function fetchDataset(handle, onStage = () => {}) {
  const id = handle.toLowerCase();
  let entry = inflight.get(id);
  if (entry) {
    entry.watchers.add(onStage);
    return entry.promise;
  }
  const watchers = new Set([onStage]);
  const notify = (stage) => watchers.forEach((watcher) => watcher(stage));
  const promise = request((signal) => fetchUserStatus(handle, signal), notify)
    .then((submissions) => {
      notify({ stage: 'compute' });
      const dataset = packSubmissions(handle, submissions, {
        known: (key) => Boolean(latestRatingsMap?.[key]),
      });
      if (appSettings.user.analytics.enabled) {
        // 用户针对这个账号做过的设置跟着缓存走：重新请求后沿用，缓存被清掉就一起没了。
        const store = loadStore();
        const previous = store.users[id];
        for (const field of DATASET_PREFERENCES)
          if (previous?.[field] !== undefined) dataset[field] = previous[field];
        store.users[id] = dataset;
        // 刚保存的这个账号如果不是自己，也占一个名额。
        prune(store, [handle]);
        writeStore(store);
      }
      for (const listener of listeners) {
        try {
          listener(handle, submissions);
        } catch (error) {
          console.error('Colorforces: user status listener failed', error);
        }
      }
      return dataset;
    })
    .finally(() => inflight.delete(id));
  inflight.set(id, { promise, watchers });
  return promise;
}

// 读取某个账号的评级历史缓存；没有时返回 null。
export function readRatingHistory(handle) {
  return loadStore().ratings[userId(handle)] || null;
}

// 请求某个账号的评级历史。同一账号同时只发一次请求，后来者共用结果。
// 和提交记录一样排在同一个请求间隔里；数据分析开启时写入缓存。
// 账号不存在时接口会明确拒绝，错误的类别是 api，原因在 comment 里。
export function fetchRatingHistory(handle) {
  const id = userId(handle);
  let promise = ratingsInflight.get(id);
  if (promise) return promise;
  promise = request(
    (signal) => fetchUserRating(handle, signal),
    () => {},
  )
    .then((changes) => {
      const history = packRatingHistory(handle, changes);
      if (appSettings.user.analytics.enabled) {
        const store = loadStore();
        store.ratings[id] = history;
        pruneEntries(store.ratings, {
          keep: [handle],
          own: getCurrentUserHandle(),
          limit: Math.max(RATINGS_KEEP, appSettings.user.analytics.cacheUsers),
        });
        writeStore(store);
      }
      return history;
    })
    .finally(() => ratingsInflight.delete(id));
  ratingsInflight.set(id, promise);
  return promise;
}

// 清掉全部数据分析缓存。
export function clearDatasets() {
  appStorage.removeItem(ANALYTICS_KEY);
}
