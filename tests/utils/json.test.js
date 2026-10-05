import test from 'node:test';
import assert from 'node:assert/strict';
import { stringifyCompact, trimPreview } from '../../src/utils/json.js';

test('纯数字的数组各写成一行，其余照常缩进，内容不变', () => {
  const value = {
    rows: [
      [1, -2, 3.5],
      [4, 5, 6],
    ],
    names: ['a', 'b'],
    mixed: [1, 'x'],
    empty: [],
    nested: { list: [7] },
  };
  const text = stringifyCompact(value);
  assert.deepEqual(JSON.parse(text), value);
  assert.ok(text.includes('    [1, -2, 3.5],\n    [4, 5, 6]\n'));
  assert.ok(text.includes('"list": [7]'));
  assert.ok(text.includes('"names": [\n    "a",\n    "b"\n  ]'));
  assert.ok(text.includes('"mixed": [\n    1,\n    "x"\n  ]'));
  assert.ok(text.includes('"empty": []'));
});

test('带方括号的字符串和不是有限数的项不受影响', () => {
  const value = { text: '[1, 2]', odd: [1, null], top: [1, 2] };
  const text = stringifyCompact(value);
  assert.deepEqual(JSON.parse(text), value);
  assert.ok(text.includes('"text": "[1, 2]"'));
  assert.ok(text.includes('"top": [1, 2]'));
  assert.equal(stringifyCompact([1, 2]), '[1, 2]');
});

test('缩略版：不大的数据原样返回', () => {
  const value = { a: [1, 2, 3], b: { c: 'x', d: [{ e: 1 }] } };
  assert.equal(trimPreview(value, '#more', { budget: 20 }), value);
});

test('缩略版：外面两层留得多，里面留得少，省掉的地方放标记，原数据不动', () => {
  const big = {
    list: Array.from({ length: 50 }, (_, index) => ({ id: index, tags: ['a', 'b', 'c', 'd'] })),
    map: Object.fromEntries(Array.from({ length: 50 }, (_, index) => [`k${index}`, index])),
    deep: { inner: { rows: Array.from({ length: 50 }, (_, index) => ({ n: [index] })) } },
  };
  const before = JSON.stringify(big);
  const cut = trimPreview(big, '#more', { budget: 200, top: 5, nested: 2, record: 3 });
  // 第二层的数组和对象各留 5 项。
  assert.equal(cut.list.length, 6);
  assert.equal(cut.list[5], '#more');
  assert.deepEqual(Object.keys(cut.map), ['k0', 'k1', 'k2', 'k3', 'k4', '#more']);
  assert.equal(cut.map['#more'], true);
  // 更里面的留 2 项；四个字符串的小数组超过了「小记录」的项数，也按 2 项截。
  assert.deepEqual(cut.list[0], { id: 0, tags: ['a', 'b', '#more'] });
  assert.equal(cut.deep.inner.rows.length, 3);
  assert.deepEqual(cut.deep.inner.rows[1], { n: [1] });
  assert.equal(JSON.stringify(big), before);
});

test('缩略版：小记录整条留下，不拆开', () => {
  const rows = Array.from({ length: 40 }, (_, index) => [index, 1, 2, 3, 4, 5, 6]);
  const cut = trimPreview({ data: { rows } }, '#more', { budget: 100, top: 30, nested: 3 });
  assert.equal(cut.data.rows.length, 4);
  assert.deepEqual(cut.data.rows[0], [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(cut.data.rows[3], '#more');
});

test('缩略版：总数留够了，后面的全部省掉', () => {
  const groups = Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => [`g${index}`, { a: 1, b: 2, c: { d: [1, 2] } }]),
  );
  const cut = trimPreview(groups, '#more', { budget: 14 });
  // 每组用掉 7 个值（组本身、a、b、c、d、两个数），两组之后就没有了。
  assert.deepEqual(Object.keys(cut), ['g0', 'g1', '#more']);
  assert.deepEqual(cut.g1, groups.g1);
  // 用到一半时，正在写的那一层就地截断。
  const half = trimPreview(groups, '#more', { budget: 10 });
  assert.deepEqual(Object.keys(half), ['g0', 'g1', '#more']);
  assert.deepEqual(half.g1, { a: 1, b: 2, '#more': true });
});

test('缩略版：几十万项的对象只看开头', () => {
  const huge = {};
  for (let index = 0; index < 300000; index++) huge[`h${index}`] = { rating: index };
  const cut = trimPreview(huge, '#more');
  assert.equal(Object.keys(cut).length, 31);
  assert.deepEqual(cut.h29, { rating: 29 });
});
