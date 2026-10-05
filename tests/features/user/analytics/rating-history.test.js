import test from 'node:test';
import assert from 'node:assert/strict';
import {
  packRatingHistory,
  isRatingHistory,
  nearestIndex,
  divisionOf,
  rowsOfDivision,
  rankTicks,
  HISTORY,
} from '../../../../src/features/user/analytics/rating-history.js';

const change = (time, newRating, extra = {}) => ({
  contestId: time,
  contestName: `Round ${time}`,
  handle: 'Alice',
  rank: 10,
  ratingUpdateTimeSeconds: time,
  oldRating: newRating - 20,
  newRating,
  ...extra,
});

test('评级变化按时间排好，每场一行数字，比赛名称另放一张表', () => {
  const history = packRatingHistory('alice', [change(300, 1500), change(100, 1400)], {
    fetchedAt: 9,
  });
  assert.equal(history.handle, 'Alice');
  assert.equal(history.fetchedAt, 9);
  assert.deepEqual(history.rows, [
    [100, 100, 10, 1380, 1400],
    [300, 300, 10, 1480, 1500],
  ]);
  assert.deepEqual(history.contests, ['Round 100', 'Round 300']);
  assert.equal(history.rows[1][HISTORY.rating], 1500);
  assert.ok(isRatingHistory(history));
});

test('没有评级记录的账号得到空的历史，账号名用传进来的', () => {
  const history = packRatingHistory('bob', [], { fetchedAt: 1 });
  assert.deepEqual(history, { handle: 'bob', fetchedAt: 1, rows: [], contests: [] });
  assert.ok(isRatingHistory(history));
  assert.equal(isRatingHistory({ handle: 'bob', fetchedAt: 1, rows: [] }), false);
  assert.equal(isRatingHistory(null), false);
});

test('找离某一时刻最近的一场比赛', () => {
  const { rows } = packRatingHistory('alice', [change(100, 1), change(200, 2), change(400, 3)]);
  assert.equal(nearestIndex([], 100), -1);
  assert.equal(nearestIndex(rows, 0), 0);
  assert.equal(nearestIndex(rows, 100), 0);
  assert.equal(nearestIndex(rows, 149), 0);
  assert.equal(nearestIndex(rows, 151), 1);
  assert.equal(nearestIndex(rows, 290), 1);
  assert.equal(nearestIndex(rows, 310), 2);
  assert.equal(nearestIndex(rows, 9999), 2);
});

test('比赛归类：只写了一个级别的归到那一级，合并场按赛前的评级归，没写级别的归到 other', () => {
  assert.equal(divisionOf('Codeforces Round 900 (Div. 3)'), 'div3');
  assert.equal(divisionOf('Codeforces Round #729 (Div. 2)'), 'div2');
  assert.equal(divisionOf('Educational Codeforces Round 150 (Rated for Div. 2)'), 'div2');
  assert.equal(divisionOf('Codeforces Round 889 (Div. 1)'), 'div1');
  assert.equal(divisionOf('Codeforces Round 898 (Div. 4)'), 'div4');
  assert.equal(divisionOf('Codeforces Round 100 (Div.2)'), 'div2');
  // 只写了一个级别的不看评级。
  assert.equal(divisionOf('Codeforces Round 900 (Div. 3)', 2400), 'div3');
  // 合并场：赛前评级到 1900 算 Div. 1，不到的、还没有评级的算 Div. 2。
  const merged = 'Atto Round 1 (Codeforces Round 1041, Div. 1 + Div. 2)';
  assert.equal(divisionOf(merged, 1900), 'div1');
  assert.equal(divisionOf(merged, 2750), 'div1');
  assert.equal(divisionOf(merged, 1899), 'div2');
  assert.equal(divisionOf(merged, 1200), 'div2');
  assert.equal(divisionOf(merged), 'div2');
  assert.equal(divisionOf('CodeTON Round 5 (Div. 1 + Div. 2, Rated, Prizes!)', 2000), 'div1');
  assert.equal(divisionOf('Some Round (Div. 3 + Div. 4)', 2000), 'div3');
  assert.equal(divisionOf('Some Round (Div. 3 + Div. 4)', 1000), 'div4');
  assert.equal(divisionOf('Codeforces Global Round 20', 2000), 'other');
  assert.equal(divisionOf('Codeforces Beta Round #1'), 'other');
  assert.equal(divisionOf(''), 'other');
});

test('按类别取出要画的场次，没有名次的不要', () => {
  const history = packRatingHistory('alice', [
    change(100, 1400, { contestName: 'Round A (Div. 2)', rank: 500 }),
    change(200, 1450, { contestName: 'Round B (Div. 1 + Div. 2)', rank: 900 }),
    change(250, 1950, { contestName: 'Round E (Div. 1 + Div. 2)', rank: 300, oldRating: 1905 }),
    change(260, 1900, { contestName: 'Global Round 9', rank: 800 }),
    change(300, 1500, { contestName: 'Round C (Div. 2)', rank: 0 }),
    change(400, 1550, { contestName: 'Round D (Div. 2)', rank: 120 }),
  ]);
  const all = rowsOfDivision(history);
  assert.deepEqual(
    all.rows.map((row) => row[HISTORY.rank]),
    [500, 900, 300, 800, 120],
  );
  // 合并场里，赛前不到 1900 的那一次算 Div. 2，到了 1900 的那一次算 Div. 1。
  const second = rowsOfDivision(history, 'div2');
  assert.deepEqual(
    second.rows.map((row) => row[HISTORY.time]),
    [100, 200, 400],
  );
  assert.deepEqual(second.names, [
    'Round A (Div. 2)',
    'Round B (Div. 1 + Div. 2)',
    'Round D (Div. 2)',
  ]);
  assert.deepEqual(rowsOfDivision(history, 'div1').names, ['Round E (Div. 1 + Div. 2)']);
  assert.deepEqual(rowsOfDivision(history, 'other').names, ['Global Round 9']);
  assert.deepEqual(rowsOfDivision(history, 'div3'), { rows: [], names: [] });
});

test('名次轴的刻度：按范围宽窄取疏密合适的一组', () => {
  assert.deepEqual(rankTicks(50, 8000), [50, 100, 200, 500, 1000, 2000, 5000]);
  // 范围很宽时不再标 2 和 5。
  assert.deepEqual(rankTicks(1, 3000), [1, 3, 10, 30, 100, 300, 1000, 3000]);
  assert.deepEqual(rankTicks(0.8, 40000), [1, 10, 100, 1000, 10000]);
  // 范围很窄时改成等间隔的整数。
  assert.deepEqual(rankTicks(1047.3, 2187.9), [1200, 1400, 1600, 1800, 2000]);
  assert.deepEqual(rankTicks(3, 4), [3, 4]);
  assert.deepEqual(rankTicks(57, 57), [57]);
  assert.deepEqual(rankTicks(0.2, 0.9), [1]);
});
