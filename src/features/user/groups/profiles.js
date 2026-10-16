// 分组成员的资料：评分、头衔、头像。和页面上的头像功能共用一份缓存（AVATAR_CACHE_KEY），一个人一条：
//   { url, fallbackUrl, time, rank, maxRank, rating, maxRating, contribution, friends, registered }（见 avatars/data.js 的 avatarEntry）
// rating 是后来才加的一项，未评级的记成 null；旧的条目里没有它，评分算不知道，要重新查。
// maxRank（到过的最高段位）也是后来加的；旧的条目里没有它时不重新查，头像框按现在的段位算。
// maxRating、contribution、friends、registered（右键菜单名片上的四项资料）更晚加；这里读到旧的条目不重新查，
// 页面上查头像时会顺带补（见 avatars/enhance.js），右键菜单打开时还缺就单独补查那一个人（见 UserMenu）。
// 查不到的账号记成 { url, fallbackUrl, time, missing: true }，有效期内不再去查。
import { fetchUsersByHandle } from '../../../api/codeforces.js';
import { appStorage } from '../../../storage/gm.js';
import { AVATAR_CACHE_KEY } from '../../../storage/keys.js';
import { CACHE_EXPIRY } from '../../../config/cache-policy.js';
import { avatarEntry, DEFAULT_AVATAR_URL } from '../avatars/data.js';
import { findRenames, userId } from './store.js';

