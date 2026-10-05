import test from 'node:test';
import assert from 'node:assert/strict';
import {
  packSubmissions,
  isDataset,
  ROW,
  DATASET_VERSION,
} from '../../../../src/features/user/analytics/pack.js';
import { submission } from '../../../helpers/user-submissions.js';

test('按时间从早到晚排列，同一秒按提交编号排', () => {
  const dataset = packSubmissions('alice', [
    submission({ id: 3, time: 200, index: 'C' }),
    submission({ id: 2, time: 100, index: 'B' }),
    submission({ id: 1, time: 100, index: 'A' }),
  ]);
  assert.deepEqual(
    dataset.rows.map((row) => dataset.problems[row[ROW.problem]]),
    ['1000A', '1000B', '1000C'],
  );
});

test('训练营和缺少比赛编号的提交不计入', () => {
  const dataset = packSubmissions('alice', [
    submission({ id: 1, contestId: 104000, index: 'A' }),
    submission({ id: 2, contestId: null, index: 'A' }),
    submission({ id: 3, contestId: 99999, index: 'A' }),
  ]);
  assert.deepEqual(dataset.problems, ['99999A']);
  assert.equal(dataset.rows.length, 1);
});

test('题号、语言、判题结果、参赛类型改存序号，可以还原', () => {
  const dataset = packSubmissions('alice', [
    submission({ id: 1, index: 'a', verdict: 'WRONG_ANSWER', lang: 'C++20', type: 'CONTESTANT' }),
    submission({ id: 2, index: 'A', verdict: 'OK', lang: 'C++20', type: 'PRACTICE' }),
  ]);
  assert.deepEqual(dataset.problems, ['1000A']);
  assert.deepEqual(dataset.verdicts, ['WRONG_ANSWER', 'OK']);
  assert.deepEqual(dataset.langs, ['C++20']);
  assert.deepEqual(dataset.types, ['CONTESTANT', 'PRACTICE']);
  assert.deepEqual(
    dataset.rows.map((row) => dataset.verdicts[row[ROW.verdict]]),
    ['WRONG_ANSWER', 'OK'],
  );
});

test('练习提交没有赛中时间，记为 -1；队伍提交打上标记', () => {
  const dataset = packSubmissions('alice', [
    submission({ id: 1, relative: 2147483647 }),
    submission({ id: 2, relative: 600, members: ['alice', 'bob'] }),
  ]);
  assert.deepEqual(
    dataset.rows.map((row) => [row[ROW.relative], row[ROW.team]]),
    [
      [-1, 0],
      [600, 1],
    ],
  );
});

test('只有本地题库查不到的题才另存名称、难度分和标签', () => {
  const dataset = packSubmissions(
    'alice',
    [
      submission({ id: 1, index: 'A', name: 'Known', rating: 800, tags: ['math'] }),
      submission({ id: 2, index: 'B', name: 'Fresh', rating: 1500, tags: ['dp'] }),
      submission({ id: 3, index: 'C', name: 'No rating yet' }),
    ],
    { known: (key) => key === '1000A' },
  );
  assert.deepEqual(dataset.extra, {
    '1000B': ['Fresh', 1500, ['dp']],
    '1000C': ['No rating yet', 0, []],
  });
});

test('数据集带版本、账号和刷新时间，结构检查能识别残缺数据', () => {
  const dataset = packSubmissions('alice', [submission({ id: 1 })], { fetchedAt: 123 });
  assert.equal(dataset.version, DATASET_VERSION);
  assert.equal(dataset.handle, 'alice');
  assert.equal(dataset.fetchedAt, 123);
  assert.equal(isDataset(dataset), true);
  assert.equal(isDataset(JSON.parse(JSON.stringify(dataset))), true);
  assert.equal(isDataset(null), false);
  assert.equal(isDataset({ ...dataset, version: 0 }), false);
  assert.equal(isDataset({ ...dataset, rows: undefined }), false);
});
