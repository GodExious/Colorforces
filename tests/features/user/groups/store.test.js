import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRIENDS_GROUP,
  MEMO_LIMIT,
  NAME_LIMIT,
  accountOf,
  addGroup,
  editGroup,
  everyoneIn,
  findRenames,
  followUser,
  frameOf,
  friendId,
  groupIdsOf,
  groupNamed,
  isFriend,
  joinGroup,
  leaveGroup,
  listGroups,
  markGroupOf,
  markParts,
  memoOf,
  membersOf,
  moveAccount,
  moveGroup,
  readStore,
  removeGroup,
  renameUser,
  setFriends,
  setMemo,
  shownMark,
  unfollowUser,
} from '../../../../src/features/user/groups/store.js';

// 一个登录账号的分组：两个好友（Alice、Bob），两个自建的分组（队友、cute pigs）。
function sample() {
  const store = { accounts: {} };
  const account = accountOf(store, 'Owner');
  setFriends(
    account,
    [
      { handle: 'Alice', id: 11 },
      { handle: 'Bob', id: 22 },
    ],
    1000,
  );
  const team = addGroup(account, { name: '队友', color: '#8B5CF6' });
  const pigs = addGroup(account, { name: 'cute pigs', mark: '🐷' });
  return { store, account, team, pigs };
}

test('读到的内容不是约定的结构时当作空的，残缺的部分被丢掉', () => {
  assert.deepEqual(readStore(null), { accounts: {} });
  assert.deepEqual(readStore('text'), { accounts: {} });
  assert.deepEqual(readStore({ accounts: [] }), { accounts: {} });
  const read = readStore({
    accounts: {
      owner: {
        handle: 'Owner',
        friends: {
          color: '#FFAA00',
          mark: '🐱🐱🐱',
          frame: 'wheat',
          users: [{ handle: 'Alice', id: 11 }, { handle: 'bad name' }, { handle: 'alice', id: 5 }],
          syncedAt: 7,
        },
        groups: [
          { id: 'g1', name: ' 队友 ', color: '#ABCDEF', mark: '★', frame: 'bow' },
          { id: 'g1', name: '重复的编号' },
          { id: 'g2', name: '' },
          { id: FRIENDS_GROUP, name: '冒充好友' },
        ],
        members: {
          carol: { handle: 'Carol', groups: ['g1', 'g1', 'gone'], memo: ' 学弟 ' },
          dave: { handle: 'Dave', groups: ['gone'], memo: '' },
          wrong: { handle: 'Erin', groups: ['g1'] },
        },
      },
      // 键和账号名对不上的整份丢掉。
      other: { handle: 'Someone' },
      broken: { handle: 'no good' },
    },
  });
  assert.deepEqual(read, {
    accounts: {
      owner: {
        handle: 'Owner',
        friends: {
          color: '#ffaa00',
          mark: '🐱🐱',
          frame: 'wheat',
          users: [{ handle: 'Alice', id: 11 }],
          syncedAt: 7,
        },
        groups: [{ id: 'g1', name: '队友', color: '#abcdef', mark: '★', frame: 'bow' }],
        members: { carol: { handle: 'Carol', groups: ['g1'], memo: '学弟' } },
      },
    },
  });
  // 整理过的结构再读一遍不变。
  assert.deepEqual(readStore(read), read);
});

test('各个登录账号的分组分开存，账号名不分大小写', () => {
  const store = { accounts: {} };
  const first = accountOf(store, 'Owner');
  addGroup(first, { name: '队友' });
  assert.equal(accountOf(store, 'owner'), first);
  assert.equal(first.handle, 'owner');
  assert.deepEqual(accountOf(store, 'Another').groups, []);
  assert.deepEqual(Object.keys(store.accounts), ['owner', 'another']);
});