// 读到过的资料，按小写账号名。一条是 { handle, rating, rank, maxRank, avatar, fallback, stats }，
// handle 是这个人现在的名字（大小写以原站为准）；查不到的账号是 { handle, missing: true }。
const profiles = new Map();
const listeners = new Set();
// 资料有了新的时通知，界面据此重新画。返回取消订阅的函数。
export function subscribeProfiles(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
// 一个人的资料；还没读到时是 null。
export const profileOf = (handle) => profiles.get(userId(handle)) || null;

// 缓存里的一条 → 资料。没记评分的旧条目返回 null。
function fromEntry(handle, entry) {
  if (entry.missing) return { handle, missing: true };
  if (!('rating' in entry)) return null;
  return {
    handle,
    rating: Number.isFinite(entry.rating) ? entry.rating : null,
    rank: entry.rank || '',
    maxRank: typeof entry.maxRank === 'string' ? entry.maxRank : undefined,
    avatar: entry.url || '',
    fallback: entry.fallbackUrl || '',
    // 名片上的四项资料；旧的条目里没有时是 undefined。
    stats:
      'contribution' in entry
        ? {
            maxRating: Number.isFinite(entry.maxRating) ? entry.maxRating : null,
            contribution: Number(entry.contribution) || 0,
            friends: Number(entry.friends) || 0,
            registered: Number(entry.registered) || 0,
          }
        : undefined,
  };
}

// 请求没成功之后，隔这么久才再试，免得界面每动一下就去请求一次。
const RETRY_GAP = 60 * 1000;
// 名单里有查不到的账号时，接口整个报错、只说出其中一个；去掉它再查。最多这样重来几次，两次之间隔一会儿。
const NOT_FOUND_ROUNDS = 5;
const ROUND_GAP = 2200;
let failedAt = 0;

// 向接口查这些人。返回 { users, missing }：users 和 asked 一一对应（没查成时是 null），missing 是查不到的账号。
async function ask(handles) {
  const missing = [];
  let asked = handles;
  try {
    for (let round = 0; asked.length && round <= NOT_FOUND_ROUNDS; round++) {
      if (round) await new Promise((done) => setTimeout(done, ROUND_GAP));
      const data = await (await fetchUsersByHandle(asked)).json();
      if (data.status === 'OK' && Array.isArray(data.result))
        return { asked, users: data.result, missing };
      const name = /User with handle (.*?) not found/i.exec(data.comment || '')?.[1];
      const rest = name ? asked.filter((handle) => userId(handle) !== userId(name)) : asked;
      if (rest.length === asked.length) break;
      missing.push(name);
      asked = rest;
    }
  } catch {
    // 网络不通、返回的不是预期的格式：当作这次没查成。
  }
  return { asked, users: asked.length ? null : [], missing };
}

const notify = () => listeners.forEach((listener) => listener());

// 缓存里有的先拿出来用，有新的马上通知（过了有效期的也先照旧显示，再去重新查，不等查完）。
// 返回要向接口查的人：缓存里没有的、过了有效期的，force 时是全部。
function useCache(handles, force) {
  const now = Date.now();
  const cache = appStorage.getJSON(AVATAR_CACHE_KEY, null) || {};
  const cached = new Map(Object.entries(cache).map(([handle, entry]) => [userId(handle), handle]));
  let changed = false;
  const wanted = [];
  for (const handle of handles) {
    const key = cached.get(userId(handle));
    const entry = key && cache[key] && typeof cache[key] === 'object' ? cache[key] : null;
    const profile = entry ? fromEntry(key, entry) : null;
    if (profile && JSON.stringify(profile) !== JSON.stringify(profiles.get(userId(handle)))) {
      profiles.set(userId(handle), profile);
      changed = true;
    }
    if (force || !profile || !(now - entry.time < CACHE_EXPIRY)) wanted.push(handle);
  }
  if (changed) notify();
  return wanted;
}

async function load(handles, force) {
  const wanted = useCache(handles, force);
  const now = Date.now();
  let changed = false;
  let renames = [];
  if (wanted.length && now - failedAt >= RETRY_GAP) {
    const { asked, users, missing } = await ask(wanted);
    failedAt = users ? 0 : Date.now();
    // 写回去之前重新读一遍：请求的这段时间里，别的标签页可能也往缓存里写了东西。
    const latest = appStorage.getJSON(AVATAR_CACHE_KEY, null) || {};
    for (const handle of missing) {
      latest[handle] = { url: DEFAULT_AVATAR_URL, fallbackUrl: '', time: now, missing: true };
      profiles.set(userId(handle), { handle, missing: true });
    }
    for (const user of users || []) {
      if (typeof user?.handle !== 'string') continue;
      latest[user.handle] = avatarEntry(user, now);
      profiles.set(userId(user.handle), fromEntry(user.handle, latest[user.handle]));
    }
    if (users) {
      renames = findRenames(asked, users);
      // 用旧名字问到的人，旧名字下也先指到他现在的资料，等记录里的名字换过来。
      for (const { from, to } of renames) profiles.set(userId(from), profiles.get(userId(to)));
    }
    if (missing.length || users?.length) {
      appStorage.setJSON(AVATAR_CACHE_KEY, latest);
      changed = true;
    }
  }
  if (changed) notify();
  return renames;
}

// 只从缓存里拿出这些人的资料，不向接口查（头像框的作者是不是原站用户，有就用段位色，没有也不为它发请求）。
// 已经读过的、上次没找到的不再读缓存。
const looked = new Set();
export function readCachedProfiles(handles) {
  const unknown = handles.filter(
    (handle) => !profiles.has(userId(handle)) && !looked.has(userId(handle)),
  );
  unknown.forEach((handle) => looked.add(userId(handle)));
  if (unknown.length) useCache(unknown, false);
}

let running = Promise.resolve();
// 读这些人的资料：缓存里有的直接用，没有的或过了有效期的向接口查一次（一次请求查完）。
// 返回认出来的改名 [{ from, to }]。一次只跑一个，后来的排在后面，轮到时前一次查到的已经在缓存里了。
// force 为真时不管缓存新不新都去查（头像框的「最高段位」给旧条目补最高段位用，见 frames/page.js）。
// 还没读过的人先从缓存里拿出来，不排在前面那些查询后面（右键菜单打开时第一下就有头像）；
// 已经读过的不再读一遍缓存，轮到时照常再看。
export function requestProfiles(handles, { force = false } = {}) {
  const unknown = handles.filter((handle) => !profiles.has(userId(handle)));
  if (unknown.length) useCache(unknown, false);
  const task = running.then(() => load(handles, force));
  running = task.catch(() => {});
  return task;
}
