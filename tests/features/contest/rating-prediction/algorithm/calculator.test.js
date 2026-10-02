import test from 'node:test';
import assert from 'node:assert/strict';
import predict, {
  Contestant,
  RatingCalculator,
  MIN_RATING_LIMIT,
  MAX_RATING_LIMIT,
} from '../../../../../src/features/contest/rating-prediction/algorithm/calculator.js';
import { sampleRows } from '../../../../helpers/contest-rows.js';

// 由榜单行生成全新的选手对象，避免用例之间共享排序后的状态。
function contestants(rows) {
  return rows.map((row) => new Contestant(row.handle, row.points, row.penalty, row.rating));
}

// 按用户名整理预测结果，便于跨顺序比较。
function byHandle(results) {
  return Object.fromEntries(results.map((result) => [result.handle, result]));
}

test('空榜单不计算也不报错', () => {
  assert.deepEqual(predict([]), []);
});

test('未评级选手按 1400 参与计算', () => {
  const unrated = new Contestant('new', 100, 0, null);
  assert.equal(unrated.effectiveRating, 1400);
  assert.equal(new Contestant('old', 100, 0, 1777).effectiveRating, 1777);
});

test('越界评级和缺失成绩会被拒绝', () => {
  const invalid = [
    new Contestant('a', 100, 0, MAX_RATING_LIMIT),
    new Contestant('a', 100, 0, MIN_RATING_LIMIT - 1),
    new Contestant('a', 100, 0, 1500.5),
    new Contestant('a', NaN, 0, 1500),
    new Contestant('a', 100, undefined, 1500),
  ];
  for (const contestant of invalid)
    assert.throws(() => predict([contestant]), /Invalid rating prediction input/);
});

test('并列选手取组内最后一名的名次', () => {
  const calc = new RatingCalculator([
    new Contestant('c', 50, 0, 1500),
    new Contestant('a', 100, 10, 1500),
    new Contestant('d', 50, 5, 1500),
    new Contestant('b', 100, 10, 1500),
  ]);
  calc.reassignRanks();
  const ranks = Object.fromEntries(calc.contestants.map((c) => [c.handle, c.rank]));
  assert.deepEqual(ranks, { a: 2, b: 2, c: 3, d: 4 });
});

test('预期名次与逐人累加的 Elo 胜率一致', () => {
  const rows = sampleRows(30);
  const calc = new RatingCalculator(contestants(rows));
  calc.calcSeed();
  for (const assumed of [900, 1400, 2100]) {
    const self = rows[0];
    const expected =
      1 +
      rows
        .slice(1)
        .reduce((sum, other) => sum + 1 / (1 + Math.pow(10, (assumed - other.rating) / 400)), 0);
    assert.ok(Math.abs(calc.getSeed(assumed, self.rating) - expected) < 1e-6);
  }
});

test('评级相同时名次越靠前涨分越多', () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({
    handle: `p${index}`,
    points: 2000 - index * 100,
    penalty: 0,
    rating: 1500,
  }));
  const results = predict(contestants(rows));
  const deltas = rows.map((row) => byHandle(results)[row.handle].delta);
  for (let i = 1; i < deltas.length; i++) assert.ok(deltas[i] <= deltas[i - 1]);
  assert.ok(deltas[0] > 0);
  assert.ok(deltas.at(-1) < 0);
});

test('结果与输入顺序无关', () => {
  const rows = sampleRows();
  const forward = byHandle(predict(contestants(rows)));
  const backward = byHandle(predict(contestants(rows.slice().reverse())));
  for (const row of rows) assert.equal(forward[row.handle].delta, backward[row.handle].delta);
});

test('全场涨跌分之和不为正', () => {
  const results = predict(contestants(sampleRows()));
  assert.ok(results.every((result) => Number.isInteger(result.delta)));
  assert.ok(results.reduce((sum, result) => sum + result.delta, 0) <= 0);
});

test('第一名表现分为无穷大，其余落在评级范围内', () => {
  const list = contestants(sampleRows());
  predict(list, true);
  for (const contestant of list) {
    if (contestant.rank === 1) assert.equal(contestant.performance, Infinity);
    else {
      assert.ok(contestant.performance >= MIN_RATING_LIMIT);
      assert.ok(contestant.performance <= MAX_RATING_LIMIT);
    }
  }
});

test('不要求表现分时不计算', () => {
  const results = predict(contestants(sampleRows(10)));
  assert.ok(results.every((result) => result.performance === null));
});