test('新建分组：排在最后，名字去掉首尾空白，空名字和重名的不建', () => {
  const { account, team, pigs } = sample();
  assert.equal(team, 'g1');
  assert.equal(pigs, 'g2');
  assert.equal(addGroup(account, { name: '   ' }), '');
  assert.equal(addGroup(account, { name: 'CUTE PIGS' }), '');
  assert.equal(addGroup(account, { name: `  ${'长'.repeat(NAME_LIMIT + 5)}  ` }), 'g3');
  assert.equal(account.groups[2].name.length, NAME_LIMIT);
  assert.deepEqual(account.groups[0], {
    id: 'g1',
    name: '队友',
    color: '#8b5cf6',
    mark: '',
    frame: '',
  });
  // 颜色不是 #rrggbb 的不存；标记最多两个字符。
  const loose = addGroup(account, { name: '杂项', color: 'red', mark: '🐷🐷🐷' });
  assert.equal(account.groups.at(-1).id, loose);
  assert.equal(account.groups.at(-1).color, '');
  assert.equal(account.groups.at(-1).mark, '🐷🐷');
});

test('改分组：给了哪项改哪项，重名不让改，「好友」只能改头像框', () => {
  const { account, team, pigs } = sample();
  assert.equal(editGroup(account, team, { frame: 'bow' }), true);
  assert.equal(editGroup(account, team, { frame: 'bow' }), false);
  assert.equal(editGroup(account, team, { name: 'cute pigs' }), false);
  assert.equal(editGroup(account, team, { name: '' }), false);
  assert.equal(editGroup(account, team, { name: '战队', color: '#000000' }), true);
  assert.deepEqual(account.groups[0], {
    id: team,
    name: '战队',
    color: '#000000',
    mark: '',
    frame: 'bow',
  });
  assert.equal(editGroup(account, 'nope', { name: 'x' }), false);
  // 按名字找分组：不分大小写、不看两头的空白；「好友」不算。
  assert.equal(groupNamed(account, ' CUTE PIGS '), pigs);
  assert.equal(groupNamed(account, '没有的'), '');
  assert.equal(groupNamed(account, '好友'), '');
  // 「好友」的名字是固定的；图标、颜色、头像框可以改，名单不受影响。
  assert.equal(editGroup(account, FRIENDS_GROUP, { name: '朋友' }), false);
  assert.equal(editGroup(account, FRIENDS_GROUP, { frame: 'wheat' }), true);
  assert.equal(account.friends.frame, 'wheat');
  assert.equal(editGroup(account, FRIENDS_GROUP, { color: '#FF0000', mark: '💛' }), true);
  assert.equal(editGroup(account, FRIENDS_GROUP, { color: '#ff0000' }), false);
  assert.deepEqual(listGroups(account)[0], {
    id: FRIENDS_GROUP,
    builtin: true,
    color: '#ff0000',
    mark: '💛',
    frame: 'wheat',
    count: 2,
  });
  assert.equal('name' in account.friends, false);
  assert.equal(editGroup(account, pigs, { frame: '' }), false);
});

test('调整先后只在自建的分组里排，「好友」一直在最前', () => {
  const { account, team, pigs } = sample();
  const third = addGroup(account, { name: '第三个' });
  assert.equal(moveGroup(account, third, 0), true);
  assert.deepEqual(
    listGroups(account).map((group) => group.id),
    [FRIENDS_GROUP, third, team, pigs],
  );
  assert.equal(moveGroup(account, third, 0), false);
  assert.equal(moveGroup(account, third, 99), true);
  assert.deepEqual(
    account.groups.map((group) => group.id),
    [team, pigs, third],
  );
  assert.equal(moveGroup(account, FRIENDS_GROUP, 1), false);
  assert.equal(moveGroup(account, team, Number.NaN), false);
});

