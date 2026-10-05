import test from 'node:test';
import assert from 'node:assert/strict';
import {
  naturalCompare,
  sortProblemKeys,
  sortProblemIds,
  cleanProblemTitle,
  normalizeProblemName,
  extractProblemKey,
  problemLink,
} from '../../src/utils/problem.js';

test('题号按数字大小而非字符顺序比较', () => {
  assert.ok(naturalCompare('2B', '10A') < 0);
  assert.ok(naturalCompare('1831C1', '1831C2') < 0);
  assert.deepEqual(sortProblemIds(['10A', '2B', '1A', '2A']), ['1A', '2A', '2B', '10A']);
});

test('排序题号列表不改动原数组，非数组返回空数组', () => {
  const ids = ['10A', '2B'];
  sortProblemIds(ids);
  assert.deepEqual(ids, ['10A', '2B']);
  assert.deepEqual(sortProblemIds(null), []);
});

test('排序题目映射只调整键的顺序', () => {
  const sorted = sortProblemKeys({ '10A': 1500, '2B': 800 });
  assert.deepEqual(Object.keys(sorted), ['2B', '10A']);
  assert.deepEqual(sorted, { '2B': 800, '10A': 1500 });
  assert.equal(sortProblemKeys(null), null);
});

test('去除题目标题的序号前缀', () => {
  assert.equal(cleanProblemTitle('C1. Hello World'), 'Hello World');
  assert.equal(cleanProblemTitle('1831C - Copil Copac'), 'Copil Copac');
  assert.equal(cleanProblemTitle('Problem C - Foo'), 'Foo');
  assert.equal(cleanProblemTitle('  Plain Title  '), 'Plain Title');
  assert.equal(cleanProblemTitle(undefined), '');
});

test('规范化题目名称：去前缀、合并空格、转小写', () => {
  assert.equal(normalizeProblemName('1831C -  Copil   Copac '), 'copil copac');
  assert.equal(normalizeProblemName('A. Watermelon'), 'watermelon');
  assert.equal(normalizeProblemName(null), '');
});

test('从三种题目链接提取题目编号', () => {
  assert.equal(extractProblemKey('/contest/1831/problem/C1'), '1831C1');
  assert.equal(extractProblemKey('https://codeforces.com/problemset/problem/4/a'), '4A');
  assert.equal(extractProblemKey('/gym/100001/problem/B'), '100001B');
  assert.equal(extractProblemKey('/blog/entry/1'), null);
  assert.equal(extractProblemKey(''), null);
});

test('由题号拼出题目页地址，题号不成形时返回空', () => {
  assert.equal(problemLink('1831C1'), 'https://codeforces.com/contest/1831/problem/C1');
  assert.equal(problemLink('4A'), 'https://codeforces.com/contest/4/problem/A');
  assert.equal(problemLink('ABC'), null);
  assert.equal(problemLink(''), null);
  assert.equal(problemLink(null), null);
});
