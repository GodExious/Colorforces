// 用户分组的读写，和好友名单的同步。结构和各种改动在 store.js，好友页的读法在 friends.js。
import { fetchFriendsPage, fetchProfilePage, postFriend } from '../../../api/codeforces.js';
import { appStorage } from '../../../storage/gm.js';
import { USER_GROUPS_KEY } from '../../../storage/keys.js';
import { FRIENDS_SYNC_INTERVAL } from '../../../config/cache-policy.js';
import { getCurrentUserHandle, getCsrfToken } from '../../page/account.js';
import {
  readStore,
  accountOf,
  setFriends,
  userId,
  everyoneIn,
  renameUser,
  friendId,
  followUser,
  unfollowUser,
} from './store.js';
import { parseFriendsPage, parseProfileStar, isOwnPage } from './friends.js';
import { requestProfiles } from './profiles.js';

// 各个账号的分组合存在一个键里，改一处也要把整个键写回去，
// 所以每次改动都是「读出来、改、写回去」一气做完，中间不留给别的标签页插进来的空当。
const loadStore = () => readStore(appStorage.getJSON(USER_GROUPS_KEY, null));

const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());
let watching = false;
// 分组变了（本页改的、别的标签页改的、被清空了）时通知，界面据此重新读一遍。返回取消订阅的函数。
export function subscribeGroups(listener) {
  listeners.add(listener);
  // 别的标签页的改动只在有人订阅之后才开始听。
  if (!watching) watching = appStorage.onRemoteChange(USER_GROUPS_KEY, notify) || true;
  return () => listeners.delete(listener);
}

// 读某个登录账号的分组；这个账号还没有分组时返回 null（不会因此写出一份空的）。
export function readAccount(owner) {
  return owner ? loadStore().accounts[userId(owner)] || null : null;
}

// 改某个登录账号的分组：change 收到这个账号的分组（还没有就先建一份空的）和整份数据，直接在上面改；
// 它返回 false 表示什么都没改、不用写回去，返回别的值会原样交还给调用的地方。
export function changeAccount(owner, change) {
  const store = loadStore();
  const result = change(accountOf(store, owner), store);
  if (result !== false) {
    appStorage.setJSON(USER_GROUPS_KEY, store);
    notify();
  }
  return result;
}

// 清空全部账号的分组（存储页用）。
export function clearGroups() {
  appStorage.removeItem(USER_GROUPS_KEY);
  notify();
}

// 读一遍这个账号各分组里所有人的资料（评分、头衔、头像；读到的从 profiles.js 取），
// 顺带认出改了名的人，把记录里的旧名字换成新的。
export async function refreshMembers(owner) {
  const account = readAccount(owner);
  if (!account) return;
  const renames = await requestProfiles(everyoneIn(account));
  if (!renames.length) return;
  changeAccount(owner, (own) =>
    renames.map(({ from, to }) => renameUser(own, from, to).changed).includes(true),
  );
}

// 好友名单是不是该自动同步了：还没同步过，或者离上次同步已经过了间隔。
export function friendsStale(account, now = Date.now()) {
  return !account || now - account.friends.syncedAt >= FRIENDS_SYNC_INTERVAL;
}

let syncing = null;
// 同步当前登录账号的好友名单。html 给了就直接读它（正开着原站的好友页时），没给就去取那一页。
// 返回 { ok: true, count } 或 { ok: false, reason }，reason 是：
//   'signed-out'  没登录，或者取到的不是这个账号登录着时的页面；
//   'failed'      请求没成功；
//   'empty'       页面上一个好友都没读到，而原来的名单不是空的。可能是真的清空了，也可能是原站改了页面的写法，
//                 所以自动同步时不拿它覆盖原来的名单；manual 为真（手动同步）时照样覆盖。
// 同时只跑一次，重复调用拿到的是同一次的结果。
export function syncFriends({ html, manual = false } = {}) {
  if (syncing) return syncing;
  syncing = (async () => {
    const owner = getCurrentUserHandle();
    if (!owner) return { ok: false, reason: 'signed-out' };
    let page = html;
    if (page == null) {
      try {
        const response = await fetchFriendsPage();
        if (!response.ok) return { ok: false, reason: 'failed' };
        page = await response.text();
      } catch {
        return { ok: false, reason: 'failed' };
      }
    }
    if (!isOwnPage(page, owner)) return { ok: false, reason: 'signed-out' };
    const friends = parseFriendsPage(page);
    if (!friends.length && !manual && readAccount(owner)?.friends.users.length)
      return { ok: false, reason: 'empty' };
    changeAccount(owner, (account) => setFriends(account, friends, Date.now()));
    return { ok: true, count: friends.length };
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

// 在原站关注（follow 为真）或取消关注一个人，成功后好友名单跟着改。
// 返回 { ok: true, handle }（handle 是这个人在原站的名字）或 { ok: false, reason, message }，reason 是：
//   'signed-out'  没登录，或者页面上找不到防伪令牌；
//   'not-found'   没有这个用户，或者他的主页上没有关注用的那颗星（比如是自己）；
//   'rejected'    原站没答应，message 是它给的原因；
//   'failed'      请求没成功。
// 关注要用原站的用户编号：取消关注时名单里一般记着，没记着的和要关注的，都先去他的主页上读。
export async function setFollowing(handle, follow) {
  const owner = getCurrentUserHandle();
  const token = getCsrfToken();
  if (!owner || !token) return { ok: false, reason: 'signed-out' };
  const account = readAccount(owner);
  let user = { handle, id: !follow && account ? friendId(account, handle) : 0 };
  let following = !follow;
  try {
    if (!user.id) {
      const response = await fetchProfilePage(handle);
      if (!response.ok) return { ok: false, reason: 'failed' };
      const star = parseProfileStar(await response.text());
      if (!star) return { ok: false, reason: 'not-found' };
      user = star;
      following = star.following;
    }
    // 已经是想要的状态（比如在别处点过了）就不用再发请求，只把名单改对。
    if (following !== follow) {
      const reply = await (await postFriend(user.id, follow, token)).json();
      if (reply?.success !== 'true')
        return { ok: false, reason: 'rejected', message: String(reply?.reason || '') };
    }
  } catch {
    return { ok: false, reason: 'failed' };
  }
  changeAccount(owner, (account) =>
    follow ? followUser(account, user.handle, user.id) : unfollowUser(account, handle),
  );
  return { ok: true, handle: user.handle };
}
