import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseReleaseNotes, splitInline } from '../../../src/features/general/release-notes.js';
import entries from '../../../src/ui/pages/changelog/data.js';
import zh from '../../../src/ui/pages/changelog/locales/zh.js';
import en from '../../../src/ui/pages/changelog/locales/en.js';

const SAMPLE = `<h1 align="center">更新日志</h1>

本项目的所有重要更改都将记录在此文件中。

---

### v1.9.0
\`2026-10-07 12:00 UTC+8\`

**新增**
1. 第一条。
2. 第二条，带 \`代码\`。

**修复**
1. 修好了一处。

---

### v1.8.0
\`2026-10-06 00:22 UTC+8\`

**公告**
1. 一条公告。

**别的**
1. 认不出的分类。

**优化**
`;

test('按版本、分类、条目读出更新日志文档', () => {
  assert.deepEqual(parseReleaseNotes(SAMPLE), [
    {
      version: '1.9.0',
      date: '2026-10-07',
      sections: [
        { type: 'added', title: '新增', items: ['第一条。', '第二条，带 `代码`。'] },
        { type: 'fixed', title: '修复', items: ['修好了一处。'] },
      ],
    },
    {
      version: '1.8.0',
      date: '2026-10-06',
      sections: [
        { type: 'announcement', title: '公告', items: ['一条公告。'] },
        // 认不出的分类照样列出，只是没有类别；没有条目的分类不列。
        { type: '', title: '别的', items: ['认不出的分类。'] },
      ],
    },
  ]);
});

test('英文文档的分类、换行符和版本号里的空格都认得', () => {
  const notes = parseReleaseNotes('### v 2.0\r\n\r\n**Optimized**\r\n1. Faster.\r\n- Smaller.\r\n');
  assert.deepEqual(notes, [
    {
      // 没写发布时间的版本，日期是空的。
      version: '2.0',
      date: '',
      sections: [{ type: 'optimized', title: 'Optimized', items: ['Faster.', 'Smaller.'] }],
    },
  ]);
});

test('不是更新日志的内容读不出版本', () => {
  assert.deepEqual(parseReleaseNotes(''), []);
  assert.deepEqual(parseReleaseNotes(null), []);
  assert.deepEqual(parseReleaseNotes('<html><body>404: Not Found</body></html>'), []);
  // 版本下面一条内容都没有时不列出。
  assert.deepEqual(parseReleaseNotes('### v1.0.0\n`2026-01-01`\n'), []);
});

test('一条内容拆成文字、代码和链接', () => {
  assert.deepEqual(splitInline('普通文字'), [{ text: '普通文字' }]);
  assert.deepEqual(splitInline('按 `Shift+M` 切换，见 [说明](https://example.com/a) 。'), [
    { text: '按 ' },
    { code: 'Shift+M' },
    { text: ' 切换，见 ' },
    { text: '说明', href: 'https://example.com/a' },
    { text: ' 。' },
  ]);
  assert.deepEqual(splitInline(''), []);
});

test('网页代码和不是网址的链接都留作文字', () => {
  const script = '<img src=x onerror=alert(1)>';
  assert.deepEqual(splitInline(script), [{ text: script }]);
  const link = '[点我](javascript:alert(1))';
  assert.deepEqual(splitInline(link), [{ text: link }]);
});

// 更新提示读的是仓库里的两份文档，菜单里的更新日志读的是语言文件；两边的内容应当一致。
for (const [file, messages] of [
  ['CHANGELOG_zh.md', zh],
  ['CHANGELOG.md', en],
]) {
  test(`docs/${file} 里最新版本的内容与菜单里的更新日志一致`, () => {
    const text = readFileSync(new URL(`../../../docs/${file}`, import.meta.url), 'utf8');
    const [latest] = parseReleaseNotes(text);
    const [entry] = entries;
    assert.equal('v ' + latest.version, entry.version);
    assert.deepEqual(
      latest.sections.map(({ type, items }) => ({ type, items })),
      entry.sections.map(({ type, contentKey }) => ({ type, items: messages[contentKey] })),
    );
  });
}
