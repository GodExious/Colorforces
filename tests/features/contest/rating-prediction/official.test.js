import test from 'node:test';
import assert from 'node:assert/strict';
import {
  officialParticipants,
  unratedContest,
} from '../../../../src/features/contest/rating-prediction/official.js';

const change = (handle, rank, oldRating, newRating) => ({ handle, rank, oldRating, newRating });
const row = (rank, ...handles) => ({
  rank,
  party: { members: handles.map((handle) => ({ handle })), participantType: 'CONTESTANT' },
});

test('个人赛：一条记录一个参赛者', () => {
  const list = officialParticipants(
    [change('a', 1, 2000, 2050), change('b', 2, 1900, 1880)],
    [row(1, 'a'), row(2, 'b')],
    2000,
  );
  assert.deepEqual(
    list.map((p) => [p.handle, p.rank, p.points, p.rating, p.officialDelta, p.members]),
    [
      ['a', 1, -1, 2000, 50, undefined],
      ['b', 2, -2, 1900, -20, undefined],
    ],
  );
  assert.ok(list.every((p) => p.status === 'rated' && p.valid));
});

test('团队计分：一支队合成一个参赛者，评级取队伍的评级，涨跌取记录里的', () => {
  const list = officialParticipants(
    [
      change('x1', 1, 2472, 2708),
      change('x2', 1, 2115, 2351),
      change('solo', 2, 2300, 2310),
      change('y1', 3, 2387, 2400),
      change('y2', 3, 2665, 2678),
    ],
    [row(1, 'x1', 'x2'), row(2, 'solo'), row(3, 'y1', 'y2')],
    923,
  );
  assert.equal(list.length, 3);
  const [x, solo, y] = list;
  assert.deepEqual(x.members, ['x1', 'x2']);
  assert.equal(x.handle, 'x1');
  assert.equal(x.rating, 2508);
  assert.equal(x.rank, 1);
  assert.equal(x.officialDelta, 236);
  assert.equal(x.reportedRating, null);
  // 每个队员自己的赛前、赛后评级，和 members 一一对应。
  assert.deepEqual(x.memberRatings, [
    [2472, 2708],
    [2115, 2351],
  ]);
  assert.ok(x.valid);
  // 一个人的队照旧是他自己。
  assert.equal(solo.members, undefined);
  assert.equal(solo.rating, 2300);
  assert.equal(solo.reportedRating, 2300);
  assert.equal(y.rating, 2717);
  assert.equal(y.officialDelta, 13);
});

test('队员的账号大小写和榜单上不一致也认得出', () => {
  const list = officialParticipants(
    [change('Alpha', 1, 2000, 2010), change('beta', 1, 2000, 2010)],
    [row(1, 'alpha', 'Beta')],
    923,
  );
  assert.equal(list.length, 1);
  assert.deepEqual(list[0].members, ['Alpha', 'beta']);
});

test('只给个人计分的比赛：没有记录的队伍不在计分人群里，一个人的队也一样', () => {
  const list = officialParticipants(
    [change('a', 1, 1500, 1600)],
    [row(1, 'a'), row(2, 'p', 'q', 'r'), row(3, 'lonely')],
    120,
  );
  assert.deepEqual(
    list.map((p) => p.handle),
    ['a'],
  );
});

test('队里有人没有记录：不合成队伍，有记录的人照旧各算各的', () => {
  const list = officialParticipants([change('a', 1, 1500, 1600)], [row(1, 'a', 'ghost')], 923);
  assert.equal(list.length, 1);
  assert.equal(list[0].members, undefined);
  assert.equal(list[0].rating, 1500);
});

test('同队的涨跌分不一样时不取官方的', () => {
  const list = officialParticipants(
    [change('a', 1, 1500, 1600), change('b', 1, 1500, 1590)],
    [row(1, 'a', 'b')],
    923,
  );
  assert.equal(list[0].officialDelta, null);
  assert.ok(list[0].valid);
});

test('新号规则之后的首场账号按 1400 算，之前的不动', () => {
  const [late] = officialParticipants([change('n', 5, 0, 450)], [row(5, 'n')], 1500);
  assert.equal(late.rating, 1400);
  assert.equal(late.reportedRating, 0);
  assert.ok(late.initial);
  const [early] = officialParticipants([change('n', 5, 0, 450)], [row(5, 'n')], 900);
  assert.equal(early.rating, 0);
  assert.ok(!early.initial);
});

test('这一场计不计分', () => {
  const DAY = 86400;
  const ended = (days, extra = {}) => ({
    name: '2019-2020 ICPC, NERC, Southern Subregional (Online Mirror)',
    phase: 'FINISHED',
    startTimeSeconds: 1000,
    durationSeconds: 18000,
    ...extra,
  });
  const at = (days) => 1000 + 18000 + days * DAY;
  // 有评级变化记录的一定计分，名字怎么写都一样。
  assert.equal(unratedContest(ended(), true, at(400)), false);
  assert.equal(unratedContest(ended(0, { name: 'Unrated Round' }), true, at(400)), false);
  // 没有记录：结束三天以上就是不计分；刚结束的还在等出分。
  assert.equal(unratedContest(ended(), false, at(400)), true);
  assert.equal(unratedContest(ended(), false, at(3.1)), true);
  assert.equal(unratedContest(ended(), false, at(2.9)), false);
  // 名字里写明了的，不用等。
  assert.equal(
    unratedContest(ended(0, { name: 'Mirror (Unrated, ICPC Rules)' }), false, at(0)),
    true,
  );
  assert.equal(unratedContest(ended(0, { isRated: false }), false, at(0)), true);
  // 还在进行的普通比赛不算。
  assert.equal(
    unratedContest(
      {
        name: 'Codeforces Round 1000',
        phase: 'CODING',
        startTimeSeconds: 1000,
        durationSeconds: 7200,
      },
      false,
      2000,
    ),
    false,
  );
});
