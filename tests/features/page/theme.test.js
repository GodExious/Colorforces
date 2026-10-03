import test from 'node:test';
import assert from 'node:assert/strict';
import { isDarkTheme } from '../../../src/features/page/theme.js';

// 顶替页面：记下整页查找的次数，页面背景色可以中途改。
let scans = 0;
let background = 'rgb(255, 255, 255)';
globalThis.document = {
  querySelector() {
    scans++;
    return null;
  },
  documentElement: { getAttribute: () => null },
  body: { classList: { contains: () => false } },
};
globalThis.window = { getComputedStyle: () => ({ backgroundColor: background }) };

test('同一段同步代码里反复询问，只判断一次', () => {
  scans = 0;
  for (let index = 0; index < 1000; index++) assert.equal(isDarkTheme(), false);
  // 一次判断要在整页里找两次节点。
  assert.equal(scans, 2);
});

test('这段代码跑完后结果作废，下一次重新判断', async () => {
  assert.equal(isDarkTheme(), false);
  await Promise.resolve();
  background = 'rgb(20, 20, 20)';
  scans = 0;
  assert.equal(isDarkTheme(), true);
  assert.equal(scans, 2);
});
