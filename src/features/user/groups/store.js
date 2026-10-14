// 用户分组的数据：各个登录账号的分组合存在一个键里，结构是
// { accounts: { 小写账号名: 这个账号的分组 } }，一个账号的分组是
// {
//   handle,                       // 这个登录账号，原样的大小写
//   friends: { color, mark, frame, users: [{ handle, id }], syncedAt },   // 内置的「好友」一组：名单跟着原站，id 是原站的用户编号
//   groups: [{ id, name, color, mark, frame }],              // 自己建的分组，先后就是数组里的先后
//   members: { 小写账号名: { handle, groups: [分组 id], memo } },   // 谁在哪些自建分组里，以及备注
// }
// 「好友」永远排在最前面，不在 groups 里。这里只整理结构，不碰存储；读写在 data.js。

export const userId = (handle) => handle.toLowerCase();
// 内置的「好友」一组的 id。
export const FRIENDS_GROUP = 'friends';
export const NAME_LIMIT = 20;
export const MEMO_LIMIT = 40;

const HANDLE = /^[\w.-]{1,40}$/;
export const isHandle = (text) => typeof text === 'string' && HANDLE.test(text);
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value, limit) => (typeof value === 'string' ? value.trim().slice(0, limit) : '');
const cleanColor = (value) => (/^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '');
// 把一段文字拆成一个个看得见的字符：一个表情可能由好几个编码拼成（肤色、国旗、一家人），要算成一个。
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter() : null;
const charsOf = (value) =>
  segmenter ? Array.from(segmenter.segment(value), (part) => part.segment) : [...value];
// 标记是一个小图标，通常是一个表情；最多留两个字符。
const cleanMark = (value) =>
  typeof value === 'string' ? charsOf(value.trim()).slice(0, 2).join('') : '';
// 标记画在一个小圆里时显示哪几个字符：两个都是半角的（字母、数字、符号）才两个都放得下；
// 里面有汉字、表情这类宽的字符时只显示第一个，免得挤到圆外面。
export function markParts(mark) {
  const chars = charsOf(mark || '');
  return chars.length > 1 && !chars.every((char) => /^[!-~]$/.test(char))
    ? chars.slice(0, 1)
    : chars;
}
const cleanFrame = (value) =>
  typeof value === 'string' && /^[\w:.-]{1,60}$/.test(value) ? value : '';

const emptyAccount = (handle) => ({
  handle,
  friends: { color: '', mark: '', frame: '', users: [], syncedAt: 0 },
  groups: [],
  members: {},
});

// 好友名单：去掉不像账号的和重复的，编号不是正整数的记成 0（没有编号）。
function cleanFriends(users) {
  const seen = new Set();
  const list = [];
  for (const user of Array.isArray(users) ? users : []) {
    if (!isHandle(user?.handle) || seen.has(userId(user.handle))) continue;
    seen.add(userId(user.handle));
    list.push({ handle: user.handle, id: Number.isInteger(user.id) && user.id > 0 ? user.id : 0 });
  }
  return list;
}

function readAccount(entry) {
  if (!isObject(entry) || !isHandle(entry.handle)) return null;
  const account = emptyAccount(entry.handle);
  if (isObject(entry.friends)) {
    account.friends = {
      color: cleanColor(entry.friends.color),
      mark: cleanMark(entry.friends.mark),
      frame: cleanFrame(entry.friends.frame),
      users: cleanFriends(entry.friends.users),
      syncedAt: Number.isFinite(entry.friends.syncedAt) ? entry.friends.syncedAt : 0,
    };
  }
  const ids = new Set([FRIENDS_GROUP]);
  for (const group of Array.isArray(entry.groups) ? entry.groups : []) {
    const name = text(group?.name, NAME_LIMIT);
    if (typeof group?.id !== 'string' || !group.id || ids.has(group.id) || !name) continue;
    ids.add(group.id);
    account.groups.push({
      id: group.id,
      name,
      color: cleanColor(group.color),
      mark: cleanMark(group.mark),
      frame: cleanFrame(group.frame),
    });
  }
  ids.delete(FRIENDS_GROUP);
  if (isObject(entry.members)) {
    for (const [id, member] of Object.entries(entry.members)) {
      if (!isObject(member) || !isHandle(member.handle) || userId(member.handle) !== id) continue;
      const groups = [...new Set(Array.isArray(member.groups) ? member.groups : [])].filter(
        (group) => ids.has(group),
      );
      const memo = text(member.memo, MEMO_LIMIT);
      // 既不在分组里、也没有备注的记录没有用。
      if (groups.length || memo) account.members[id] = { handle: member.handle, groups, memo };
    }
  }
  return account;
}