test('加人和移出：已经在里面的不重复加，不像账号的列出来', () => {
  const { account, team, pigs } = sample();
  assert.deepEqual(joinGroup(account, team, ['Carol', ' Dave ', 'carol', 'not a name', '']), {
    added: ['Carol', 'Dave'],
    invalid: ['not a name'],
  });
  assert.deepEqual(joinGroup(account, 'nope', ['Carol']), { added: [], invalid: [] });
  assert.deepEqual(joinGroup(account, FRIENDS_GROUP, ['Carol']), { added: [], invalid: [] });
  joinGroup(account, pigs, ['CAROL']);
  assert.deepEqual(membersOf(account, team), ['Carol', 'Dave']);
  assert.deepEqual(membersOf(account, pigs), ['Carol']);
  assert.deepEqual(membersOf(account, FRIENDS_GROUP), ['Alice', 'Bob']);
  assert.deepEqual(
    listGroups(account).map((group) => group.count),
    [2, 2, 1],
  );
  assert.equal(leaveGroup(account, team, ['carol', 'Nobody']), 1);
  assert.deepEqual(groupIdsOf(account, 'Carol'), [pigs]);
});

test('一个人在几个分组里：标记取第一个自建的分组，头像框取最上面设了头像框的', () => {
  const { account, team, pigs } = sample();
  // Alice 是好友，也在两个自建的分组里；加入的先后和分组的先后相反。
  joinGroup(account, pigs, ['Alice']);
  joinGroup(account, team, ['Alice']);
  assert.deepEqual(groupIdsOf(account, 'alice'), [FRIENDS_GROUP, team, pigs]);
  assert.equal(markGroupOf(account, 'Alice'), team);
  // 只是好友的显示「好友」，哪个都不在的没有标记。
  assert.equal(markGroupOf(account, 'Bob'), FRIENDS_GROUP);
  assert.equal(markGroupOf(account, 'Stranger'), '');
  // 都没设头像框时是空的；「好友」排在最前，它设了就用它的。
  assert.equal(frameOf(account, 'Alice'), '');
  editGroup(account, pigs, { frame: 'pig' });
  assert.equal(frameOf(account, 'Alice'), 'pig');
  editGroup(account, team, { frame: 'bow' });
  assert.equal(frameOf(account, 'Alice'), 'bow');
  editGroup(account, FRIENDS_GROUP, { frame: 'wheat' });
  assert.equal(frameOf(account, 'Alice'), 'wheat');
  assert.equal(frameOf(account, 'Stranger'), '');
  // 分组换了先后，标记和头像框跟着变。
  editGroup(account, FRIENDS_GROUP, { frame: '' });
  moveGroup(account, pigs, 0);
  assert.equal(markGroupOf(account, 'Alice'), pigs);
  assert.equal(frameOf(account, 'Alice'), 'pig');
});

test('备注：只有在某个分组里的人才能写，好友也算；写成空的就是去掉', () => {
  const { account, team } = sample();
  assert.equal(setMemo(account, 'Stranger', '路人'), false);
  assert.equal(setMemo(account, 'Bob', '  室友  '), true);
  assert.equal(memoOf(account, 'bob'), '室友');
  assert.equal(setMemo(account, 'Bob', '室友'), false);
  joinGroup(account, team, ['Carol']);
  assert.equal(setMemo(account, 'Carol', '长'.repeat(MEMO_LIMIT + 3)), true);
  assert.equal(memoOf(account, 'Carol').length, MEMO_LIMIT);
  assert.equal(setMemo(account, 'Bob', ''), true);
  assert.equal(memoOf(account, 'Bob'), '');
  // 只为了备注才有的记录，备注去掉后不留。
  assert.equal('bob' in account.members, false);
});

test('不在任何分组里了，备注跟着去掉；删分组也一样', () => {
  const { account, team, pigs } = sample();
  joinGroup(account, team, ['Carol', 'Dave']);
  joinGroup(account, pigs, ['Dave']);
  setMemo(account, 'Carol', '学弟');
  setMemo(account, 'Dave', '队长');
  leaveGroup(account, team, ['Carol']);
  assert.equal(memoOf(account, 'Carol'), '');
  assert.equal('carol' in account.members, false);
  // Dave 还在另一个分组里，备注留着。
  assert.equal(removeGroup(account, team), true);
  assert.equal(memoOf(account, 'Dave'), '队长');
  assert.equal(removeGroup(account, pigs), true);
  assert.equal('dave' in account.members, false);
  assert.equal(removeGroup(account, pigs), false);
  assert.equal(removeGroup(account, FRIENDS_GROUP), false);
});

