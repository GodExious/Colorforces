import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readScores,
  patchScores,
} from '../../../../../src/features/contest/rating-prediction/standings/page-scores.js';

// 只带这里用得到的几样：文字、类名、里面有没有题目链接。
const cell = (text, { who = false, problem = false, official = true } = {}) => ({
  textContent: text,
  official,
  classList: { contains: (name) => who && name === 'contestant-cell' },
  querySelector: () => (problem ? {} : null),
});
const row = (...cells) => ({ cells });
const table = (...rows) => ({ rows });
const helpers = {
  handleOf: (who) => who.textContent.trim().toLowerCase() || null,
  isOfficial: (who) => who.official,
};

test('按分数算的榜单：读总分，没有罚时一列', () => {
  const scores = readScores(
    table(
      row(cell('#'), cell('Who'), cell('='), cell('*'), cell('A', { problem: true })),
      row(cell('1906'), cell('Verve', { who: true }), cell(' 2391 '), cell(''), cell('491')),
      row(cell('1910'), cell('wydqwq', { who: true }), cell('2390'), cell('+1'), cell('494')),
    ),
    helpers,
  );
  assert.deepEqual(
    [...scores],
    [
      ['verve', { points: 2391, penalty: null }],
      ['wydqwq', { points: 2390, penalty: null }],
    ],
  );
});

test('ICPC 赛制的榜单：过题数和罚时一起读', () => {
  const scores = readScores(
    table(
      row(
        cell('#'),
        cell('Who'),
        cell('='),
        cell('Penalty'),
        cell('*'),
        cell('A', { problem: true }),
      ),
      row(cell('5'), cell('a', { who: true }), cell('6'), cell('312'), cell(''), cell('+')),
    ),
    helpers,
  );
  assert.deepEqual(scores.get('a'), { points: 6, penalty: 312 });
});

test('「=」后面直接是题目的榜单，不把题目当罚时', () => {
  const scores = readScores(
    table(
      row(cell('#'), cell('Who'), cell('='), cell('A', { problem: true })),
      row(cell('1'), cell('a', { who: true }), cell('500'), cell('500')),
    ),
    helpers,
  );
  assert.deepEqual(scores.get('a'), { points: 500, penalty: null });
});

test('不是正式参赛的行、读不出数字的行、出现两次的账号都不读', () => {
  const scores = readScores(
    table(
      row(cell('#'), cell('Who'), cell('='), cell('*')),
      row(cell(''), cell('practice', { who: true, official: false }), cell('100'), cell('')),
      row(cell('3'), cell('blank', { who: true }), cell(''), cell('')),
      row(cell('4'), cell('dup', { who: true }), cell('10'), cell('')),
      row(cell('5'), cell('dup', { who: true }), cell('20'), cell('')),
      row(cell('6'), cell('dup', { who: true }), cell('30'), cell('')),
      row(cell('Accepted'), cell('7661'), cell(''), cell('')),
    ),
    helpers,
  );
  assert.equal(scores.size, 0);
});

test('没有「=」一列的表格什么都不读', () => {
  assert.equal(readScores(table(row(cell('#'), cell('Who'))), helpers).size, 0);
  assert.equal(readScores(null, helpers).size, 0);
});

const snapshot = {
  phase: 'live',
  participants: [
    { handle: 'Verve', points: 1377, penalty: 0, rating: 1500 },
    { handle: 'arda', points: 2391, penalty: 0, rating: 1600 },
    { handle: 'elsewhere', points: 900, penalty: 0, rating: 1200 },
  ],
};

test('页面上分数不同的人换成页面的，别的人和原来的快照都不动', () => {
  const scores = new Map([
    ['verve', { points: 2391, penalty: null }],
    ['arda', { points: 2391, penalty: null }],
  ]);
  const patched = patchScores(snapshot, scores);
  assert.notEqual(patched, snapshot);
  assert.deepEqual(patched.participants[0], {
    handle: 'Verve',
    points: 2391,
    penalty: 0,
    rating: 1500,
  });
  assert.equal(patched.participants[1], snapshot.participants[1]);
  assert.equal(patched.participants[2], snapshot.participants[2]);
  assert.equal(snapshot.participants[0].points, 1377);
});

test('罚时不同也换；都一样时原样返回', () => {
  const icpc = { participants: [{ handle: 'a', points: 5, penalty: 300 }] };
  const patched = patchScores(icpc, new Map([['a', { points: 5, penalty: 280 }]]));
  assert.equal(patched.participants[0].penalty, 280);
  assert.equal(patchScores(icpc, new Map([['a', { points: 5, penalty: 300 }]])), icpc);
  assert.equal(patchScores(icpc, new Map()), icpc);
});
