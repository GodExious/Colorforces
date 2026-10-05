import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readStore,
  adoptDatasets,
  pruneEntries,
  previewStore,
  userId,
} from '../../../../src/features/user/analytics/store.js';
import { packSubmissions } from '../../../../src/features/user/analytics/pack.js';
import { submission } from '../../../helpers/user-submissions.js';

// 一个账号的数据集；count 是提交数，每条提交各是一道题。
const datasetOf = (handle, fetchedAt, count = 1) =>
  packSubmissions(
    handle,
    Array.from({ length: count }, (_, index) => submission({ contestId: 1000 + index })),
    { fetchedAt },
  );
const storeOf = (...datasets) => ({
  users: Object.fromEntries(datasets.map((dataset) => [userId(dataset.handle), dataset])),
  ratings: {},
});

test('读到的内容不是约定的结构时当作空的，残缺的数据集被丢掉', () => {
  const empty = { users: {}, ratings: {} };
  assert.deepEqual(readStore(null), empty);
  assert.deepEqual(readStore('text'), empty);
  assert.deepEqual(readStore({ users: [], ratings: 5 }), empty);
  const good = datasetOf('Alice', 5);
  const history = {
    handle: 'Alice',
    fetchedAt: 7,
    rows: [[1, 2, 3, 0, 1500]],
    contests: ['Round'],
  };
  const store = readStore({
    users: { alice: good, bob: { handle: 'bob' }, carol: null },
    ratings: { alice: history, bob: { handle: 'bob', fetchedAt: 1 } },
  });
  assert.deepEqual(Object.keys(store.users), ['alice']);
  assert.equal(store.users.alice, good);
  assert.deepEqual(Object.keys(store.ratings), ['alice']);
  assert.equal(store.ratings.alice, history);
});

test('旧数据并进来：残缺的丢掉，同一个账号留刷新得晚的那份', () => {
  const kept = datasetOf('Alice', 9);
  const store = storeOf(kept, datasetOf('bob', 3));
  const bob = datasetOf('Bob', 7);
  const carol = datasetOf('carol', 1);
  const adopted = adoptDatasets(store, [datasetOf('alice', 5), bob, carol, null, { handle: 'x' }]);
  assert.equal(adopted, 2);
  assert.deepEqual(Object.keys(store.users).sort(), ['alice', 'bob', 'carol']);
  assert.equal(store.users.alice, kept);
  assert.equal(store.users.bob, bob);
  assert.equal(store.users.carol, carol);
  assert.equal(adoptDatasets(store, [bob]), 0);
});

test('超出数量时去掉刷新得最早的账号，自己的账号不占名额也不会被去掉', () => {
  const store = storeOf(
    datasetOf('me', 1),
    datasetOf('old', 2),
    datasetOf('mid', 3),
    datasetOf('new', 4),
  );
  assert.deepEqual(pruneEntries(store.users, { own: 'Me', limit: 2 }), ['old']);
  assert.deepEqual(Object.keys(store.users).sort(), ['me', 'mid', 'new']);
  assert.deepEqual(pruneEntries(store.users, { own: 'Me', limit: 2 }), []);
});

test('要保留的账号占一个名额；数量为零时只留自己和要保留的', () => {
  const store = storeOf(datasetOf('old', 1), datasetOf('mid', 2), datasetOf('new', 3));
  assert.deepEqual(pruneEntries(store.users, { keep: ['OLD'], limit: 2 }), ['mid']);
  assert.deepEqual(Object.keys(store.users).sort(), ['new', 'old']);
  assert.deepEqual(pruneEntries(store.users, { keep: ['old'], own: 'nobody', limit: 0 }), ['new']);
  assert.deepEqual(Object.keys(store.users), ['old']);
});

test('缩略版：账号从近到远只列前几个，各张表只留开头几项，原数据不动', () => {
  const store = storeOf(datasetOf('early', 1, 2), datasetOf('late', 9, 8), datasetOf('mid', 5, 1));
  const before = JSON.stringify(store);
  const preview = previewStore(store, '#more', { users: 2, entries: 3 });
  assert.deepEqual(Object.keys(preview.users), ['late', 'mid', '#more']);
  const late = preview.users.late;
  assert.equal(late.rows.length, 4);
  assert.equal(late.rows[3], '#more');
  assert.deepEqual(late.rows[0], store.users.late.rows[0]);
  assert.equal(late.problems.length, 4);
  // 题库里查不到的题各附带一份信息，是个对象：留前几项，再加一个标记键。
  assert.equal(Object.keys(late.extra).length, 4);
  assert.equal(late.extra['#more'], true);
  assert.equal(late.handle, 'late');
  assert.equal(late.fetchedAt, 9);
  // 不超过数量的原样列出，没有标记。
  assert.deepEqual(preview.users.mid.rows, store.users.mid.rows);
  assert.equal(JSON.stringify(store), before);
  assert.deepEqual(Object.keys(previewStore(store, '#more').users), ['late', 'mid', 'early']);
});