test('好友名单整份替换；同步不删备注，手动取消关注才删', () => {
  const { account } = sample();
  assert.equal(friendId(account, 'ALICE'), 11);
  assert.equal(friendId(account, 'Stranger'), 0);
  setMemo(account, 'Alice', '同学');
  setMemo(account, 'Bob', '室友');
  // 同步到的新名单里没有 Alice：她的备注留着，重新关注后还在。
  setFriends(
    account,
    [
      { handle: 'Bob', id: 22 },
      { handle: 'bob', id: 99 },
      { handle: 'bad name' },
      { handle: 'Zed' },
    ],
    2000,
  );
  assert.deepEqual(account.friends, {
    color: '',
    mark: '',
    frame: '',
    users: [
      { handle: 'Bob', id: 22 },
      { handle: 'Zed', id: 0 },
    ],
    syncedAt: 2000,
  });
  assert.equal(isFriend(account, 'Alice'), false);
  assert.equal(account.members.alice.memo, '同学');
  assert.equal(followUser(account, 'Alice', 11), true);
  assert.equal(followUser(account, 'alice', 11), false);
  assert.equal(memoOf(account, 'Alice'), '同学');
  // 手动取消关注：不在别的分组里的，备注一起去掉。
  assert.equal(unfollowUser(account, 'Bob'), true);
  assert.equal(unfollowUser(account, 'Bob'), false);
  assert.equal('bob' in account.members, false);
});

test('从接口的回复里认出改过名的账号', () => {
  const users = [{ handle: 'Alice' }, { handle: 'bob_new' }, { handle: 'CAROL' }];
  assert.deepEqual(findRenames(['Alice', 'bob_old', 'carol'], users), [
    { from: 'bob_old', to: 'bob_new' },
  ]);
  // 回复比请求短、或者那一项没有名字时，不当成改名。
  assert.deepEqual(findRenames(['Alice', 'Dave'], [{ handle: 'Alice' }]), []);
  assert.deepEqual(findRenames(['Alice'], [{}]), []);
  // 回复的先后和请求的对不上（旧名字出现在别的位置上）：靠先后认人不可信，一个都不认。
  assert.deepEqual(findRenames(['Alice', 'Bob'], [{ handle: 'Bob' }, { handle: 'Alice' }]), []);
  assert.deepEqual(
    findRenames(
      ['Alice', 'bob_old', 'Carol'],
      [{ handle: 'Carol' }, { handle: 'bob_new' }, { handle: 'Alice' }],
    ),
    [],
  );
  // 旧名字和新名字都在名单里：两处返回的是同一个人，认作改名。
  assert.deepEqual(
    findRenames(['bob_old', 'bob_new'], [{ handle: 'bob_new' }, { handle: 'bob_new' }]),
    [{ from: 'bob_old', to: 'bob_new' }],
  );
});

