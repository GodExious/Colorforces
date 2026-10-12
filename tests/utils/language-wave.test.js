import test from 'node:test';
import assert from 'node:assert/strict';
import { waveDelays, moveTiming } from '../../src/utils/language-wave.js';

test('波浪里各项依次晚一点开始，项多了间隔变短，从头到尾不超过上限', () => {
  assert.deepEqual(waveDelays(0), []);
  assert.deepEqual(waveDelays(1), [0]);
  // 项少时按固定的间隔。
  assert.deepEqual(waveDelays(4, 24, 220), [0, 24, 48, 72]);
  // 项多时把上限平分：最后一项正好晚上限那么久。
  const many = waveDelays(45, 24, 220);
  assert.equal(many.length, 45);
  assert.equal(many[0], 0);
  assert.ok(Math.abs(many.at(-1) - 220) < 1e-9);
  assert.ok(many.every((delay, index) => index === 0 || delay > many[index - 1]));
});

test('大小过渡：高度变得不多时照旧；变得多了换成平的缓动、时间随距离加长到上限；变高的提前到波浪开头', () => {
  const short = moveTiming(0, 120);
  assert.equal(short.delay, 120);
  assert.deepEqual(moveTiming(18, 120), short);
  assert.deepEqual(moveTiming(-24, 120), short);
  // 变矮：还是等轮到它，时间更长、缓动不同。
  const shrink = moveTiming(-35, 220);
  assert.equal(shrink.delay, 220);
  assert.ok(shrink.duration > short.duration);
  assert.notEqual(shrink.easing, short.easing);
  assert.ok(moveTiming(-160, 220).duration > shrink.duration);
  assert.equal(moveTiming(-5000).duration, moveTiming(-50000).duration);
  assert.ok(moveTiming(-5000).duration <= 700);
  // 变高：从头开始，至少持续到轮到它之后一段时间。
  const grow = moveTiming(35, 220);
  assert.equal(grow.delay, 0);
  assert.equal(grow.easing, shrink.easing);
  assert.ok(grow.duration >= 220 + 150);
  assert.equal(moveTiming(35, 0).duration, shrink.duration);
});
