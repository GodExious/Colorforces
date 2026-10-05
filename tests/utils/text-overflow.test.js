import test from 'node:test';
import assert from 'node:assert/strict';
import { textOverflow, isTruncated } from '../../src/utils/text-overflow.js';

// 元素替身：text 是文字本身的宽度，box 是元素的宽度，edges 是内边距与边线。
function element({ text, box, edges = {} }) {
  const node = {
    getBoundingClientRect: () => ({ width: box }),
    ownerDocument: {
      createRange: () => ({
        selectNodeContents() {},
        getBoundingClientRect: () => ({ width: text }),
      }),
      defaultView: {
        getComputedStyle: () => ({
          paddingLeft: '0px',
          paddingRight: '0px',
          borderLeftWidth: '0px',
          borderRightWidth: '0px',
          ...edges,
        }),
      },
    },
  };
  return node;
}

test('文字放得下时不算被省略，包括宽度带小数、正好放满的情况', () => {
  assert.equal(isTruncated(element({ text: 80, box: 120 })), false);
  assert.equal(isTruncated(element({ text: 99.6, box: 99.6 })), false);
  // 取整后会差出 1 像素（100 与 99），实际并没有超出。
  assert.equal(isTruncated(element({ text: 99.45, box: 99.5 })), false);
});

test('文字超出容纳宽度时算被省略，并给出超出的像素数', () => {
  const long = element({ text: 140.5, box: 120 });
  assert.equal(isTruncated(long), true);
  assert.equal(textOverflow(long), 20.5);
});

test('内边距和边线不算作可以放文字的宽度', () => {
  const edges = { paddingLeft: '6px', paddingRight: '6px', borderLeftWidth: '1px' };
  assert.equal(isTruncated(element({ text: 110, box: 120 })), false);
  assert.equal(isTruncated(element({ text: 110, box: 120, edges })), true);
  assert.equal(textOverflow(element({ text: 110, box: 120, edges })), 3);
});