// 把读到的内容整理成可用的结构：不是这个结构的当作空的，残缺的账号、分组、成员丢掉。
export function readStore(value) {
  const accounts = {};
  if (isObject(value?.accounts)) {
    for (const [id, entry] of Object.entries(value.accounts)) {
      const account = readAccount(entry);
      if (account && userId(account.handle) === id) accounts[id] = account;
    }
  }
  return { accounts };
}

// 取某个登录账号的分组；还没有的话建一份空的放进 store。
export function accountOf(store, owner) {
  const id = userId(owner);
  if (!store.accounts[id]) store.accounts[id] = emptyAccount(owner);
  store.accounts[id].handle = owner;
  return store.accounts[id];
}

// —— 查询 ——
export const isFriend = (account, handle) =>
  account.friends.users.some((user) => userId(user.handle) === userId(handle));
// 好友在原站的用户编号；不是好友或没有编号时是 0。
export const friendId = (account, handle) =>
  account.friends.users.find((user) => userId(user.handle) === userId(handle))?.id || 0;
const findGroup = (account, id) => account.groups.find((group) => group.id === id) || null;
const customIdsOf = (account, handle) => {
  const joined = new Set(account.members[userId(handle)]?.groups);
  return account.groups.filter((group) => joined.has(group.id)).map((group) => group.id);
};
// 这个人所在的分组，按分组的先后：是好友的话「好友」在最前，后面是自建的分组。
export const groupIdsOf = (account, handle) => [
  ...(isFriend(account, handle) ? [FRIENDS_GROUP] : []),
  ...customIdsOf(account, handle),
];
// 用户名后面显示哪个分组的标记：第一个自建的分组；一个都不在但是好友时是「好友」；都不是时没有。
export function markGroupOf(account, handle) {
  const [first] = customIdsOf(account, handle);
  if (first) return first;
  return isFriend(account, handle) ? FRIENDS_GROUP : '';
}
// 这个人用哪个分组的头像框：按分组的先后取第一个设了头像框的；都没设时是空的，由段位头像框接着决定。
export function frameOf(account, handle) {
  for (const id of groupIdsOf(account, handle)) {
    const frame = id === FRIENDS_GROUP ? account.friends.frame : findGroup(account, id).frame;
    if (frame) return frame;
  }
  return '';
}
export const memoOf = (account, handle) => account.members[userId(handle)]?.memo || '';
// 一个分组里的成员，原样的大小写。
export function membersOf(account, groupId) {
  if (groupId === FRIENDS_GROUP) return account.friends.users.map((user) => user.handle);
  return Object.values(account.members)
    .filter((member) => member.groups.includes(groupId))
    .map((member) => member.handle);
}
// 一个分组的小标画出来是哪几个字符：「好友」没设时是一颗星；别的分组没设时是空的，画成一个色点。
export function shownMark(group) {
  const chars = markParts(group.mark);
  return group.builtin && !chars.length ? ['★'] : chars;
}
// 这个账号的分组里出现过的所有人（好友和各个自建分组的成员），不重复。
export function everyoneIn(account) {
  const seen = new Map();
  for (const user of account.friends.users) seen.set(userId(user.handle), user.handle);
  for (const member of Object.values(account.members))
    if (!seen.has(userId(member.handle))) seen.set(userId(member.handle), member.handle);
  return [...seen.values()];
}
// 全部分组，「好友」在最前。count 是成员数。
export function listGroups(account) {
  return [
    {
      id: FRIENDS_GROUP,
      builtin: true,
      color: account.friends.color,
      mark: account.friends.mark,
      frame: account.friends.frame,
      count: account.friends.users.length,
    },
    ...account.groups.map((group) => ({
      ...group,
      builtin: false,
      count: membersOf(account, group.id).length,
    })),
  ];
}

// —— 分组 ——
const nameTaken = (account, name, except = '') =>
  account.groups.some(
    (group) => group.id !== except && group.name.toLowerCase() === name.toLowerCase(),
  );
