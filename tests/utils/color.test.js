import test from 'node:test';
import assert from 'node:assert/strict';
import { mixHex } from '../../src/utils/color.js';

test('mixHex 在份额为 0 和 1 时分别得到两端的颜色', () => {
  assert.equal(mixHex('#a8e67a', '#389e0d', 0), '#a8e67a');
  assert.equal(mixHex('#a8e67a', '#389e0d', 1), '#389e0d');
});

test('mixHex 按份额在两种颜色之间取色', () => {
  assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(mixHex('#a8e67a', '#389e0d', 0.5), '#70c244');
});

test('mixHex 的份额超出范围时按两端处理，个位数的分量补零', () => {
  assert.equal(mixHex('#000000', '#ffffff', 2), '#ffffff');
  assert.equal(mixHex('#000000', '#0a0a0a', -1), '#000000');
  assert.equal(mixHex('#000000', '#101010', 0.5), '#080808');
});
