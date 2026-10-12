import test from 'node:test';
import assert from 'node:assert/strict';
import {
  teamIndex,
  teamRecordFor,
  teamIsUnrated,
  teamSize,
  memberParts,
  textBefore,
} from '../../../../../src/features/contest/rating-prediction/standings/team-rows.js';

const team = { handle: 'A', members: ['A', 'B', 'C'], status: 'rated' };
const other = { handle: 'X', members: ['X', 'Y'], status: 'unrated' };
const solo = { handle: 'S', status: 'rated' };
const teams = teamIndex([team, other, solo]);

test('按队员的账号找到队伍的记录，个人的记录不在其中', () => {
  assert.equal(teamRecordFor(['a', 'b', 'c'], teams), team);
  assert.equal(teamRecordFor(['x', 'y'], teams), other);
  assert.equal(teams.has('s'), false);
});

test('格子里只露出前两个队员也对得上', () => {
  assert.equal(teamRecordFor(['a', 'b'], teams), team);
});

test('账号分属两支队、或者有不认识的账号，都算没对上', () => {
  assert.equal(teamRecordFor(['a', 'x'], teams), null);
  assert.equal(teamRecordFor(['a', 'nobody'], teams), null);
  assert.equal(teamRecordFor(['nobody', 'else'], teams), null);
  assert.equal(teamRecordFor([], teams), null);
  assert.equal(teamIndex(undefined).size, 0);
});

test('找不到记录的队伍：队员都没有计分记录才断定不计分', () => {
  const records = new Map([
    ['m1', { status: 'rated' }],
    ['m2', { status: 'rated' }],
    ['u1', { status: 'unrated' }],
  ]);
  // 旧版本缓存的快照：队员各有计分记录，这支队其实是计分的，不下结论。
  assert.equal(teamIsUnrated(['m1', 'm2'], records), false);
  assert.equal(teamIsUnrated(['u1', 'nobody'], records), true);
  assert.equal(teamIsUnrated(['nobody', 'else'], records), true);
  // 个人的行不归这里管。
  assert.equal(teamIsUnrated(['u1'], records), false);
});

// 只带用得到的几样：节点类型、子节点、文字、是不是队名的链接。
const textNode = (data) => ({ nodeType: 3, data });
const element = (name, ...childNodes) => ({ nodeType: 1, name, childNodes });
const isTeamName = (node) => node.name === 'team';

test('名字前面的文字：队名里的星号不算，写在外面的星号算', () => {
  const member = element('profile', textNode('lowgear'));
  // 原站的样子：国旗、<span><a 队名>: <a 成员>, <a 成员></span>
  const rated = element(
    'td',
    textNode('\n'),
    element('img'),
    element('span', element('team', textNode('***')), textNode(': '), member, textNode(', ')),
  );
  assert.equal(textBefore(rated, member).includes('*'), true);
  assert.equal(textBefore(rated, member, isTeamName).includes('*'), false);
  assert.equal(textBefore(rated, member, isTeamName), '\n: ');

  const outside = element(
    'td',
    textNode(' * '),
    element('span', element('team', textNode('Night Owls')), textNode(': '), member),
  );
  assert.equal(textBefore(outside, member, isTeamName).includes('*'), true);
});

test('名字前面的文字：到这个名字为止，后面的不看', () => {
  const first = element('profile', textNode('a'));
  const cell = element(
    'td',
    textNode('x'),
    first,
    textNode(' * '),
    element('profile', textNode('b')),
  );
  assert.equal(textBefore(cell, first), 'x');
});

test('开了队伍格式化之后：队名在上面一块、成员在下面一块，照样只跳过队名', () => {
  const member = element('profile', textNode('obidaluiza'));
  const formatted = element(
    'td',
    element('div', element('span', element('team', textNode('Некуин C**')))),
    element('div', element('div', member)),
  );
  assert.equal(textBefore(formatted, member, isTeamName).includes('*'), false);
  const starred = element(
    'td',
    element('div', textNode('*'), element('span', element('team', textNode('TavasReza')))),
    element('div', element('div', member)),
  );
  assert.equal(textBefore(starred, member, isTeamName).includes('*'), true);
});

test('队伍的人数：有队名的就是队伍，一个人的队也算；个人是 0', () => {
  assert.equal(teamSize(1, false), 0);
  assert.equal(teamSize(1, true), 1);
  assert.equal(teamSize(2, true), 2);
  // 没有队名、但一格里有两个人的，也按队伍算。
  assert.equal(teamSize(2, false), 2);
  // 原站只露出前两个，其余折叠在「...」里。
  assert.equal(teamSize(2, true, 8), 10);
  assert.equal(teamSize(0, false), 0);
});

test('计分队伍按成员分开：照记录里的先后给出每个人自己的评级', () => {
  const record = {
    status: 'rated',
    members: ['Perforator', 'BledDest'],
    memberRatings: [
      [2472, 2708],
      [2115, 2351],
    ],
  };
  const expected = [
    { handle: 'Perforator', before: 2472, after: 2708 },
    { handle: 'BledDest', before: 2115, after: 2351 },
  ];
  assert.deepEqual(memberParts(record, ['perforator', 'bleddest']), expected);
  // 格子里的先后不管怎样，都照记录的（原站榜单上的先后）。
  assert.deepEqual(memberParts(record, ['bleddest', 'perforator']), expected);
});

test('成员没全露出来（原站折叠了第三个以后的）也按全队分', () => {
  const record = {
    members: ['a', 'b', 'c'],
    memberRatings: [
      [1500, 1510],
      [1600, 1610],
      [1700, 1710],
    ],
  };
  assert.deepEqual(
    memberParts(record, ['a', 'b']).map((part) => part.handle),
    ['a', 'b', 'c'],
  );
});

test('不分的情况：旧缓存里没有成员评级、有不属于这支队的人、只有一个人', () => {
  const ratings = [
    [1500, 1510],
    [1600, 1610],
  ];
  assert.equal(memberParts({ members: ['a', 'b'] }, ['a', 'b']), null);
  assert.equal(memberParts({ members: ['a', 'b'], memberRatings: ratings }, ['a', 'x']), null);
  assert.equal(memberParts({ members: ['a', 'b'], memberRatings: ratings }, []), null);
  assert.equal(memberParts({ members: ['a'], memberRatings: ratings.slice(0, 1) }, ['a']), null);
  assert.equal(memberParts(null, ['a', 'b']), null);
  assert.equal(memberParts({ handle: 'solo', status: 'rated' }, ['solo']), null);
});
