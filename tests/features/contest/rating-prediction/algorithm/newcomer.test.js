import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newcomerStanding,
  actualBefore,
  displayedAfter,
  actualAfter,
  withFirstBonus,
} from '../../../../../src/features/contest/rating-prediction/algorithm/newcomer.js';

// 一个真实账号前几场的记录（比赛编号、当时的显示评级）。
const history = [
  { contestId: 2161, oldRating: 0, ratingUpdateTimeSeconds: 100 },
  { contestId: 2165, oldRating: 400, ratingUpdateTimeSeconds: 200 },
  { contestId: 2166, oldRating: 618, ratingUpdateTimeSeconds: 300 },
  { contestId: 2167, oldRating: 700, ratingUpdateTimeSeconds: 400 },
  { contestId: 2169, oldRating: 817, ratingUpdateTimeSeconds: 500 },
  { contestId: 2171, oldRating: 973, ratingUpdateTimeSeconds: 600 },
  { contestId: 2175, oldRating: 921, ratingUpdateTimeSeconds: 700 },
  { contestId: 2180, oldRating: 950, ratingUpdateTimeSeconds: 800 },
];

test('回看前六场：按这一场在记录里排第几算，和现在一共打了多少场无关', () => {
  assert.deepEqual(newcomerStanding(history, 2161), { played: 0, bonus: 500, hidden: 1400 });
  assert.deepEqual(newcomerStanding(history, 2165), { played: 1, bonus: 350, hidden: 900 });
  assert.deepEqual(newcomerStanding(history, 2166), { played: 2, bonus: 250, hidden: 550 });
  assert.deepEqual(newcomerStanding(history, 2169), { played: 4, bonus: 100, hidden: 150 });
  assert.deepEqual(newcomerStanding(history, 2171), { played: 5, bonus: 50, hidden: 50 });
});

test('第七场起不修正', () => {
  assert.equal(newcomerStanding(history, 2175), null);
  assert.equal(newcomerStanding(history, 2180), null);
});

test('正在进行的比赛还不在记录里：此前打过几场就是记录的条数', () => {
  assert.deepEqual(newcomerStanding(history.slice(0, 3), 2300), {
    played: 3,
    bonus: 150,
    hidden: 300,
  });
  assert.deepEqual(newcomerStanding([], 2300), { played: 0, bonus: 500, hidden: 1400 });
  assert.equal(newcomerStanding(history, 2300), null);
});

test('记录里没有这一场时，只数开赛之前的记录', () => {
  assert.deepEqual(newcomerStanding(history, 2168, 450), { played: 4, bonus: 100, hidden: 150 });
});

test('老规则时期就有评级的账号、老规则时期的比赛、没有记录时不修正', () => {
  assert.equal(newcomerStanding([{ contestId: 1200 }, { contestId: 2161 }], 2161), null);
  assert.equal(newcomerStanding([], 1300), null);
  assert.equal(newcomerStanding(null, 2161), null);
});

test('显示评级和实际评级互相换算', () => {
  const second = newcomerStanding(history, 2165);
  assert.equal(actualBefore(400, second), 1300);
  const third = newcomerStanding(history, 2166);
  assert.equal(actualBefore(618, third), 1168);
  // 第三场：按实际评级算出 -148，显示出来是 -148 + 250 = +102。
  assert.equal(displayedAfter(1168 - 148, third), 618 + 102);
  assert.equal(actualAfter(720, third), 1020);
  const first = newcomerStanding(history, 2161);
  assert.equal(actualBefore(null, first), 1400);
  assert.equal(displayedAfter(1400 - 100, first), 400);
});

test('榜单上首场新号的涨跌补上第一场的 500 分，模型的涨跌另存；有官方涨跌的、不是新号的、老比赛不补', () => {
  const results = {
    fresh: { delta: 17, rank: 3 },
    done: { delta: 40 },
    old: { delta: -5 },
    none: {},
  };
  const participants = [
    { handle: 'fresh', initial: true },
    { handle: 'done', initial: true, officialDelta: 540 },
    { handle: 'old', initial: false },
    { handle: 'none', initial: true },
  ];
  const next = withFirstBonus(results, participants, 2160);
  assert.deepEqual(next.fresh, { delta: 517, modelDelta: 17, rank: 3 });
  assert.deepEqual(next.done, { delta: 40 });
  assert.deepEqual(next.old, { delta: -5 });
  assert.deepEqual(next.none, {});
  assert.equal(results.fresh.delta, 17, '不改原来的');
  assert.equal(withFirstBonus(results, participants, 1300), results, '新号规则之前的比赛不补');
});