// 和这个名字重名（不分大小写）的自建分组的 id；没有就是空串。新建时被拒，用它找出是和谁重了。
export const groupNamed = (account, name) =>
  account.groups.find((group) => group.name.toLowerCase() === text(name, NAME_LIMIT).toLowerCase())
    ?.id || '';
// 新建一个分组，排在最后。名字是空的或和已有的分组重名（不分大小写）时不建，返回空串；建成了返回它的 id。
export function addGroup(account, { name, color = '', mark = '' }) {
  const clean = text(name, NAME_LIMIT);
  if (!clean || nameTaken(account, clean)) return '';
  // id 取现有的最大编号加一。删掉的分组的编号可能被再用，删的时候成员里的记录已经一起清掉了。
  const last = Math.max(0, ...account.groups.map((group) => Number(group.id.slice(1)) || 0));
  const id = `g${last + 1}`;
  account.groups.push({
    id,
    name: clean,
    color: cleanColor(color),
    mark: cleanMark(mark),
    frame: '',
  });
  return id;
}
// 改一个分组：name、color、mark、frame 里给了哪项改哪项。「好友」的名字是固定的，别的三项可以改。
// 改名时新名字是空的或和别的分组重名，就什么都不改。返回有没有改动。
export function editGroup(account, id, changes) {
  const group = id === FRIENDS_GROUP ? account.friends : findGroup(account, id);
  if (!group) return false;
  const next = { ...group };
  if ('name' in changes && id !== FRIENDS_GROUP) {
    next.name = text(changes.name, NAME_LIMIT);
    if (!next.name || nameTaken(account, next.name, id)) return false;
  }
  if ('color' in changes) next.color = cleanColor(changes.color);
  if ('mark' in changes) next.mark = cleanMark(changes.mark);
  if ('frame' in changes) next.frame = cleanFrame(changes.frame);
  const changed = Object.keys(next).some((key) => next[key] !== group[key]);
  Object.assign(group, next);
  return changed;
}
// 成员不在任何自建分组里时，记录只为了备注才留着：没有备注的去掉；
// 也不是好友的，连同备注一起去掉（不在任何分组里的人没有备注）。
function dropLoose(account, handle) {
  const id = userId(handle);
  const member = account.members[id];
  if (!member || member.groups.length) return;
  if (!member.memo || !isFriend(account, handle)) delete account.members[id];
}
// 删掉一个自建的分组，成员从这个分组里出来。返回有没有删。
export function removeGroup(account, id) {
  const at = account.groups.findIndex((group) => group.id === id);
  if (at < 0) return false;
  account.groups.splice(at, 1);
  for (const member of Object.values(account.members)) {
    member.groups = member.groups.filter((group) => group !== id);
    dropLoose(account, member.handle);
  }
  return true;
}
// 把一个自建的分组挪到第 index 个（从 0 数，只在自建的分组里排，「好友」不参与）。返回有没有挪动。
export function moveGroup(account, id, index) {
  const from = account.groups.findIndex((group) => group.id === id);
  const to = Math.max(0, Math.min(account.groups.length - 1, Math.trunc(index)));
  if (from < 0 || !Number.isFinite(to) || from === to) return false;
  account.groups.splice(to, 0, ...account.groups.splice(from, 1));
  return true;
}

// —— 成员 ——
// 把一些人加进一个自建的分组。返回 { added: 新加进去的账号, invalid: 不像账号的那些 }；已经在里面的不算。
export function joinGroup(account, groupId, handles) {
  const result = { added: [], invalid: [] };
  if (!findGroup(account, groupId)) return result;
  for (const raw of handles) {
    const handle = typeof raw === 'string' ? raw.trim() : '';
    if (!isHandle(handle)) {
      if (handle) result.invalid.push(handle);
      continue;
    }
    const id = userId(handle);
    const member = (account.members[id] ||= { handle, groups: [], memo: '' });
    if (member.groups.includes(groupId)) continue;
    member.groups.push(groupId);
    result.added.push(member.handle);
  }
  return result;
}
// 把一些人从一个自建的分组里移出去。返回移出去了几个。
export function leaveGroup(account, groupId, handles) {
  let left = 0;
  for (const handle of handles) {
    const member = account.members[userId(handle)];
    if (!member?.groups.includes(groupId)) continue;
    member.groups = member.groups.filter((group) => group !== groupId);
    dropLoose(account, handle);
    left++;
  }
  return left;
}
// 写备注。只有在某个分组里的人（好友也算）才能有备注；写成空的就是去掉备注。返回有没有改动。
export function setMemo(account, handle, memo) {
  if (!isHandle(handle) || !groupIdsOf(account, handle).length) return false;
  const clean = text(memo, MEMO_LIMIT);
  const id = userId(handle);
  if ((account.members[id]?.memo || '') === clean) return false;
  (account.members[id] ||= { handle, groups: [], memo: '' }).memo = clean;
  dropLoose(account, handle);
  return true;
}

