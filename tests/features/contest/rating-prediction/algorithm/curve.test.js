import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sampleRanks,
  normalizeCurve,
  estimateRating,
  estimateRank,
} from '../../../../../src/features/contest/rating-prediction/algorithm/curve.js';
import {
  targetBounds,
  targetCurve,
  analyzeTarget,
} from '../../../../../src/features/contest/rating-prediction/algorithm/analysis.js';
import { sampleRows } from '../../../../helpers/contest-rows.js';

const points = [
  { rank: 1, rating: 1900 },
  { rank: 10, rating: 1800 },
  { rank: 100, rating: 1700 },
  { rank: 1000, rating: 1500 },
];

test('取样名次：人数不多时每个名次都取', () => {
  assert.deepEqual(sampleRanks(5), [1, 2, 3, 4, 5]);
  assert.deepEqual(sampleRanks(0), []);
  assert.deepEqual(sampleRanks(2.5), []);
});

test('取样名次：人数多时首尾必含、严格递增、不超过取样数', () => {
  const ranks = sampleRanks(12480, 48);
  assert.equal(ranks[0], 1);
  assert.equal(ranks.at(-1), 12480);
  assert.ok(ranks.length <= 48);
  for (let i = 1; i < ranks.length; i++) assert.ok(ranks[i] > ranks[i - 1]);
});

test('整理取样点：按名次排序，同名次取后写入的，回升处压平', () => {
  const curve = normalizeCurve([
    { rank: 100, rating: 1700 },
    { rank: 1, rating: 1900 },
    { rank: 10, rating: 1750 },
    { rank: 10, rating: 1800 },
    { rank: 50, rating: 1810 },
    { rank: 'x', rating: 1 },
  ]);
  assert.deepEqual(curve, [
    { rank: 1, rating: 1900 },
    { rank: 10, rating: 1800 },
    { rank: 50, rating: 1800 },
    { rank: 100, rating: 1700 },
  ]);
});

test('估算评级：取样点上取原值，之间按名次的对数插值', () => {
  assert.equal(estimateRating(points, 10), 1800);
  assert.equal(estimateRating(points, 1000), 1500);
  // 31.6 约是 10 与 100 的对数中点。
  assert.equal(estimateRating(points, 32), 1749);
  assert.equal(estimateRating(points, 1001), null);
  assert.equal(estimateRating([], 5), null);
});

test('估算名次：返回仍能达到目标的最靠后名次', () => {
  assert.equal(estimateRank(points, 1901), null);
  assert.equal(estimateRank(points, 1900), 1);
  assert.equal(estimateRank(points, 1800), 10);
  assert.equal(estimateRank(points, 1500), 1000);
  assert.equal(estimateRank(points, 1200), 1000);
  const rank = estimateRank(points, 1750);
  assert.ok(rank >= 10 && rank < 100);
  // 估出的名次换回评级，不应低于目标太多（只差插值取整）。
  assert.ok(estimateRating(points, rank) >= 1750 - 2);
});

test('估算名次与估算评级方向一致：目标越高，名次越靠前', () => {
  let previous = Infinity;
  for (let rating = 1500; rating <= 1900; rating += 25) {
    const rank = estimateRank(points, rating);
    assert.ok(rank <= previous);
    previous = rank;
  }
});

test('取样曲线：首尾与可达范围一致，每个点都是该名次的精确结果', () => {
  const rows = sampleRows();
  const handle = rows[7].handle;
  const curve = targetCurve(rows, handle, 12);
  const { points: sampled, ...bounds } = curve;
  assert.deepEqual(bounds, targetBounds(rows, handle));
  assert.equal(sampled[0].rank, 1);
  assert.equal(sampled.at(-1).rank, rows.length);
  for (const point of sampled)
    assert.equal(point.rating, analyzeTarget(rows, handle, 'rank', point.rank).rating);
  assert.throws(() => targetCurve([], handle), /predictionMissingUser/);
});

test('取样曲线上的估算与精确结果接近', () => {
  const rows = sampleRows(400);
  const handle = rows[7].handle;
  const curve = normalizeCurve(targetCurve(rows, handle, 24).points);
  for (const rank of [3, 17, 60, 150, 333]) {
    const exact = analyzeTarget(rows, handle, 'rank', rank).rating;
    assert.ok(Math.abs(estimateRating(curve, rank) - exact) <= 8, `名次 ${rank} 的估算偏差过大`);
  }
});
