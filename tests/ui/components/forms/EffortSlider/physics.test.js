import test from 'node:test';
import assert from 'node:assert/strict';
import {
  magnet,
  springStep,
  settled,
  keepSamples,
  releaseVelocity,
} from '../../../../../src/ui/components/forms/EffortSlider/physics.js';

test('吸附：离某一档不到半档时往那一档拉，越近拉得越紧；正好在档上、正好在两档中间的不动', () => {
  assert.equal(magnet(2), 2);
  assert.equal(magnet(2.5), 2.5);
  for (const value of [1.2, 1.4, 2.7, 3.9]) {
    const nearest = Math.round(value);
    assert.ok(Math.abs(magnet(value) - nearest) < Math.abs(value - nearest), String(value));
    assert.equal(Math.round(magnet(value)), nearest, String(value));
  }
  // 越近拉得越多（按拉掉的比例算）。
  const share = (value) => 1 - Math.abs(magnet(value) - 2) / Math.abs(value - 2);
  assert.ok(share(2.1) > share(2.4));
});

test('弹簧：从别处弹到目标档，最后停在目标上；甩得快会冲过头一点再回来', () => {
  const run = (position, velocity, target) => {
    let state = { position, velocity };
    let farthest = position;
    for (let i = 0; i < 400 && !settled(state.position, state.velocity, target); i += 1) {
      state = springStep(state.position, state.velocity, target, 1 / 60);
      farthest = Math.max(farthest, state.position);
    }
    return { ...state, farthest };
  };
  const calm = run(0, 0, 3);
  assert.ok(Math.abs(calm.position - 3) < 0.001 && Math.abs(calm.velocity) < 0.01);
  const flung = run(2.6, 8, 3);
  assert.ok(flung.farthest > 3, '甩出去的会冲过头');
  assert.ok(Math.abs(flung.position - 3) < 0.001);
});

test('甩出去的速度：只看最近 90 毫秒，最多 8 档每秒；不够两个点时是 0', () => {
  let samples = [];
  samples = keepSamples(samples, 0, 0);
  samples = keepSamples(samples, 50, 0.5);
  samples = keepSamples(samples, 100, 1);
  assert.deepEqual(
    samples.map((sample) => sample.time),
    [50, 100],
  );
  assert.equal(releaseVelocity(samples), 8);
  assert.equal(releaseVelocity([{ time: 0, value: 1 }]), 0);
  assert.ok(
    Math.abs(
      releaseVelocity([
        { time: 0, value: 1 },
        { time: 80, value: 1.2 },
      ]) - 2.5,
    ) < 1e-9,
  );
});