// —— 好友 ——
// 把好友名单整份换成刚同步到的。不再是好友的人如果还有备注，记录留着：同步不删别的东西，重新关注后备注还在。
export function setFriends(account, users, now) {
  account.friends.users = cleanFriends(users);
  account.friends.syncedAt = now;
}
// 在页面上点了关注或取消关注之后，名单跟着改这一个人。返回有没有改动。
export function followUser(account, handle, id = 0) {
  if (!isHandle(handle) || isFriend(account, handle)) return false;
  account.friends.users.push(...cleanFriends([{ handle, id }]));
  return true;
}
export function unfollowUser(account, handle) {
  const at = account.friends.users.findIndex((user) => userId(user.handle) === userId(handle));
  if (at < 0) return false;
  account.friends.users.splice(at, 1);
  dropLoose(account, handle);
  return true;
}

// —— 改名 ——
// 接口用旧名字也查得到人，返回的是现在的名字。requested 是查的名字，users 是接口按同样先后返回的资料；
// 两边名字不一样（不只是大小写不一样）的就是改过名的，返回 [{ from, to }]。
// 这是靠「先后一样」认出来的，认错了会把记录改乱，所以先核对：两边人数要一样，
// 而且对不上的那个旧名字不能出现在返回的别的位置上（出现了说明先后是乱的）。核对不过就一个都不认。
export function findRenames(requested, users) {
  if (!Array.isArray(users) || users.length !== requested.length) return [];
  const returned = new Set(
    users.map((user) => (isHandle(user?.handle) ? userId(user.handle) : '')),
  );
  const renames = [];
  for (const [index, from] of requested.entries()) {
    const to = users[index]?.handle;
    if (!isHandle(to)) return [];
    if (userId(to) === userId(from)) continue;
    if (returned.has(userId(from))) return [];
    renames.push({ from, to });
  }
  return renames;
}
// 一个成员改了名：好友名单和成员记录里的旧名字换成新名字。新名字已经有记录时并成一条：
// 所在的分组取两边的并集；备注两边都有时留新名字那条。
// 返回 { changed, lostMemo }，lostMemo 是因此被放掉的那条旧备注（没有就是空串），好让界面提示出来。
export function renameUser(account, from, to) {
  const result = { changed: false, lostMemo: '' };
  if (!isHandle(to) || userId(from) === userId(to)) return result;
  const friend = account.friends.users.find((user) => userId(user.handle) === userId(from));
  if (friend) {
    if (isFriend(account, to)) unfollowUserEntry(account, from);
    else friend.handle = to;
    result.changed = true;
  }
  const source = account.members[userId(from)];
  if (source) {
    const target = account.members[userId(to)];
    const joined = new Set([...source.groups, ...(target?.groups || [])]);
    if (target?.memo && source.memo && target.memo !== source.memo) result.lostMemo = source.memo;
    delete account.members[userId(from)];
    account.members[userId(to)] = {
      handle: to,
      groups: account.groups.filter((group) => joined.has(group.id)).map((group) => group.id),
      memo: target?.memo || source.memo,
    };
    result.changed = true;
  }
  return result;
}
// 只把好友名单里的这一条去掉，不动成员记录（改名合并时用）。
function unfollowUserEntry(account, handle) {
  account.friends.users = account.friends.users.filter(
    (user) => userId(user.handle) !== userId(handle),
  );
}
// 登录账号自己改了名：把旧名字下的分组整份挪到新名字下。新名字下已经有分组时不动。返回有没有挪。
export function moveAccount(store, from, to) {
  const source = store.accounts[userId(from)];
  if (!source || !isHandle(to) || userId(from) === userId(to) || store.accounts[userId(to)])
    return false;
  delete store.accounts[userId(from)];
  store.accounts[userId(to)] = { ...source, handle: to };
  return true;
}
