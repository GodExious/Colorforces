import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSnapshot,
  targetBounds,
  analyzeTarget,
} from '../../../../../src/features/contest/rating-prediction/algorithm/analysis.js';
import predict, {
  Contestant,
} from '../../../../../src/features/contest/rating-prediction/algorithm/calculator.js';
import { sampleRows } from '../../../../helpers/contest-rows.js';

const rows = sampleRows();
const handle = rows[7].handle;
const self = rows[7];

test('完整结算不改动传入的榜单', () => {
  const before = JSON.stringify(rows);
  calculateSnapshot(rows);
  assert.equal(JSON.stringify(rows), before);
});

test('完整结算与直接调用预测器结果一致', () => {
  const snapshot = calculateSnapshot(rows);
  const direct = predict(
    rows.map((row) => new Contestant(row.handle, row.points, row.penalty, row.rating)),
  );
  assert.equal(Object.keys(snapshot).length, rows.length);
  for (const result of direct) assert.equal(snapshot[result.handle].delta, result.delta);
  for (const entry of Object.values(snapshot)) assert.ok(Number.isInteger(entry.rank));
});

test('按名次分析：结束评级等于当前评级加涨跌分', () => {
  const result = analyzeTarget(rows, handle, 'rank', 5);
  assert.equal(result.rank, 5);
  assert.equal(result.rating, self.rating + result.delta);
});

test('按名次分析：第一名不低于最后一名', () => {
  const first = analyzeTarget(rows, handle, 'rank', 1);
  const last = analyzeTarget(rows, handle, 'rank', rows.length);
  assert.ok(first.rating >= last.rating);
  assert.ok(first.delta > 0);
  assert.ok(last.delta < 0);
});

test('目标范围取首尾名次的可达评级', () => {
  const bounds = targetBounds(rows, handle);
  const first = analyzeTarget(rows, handle, 'rank', 1);
  const last = analyzeTarget(rows, handle, 'rank', rows.length);
  assert.deepEqual(bounds, {
    rankMin: 1,
    rankMax: rows.length,
    ratingMin: last.rating,
    ratingMax: first.rating,
  });
});

test('按评级分析：返回达到目标所需的最低名次', () => {
  const bounds = targetBounds(rows, handle);
  const target = Math.round((bounds.ratingMin + bounds.ratingMax) / 2);
  const result = analyzeTarget(rows, handle, 'rating', target);
  assert.equal(result.target, target);
  assert.ok(result.rating >= target);
  if (result.rank < rows.length)
    assert.ok(analyzeTarget(rows, handle, 'rank', result.rank + 1).rating < target);
});

test('非法输入给出对应错误码', () => {
  const bounds = targetBounds(rows, handle);
  assert.throws(() => analyzeTarget(rows, handle, 'rank', 1.5), /predictionInvalidInput/);
  assert.throws(() => analyzeTarget(rows, handle, 'rank', 0), /predictionInvalidInput/);
  assert.throws(
    () => analyzeTarget(rows, handle, 'rank', rows.length + 1),
    /predictionInvalidInput/,
  );
  assert.throws(() => analyzeTarget([], handle, 'rank', 1), /predictionInvalidInput/);
  assert.throws(() => analyzeTarget(rows, handle, 'rating', 6000), /predictionInvalidInput/);
  assert.throws(
    () => analyzeTarget(rows, handle, 'rating', bounds.ratingMax + 1),
    /predictionTargetOutOfRange/,
  );
  assert.throws(() => analyzeTarget(rows, 'nobody', 'rank', 1), /predictionMissingUser/);
  assert.throws(() => targetBounds([], handle), /predictionMissingUser/);
});