test('标记按看得见的字符数，画出来时宽的字符只留第一个', () => {
  const { account } = sample();
  // 由几个编码拼成的表情算一个字符，不会被从中间截断。
  const flags = addGroup(account, { name: '旗', mark: '🇨🇳🇯🇵🇰🇷' });
  assert.equal(account.groups.find((group) => group.id === flags).mark, '🇨🇳🇯🇵');
  const family = addGroup(account, { name: '家', mark: '👨‍👩‍👧' });
  assert.equal(account.groups.find((group) => group.id === family).mark, '👨‍👩‍👧');
  // 两个半角字符放得下；有汉字或表情时只画第一个；一个或没有的照原样。
  assert.deepEqual(markParts('11'), ['1', '1']);
  assert.deepEqual(markParts('A+'), ['A', '+']);
  assert.deepEqual(markParts('🐷🐷'), ['🐷']);
  assert.deepEqual(markParts('测试'), ['测']);
  assert.deepEqual(markParts('A测'), ['A']);
  assert.deepEqual(markParts('🐷'), ['🐷']);
  assert.deepEqual(markParts(''), []);
  assert.deepEqual(markParts(undefined), []);
  // 画出来的小标：「好友」没设时是一颗星，别的分组没设时是空的（画成色点）。
  assert.deepEqual(shownMark({ builtin: true, mark: '' }), ['★']);
  assert.deepEqual(shownMark({ builtin: true, mark: '💛' }), ['💛']);
  assert.deepEqual(shownMark({ builtin: false, mark: '' }), []);
  assert.deepEqual(shownMark({ builtin: false, mark: '🐷🐷' }), ['🐷']);
});

test('一个账号的分组里出现过的所有人，不重复', () => {
  const { account, team } = sample();
  joinGroup(account, team, ['alice', 'Zed']);
  const everyone = everyoneIn(account);
  assert.equal(new Set(everyone.map((handle) => handle.toLowerCase())).size, everyone.length);
  for (const handle of ['Alice', 'Bob', 'Zed']) assert.ok(everyone.includes(handle), handle);
});

test('成员改名：旧名字换成新名字，新名字已有记录时并成一条', () => {
  const { account, team, pigs } = sample();
  joinGroup(account, pigs, ['Bob']);
  setMemo(account, 'Bob', '室友');
  // Bob 改名叫 Bobby，好友名单和成员记录都跟着改。
  assert.deepEqual(renameUser(account, 'bob', 'Bobby'), { changed: true, lostMemo: '' });
  assert.deepEqual(account.friends.users[1], { handle: 'Bobby', id: 22 });
  assert.deepEqual(account.members.bobby, { handle: 'Bobby', groups: [pigs], memo: '室友' });
  assert.equal('bob' in account.members, false);
  // 新名字已经被手动加过：分组取并集（按分组的先后），备注留新名字那条，旧的那条交还出来。
  joinGroup(account, team, ['Bobster']);
  setMemo(account, 'Bobster', '新备注');
  assert.deepEqual(renameUser(account, 'Bobby', 'Bobster'), { changed: true, lostMemo: '室友' });
  assert.deepEqual(account.members.bobster, {
    handle: 'Bobster',
    groups: [team, pigs],
    memo: '新备注',
  });
  assert.deepEqual(
    account.friends.users.map((user) => user.handle),
    ['Alice', 'Bobster'],
  );
  // 只是大小写不同、或者查无此人的，不算改名。
  assert.deepEqual(renameUser(account, 'Alice', 'ALICE'), { changed: false, lostMemo: '' });
  assert.deepEqual(renameUser(account, 'Nobody', 'Somebody'), { changed: false, lostMemo: '' });
});

test('好友改名后新名字已经在好友名单里时，不留两条', () => {
  const { account } = sample();
  assert.equal(renameUser(account, 'Alice', 'Bob').changed, true);
  assert.deepEqual(account.friends.users, [{ handle: 'Bob', id: 22 }]);
});

test('登录账号自己改名：分组整份挪到新名字下，新名字下已有分组时不动', () => {
  const { store, account } = sample();
  assert.equal(moveAccount(store, 'OWNER', 'Owner2'), true);
  assert.deepEqual(Object.keys(store.accounts), ['owner2']);
  assert.equal(store.accounts.owner2.handle, 'Owner2');
  assert.deepEqual(store.accounts.owner2.groups, account.groups);
  accountOf(store, 'Third');
  assert.equal(moveAccount(store, 'Owner2', 'third'), false);
  assert.equal(moveAccount(store, 'Nobody', 'Fresh'), false);
});
