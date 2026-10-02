import test from 'node:test';
import assert from 'node:assert/strict';
import FFTConv from '../../../../../src/features/contest/rating-prediction/algorithm/fft.js';

// 朴素卷积，作为 FFT 结果的对照。
function naiveConvolve(a, b) {
  const result = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) result[i + j] += a[i] * b[j];
  return result;
}

// 浮点结果逐项比较，允许 FFT 的舍入误差。
function assertClose(actual, expected, epsilon = 1e-9) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) =>
    assert.ok(
      Math.abs(value - expected[index]) < epsilon,
      `第 ${index} 项：${value} ≠ ${expected[index]}`,
    ),
  );
}

test('源码注释中的示例结果正确', () => {
  const result = new FFTConv(8).convolve([0.125, 0.25, 0.5], [4, 3, 2, 1]);
  assertClose(result, [0.5, 1.375, 3, 2.125, 1.25, 0.5]);
});

test('与朴素卷积结果一致', () => {
  const a = Array.from({ length: 37 }, (_, i) => Math.sin(i) * 3);
  const b = Array.from({ length: 53 }, (_, i) => (i % 7) - 2.5);
  assertClose(new FFTConv(a.length + b.length - 1).convolve(a, b), naiveConvolve(a, b), 1e-8);
});

test('长度向上取到 2 的幂', () => {
  assert.equal(new FFTConv(5).n, 8);
  assert.equal(new FFTConv(8).n, 8);
  assert.equal(new FFTConv(9).n, 16);
});

test('任一输入为空时返回空数组', () => {
  const conv = new FFTConv(8);
  assert.deepEqual(conv.convolve([], [1, 2]), []);
  assert.deepEqual(conv.convolve([1, 2], []), []);
});

test('结果长度超过容量时报错', () => {
  assert.throws(() => new FFTConv(4).convolve([1, 2, 3], [1, 2, 3]), /expected <= 4/);
});
