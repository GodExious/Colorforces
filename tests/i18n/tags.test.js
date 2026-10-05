import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

// 原站题库目前使用的全部标签（接口里的写法）。
const SITE_TAGS = [
  '2-sat',
  'binary search',
  'bitmasks',
  'brute force',
  'chinese remainder theorem',
  'combinatorics',
  'communication',
  'constructive algorithms',
  'data structures',
  'dfs and similar',
  'divide and conquer',
  'dp',
  'dsu',
  'expression parsing',
  'fft',
  'flows',
  'games',
  'geometry',
  'graph matchings',
  'graphs',
  'greedy',
  'hashing',
  'implementation',
  'interactive',
  'math',
  'matrices',
  'meet-in-the-middle',
  'number theory',
  'probabilities',
  'schedules',
  'shortest paths',
  'sortings',
  'string suffix structures',
  'strings',
  'ternary search',
  'trees',
  'two pointers',
  '*special',
  '*broken',
];

// 读出 tags 目录下每种语言的译名表；以后加了新语言，这里的检查自动覆盖到。
const directory = fileURLToPath(new URL('../../src/i18n/tags/', import.meta.url));
const tables = await Promise.all(
  readdirSync(directory)
    .filter((file) => file.endsWith('.js'))
    .map(async (file) => [
      file.slice(0, -3),
      (await import(pathToFileURL(join(directory, file)).href)).default,
    ]),
);

test('至少有中文译名表', () => {
  assert.ok(tables.some(([lang]) => lang === 'zh'));
});

for (const [lang, names] of tables) {
  test(`${lang}：原站现有的标签都有译名`, () => {
    assert.deepEqual(
      SITE_TAGS.filter((tag) => !names[tag]),
      [],
    );
  });

  test(`${lang}：没有多余的键，译名非空且互不重复`, () => {
    assert.deepEqual(
      Object.keys(names).filter((tag) => !SITE_TAGS.includes(tag)),
      [],
    );
    const values = Object.values(names);
    values.forEach((name) => assert.ok(typeof name === 'string' && name.trim() === name && name));
    assert.equal(new Set(values).size, values.length);
  });
}
