import test from 'node:test';
import assert from 'node:assert/strict';
import { backdropClose } from '../../src/utils/backdrop.js';

const overlay = { name: 'overlay' };
const input = { name: 'input' };
// 事件都是在遮罩上监听到的，target 是实际落点。
const at = (target) => ({ target, currentTarget: overlay });

function setup() {
  let closed = 0;
  const handlers = backdropClose(() => closed++);
  return { handlers, count: () => closed };
}

test('在遮罩上按下并松开：关闭', () => {
  const { handlers, count } = setup();
  handlers.pointerdown(at(overlay));
  handlers.click(at(overlay));
  assert.equal(count(), 1);
});

test('在弹窗里按下、拖到遮罩上松开：不关闭', () => {
  const { handlers, count } = setup();
  handlers.pointerdown(at(input));
  // 浏览器把这次点击算在共同的上层节点（遮罩）头上。
  handlers.click(at(overlay));
  assert.equal(count(), 0);
});

test('在遮罩上按下、拖进弹窗里松开：不关闭', () => {
  const { handlers, count } = setup();
  handlers.pointerdown(at(overlay));
  handlers.click(at(input));
  assert.equal(count(), 0);
});

test('点击弹窗内部：不关闭', () => {
  const { handlers, count } = setup();
  handlers.pointerdown(at(input));
  handlers.click(at(input));
  assert.equal(count(), 0);
});

test('上一次按下的记录不带到下一次点击', () => {
  const { handlers, count } = setup();
  handlers.pointerdown(at(overlay));
  handlers.click(at(input));
  // 没有新的按下记录（例如键盘触发的点击），不应沿用上一次的。
  handlers.click(at(overlay));
  assert.equal(count(), 0);
});
