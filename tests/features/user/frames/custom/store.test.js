import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readStore,
  catalogOf,
  artOf,
  newFrameId,
  addFrames,
  updateFrame,
  removeFrames,
  markSeen,
  exportCode,
  nameOf,
} from '../../../../../src/features/user/frames/custom/store.js';
import {
  cleanFrame,
  revisionsOf,
  withRevisions,
} from '../../../../../src/features/user/frames/custom/read.js';

const code = (name) =>
  `<svg xmlns="http://www.w3.org/2000/svg"><metadata><![CDATA[{"name":${JSON.stringify(name)}}]]></metadata></svg>`;
// 按顺序给出的「随机数」，编号可以预先知道。
const sequence =
  (...values) =>
  () =>
    values.shift() ?? 0;

test('读：没有代码的目录项不要，目录里没有的代码补一条排在最后，读不懂的丢掉', () => {
  const store = readStore(
    {
      order: ['b', 'gone', 'a', 3],
      frames: {
        a: { added: 5, updated: 6, mark: 'edit', name: 'A' },
        b: { mark: 'odd' },
        gone: {},
      },
    },
    { a: code('甲'), b: code('乙'), c: code('丙'), d: 7 },
  );
  assert.deepEqual(store.order, ['b', 'a', 'c']);
  assert.deepEqual(store.frames.a, { name: 'A', added: 5, updated: 6, mark: 'edit' });
  assert.deepEqual(store.frames.b, { name: '乙', added: 0, updated: 0, mark: '' });
  assert.equal(store.frames.c.name, '丙');
  assert.deepEqual(Object.keys(store.art), ['b', 'a', 'c']);
  assert.deepEqual(readStore(null, null), { order: [], frames: {}, art: {} });
  assert.deepEqual(readStore('坏的', []), { order: [], frames: {}, art: {} });
});

test('写回去的两份：目录和代码', () => {
  const store = readStore({ order: ['a'], frames: {} }, { a: code('甲') });
  assert.deepEqual(catalogOf(store), {
    order: ['a'],
    frames: { a: { name: '甲', added: 0, updated: 0, mark: '' } },
  });
  assert.deepEqual(artOf(store), { a: code('甲') });
});

test('新编号：custom- 开头，和已有的不重', () => {
  const now = 36 ** 3;
  const first = newFrameId({}, now, sequence(0));
  assert.equal(first, 'custom-1000-0000');
  assert.equal(newFrameId({ [first]: 1 }, now, sequence(0, 0.5)), 'custom-1000-i000');
});

test('加进来：排在最后，挂上「新」，名字取自代码；返回编号', () => {
  const store = readStore(null, null);
  const ids = addFrames(store, [code('甲'), code({ zh: '乙' })], 100, sequence(0, 0.5));
  assert.equal(ids.length, 2);
  assert.deepEqual(store.order, ids);
  assert.deepEqual(store.frames[ids[0]], { name: '甲', added: 100, updated: 100, mark: 'new' });
  assert.deepEqual(store.frames[ids[1]].name, { zh: '乙' });
  assert.equal(store.art[ids[1]], code({ zh: '乙' }));
});

test('改：换代码、名字、时间，挂上「改」；还没点开过的新头像框仍是「新」；没有这个头像框时返回 false', () => {
  const store = readStore(
    { order: ['a', 'b'], frames: { a: { added: 1, mark: '' }, b: { added: 1, mark: 'new' } } },
    { a: code('甲'), b: code('乙') },
  );
  assert.equal(updateFrame(store, 'a', code('甲二'), 9), true);
  assert.deepEqual(store.frames.a, { name: '甲二', added: 1, updated: 9, mark: 'edit' });
  updateFrame(store, 'b', code('乙二'), 9);
  assert.equal(store.frames.b.mark, 'new');
  assert.equal(updateFrame(store, 'x', code('丙')), false);
});

test('改：改过几次由插件记，原来的加 1，不管新代码里写的是多少', () => {
  const store = readStore({ order: ['a'], frames: {} }, { a: cleanFrame(code('甲')).code });
  updateFrame(store, 'a', withRevisions(cleanFrame(code('甲二')).code, 9));
  assert.equal(revisionsOf(store.art.a), 1);
  updateFrame(store, 'a', cleanFrame(code('甲三')).code);
  assert.equal(revisionsOf(store.art.a), 2);
  assert.equal(nameOf(store.art.a), '甲三');
});

test('删掉、点开过、导出', () => {
  const store = readStore(
    { order: ['a', 'b', 'c'], frames: { a: { mark: 'new' } } },
    { a: code('甲'), b: code('乙'), c: code('丙') },
  );
  assert.equal(markSeen(store, 'a'), true);
  assert.equal(store.frames.a.mark, '');
  assert.equal(markSeen(store, 'a'), false);
  assert.equal(markSeen(store, 'x'), false);
  assert.equal(exportCode(store, ['c', 'a']), `${code('甲')}\n\n${code('丙')}`);
  assert.equal(removeFrames(store, ['b', 'x']), 1);
  assert.deepEqual(store.order, ['a', 'c']);
  assert.ok(!('b' in store.art) && !('b' in store.frames));
});

test('代码里没写名字时是 null', () => {
  assert.equal(nameOf('<svg/>'), null);
  assert.equal(nameOf(code('猫')), '猫');
});
