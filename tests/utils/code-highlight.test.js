import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { highlightSvg, splitLines, visibleRange } from '../../src/utils/code-highlight.js';

const ART_DIR = fileURLToPath(new URL('../../src/assets/frames/', import.meta.url));
// 去掉标签、还原转义：必须和原文一字不差（代码框靠这一点让上了色的那层和输入框里的字对齐）。
const plain = (html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
const samples = [
  'a < b > c & "x" <svg><style>.a>b{}</style></svg>',
  '好的！\n```svg\n<svg viewBox="0 0 1 1">\n<!-- 注释\n两行 -->\n<style><![CDATA[\n@keyframes a { 0% { opacity: 1 } }\n]]></style>\n</svg>\n```\n',
  '<svg><metadata><![CDATA[\n{ "name": { "zh": "猫" },\n "version": 1 }\n]]></metadata></svg>',
  '',
  '\n\n',
];
for (const kind of readdirSync(ART_DIR))
  for (const file of readdirSync(ART_DIR + kind))
    samples.push(readFileSync(`${ART_DIR}${kind}/${file}`, 'utf8'));

test('上色前后的文字一字不差', () => {
  for (const text of samples) assert.equal(plain(highlightSvg(text)), text);
});

test('上了色的各部分', () => {
  const html = highlightSvg('<rect fill="red"/><style>.a{opacity:1}</style>');
  assert.ok(html.includes('<span class="cf-code-tag">rect</span>'));
  assert.ok(html.includes('<span class="cf-code-attr">fill</span>'));
  assert.ok(html.includes('<span class="cf-code-string">&quot;red&quot;</span>'));
  assert.ok(html.includes('<span class="cf-code-selector">.a</span>'));
  assert.ok(html.includes('<span class="cf-code-property">opacity</span>'));
  assert.ok(
    highlightSvg('<metadata><![CDATA[{"a":1}]]></metadata>').includes(
      '<span class="cf-code-key">&quot;a&quot;</span>',
    ),
  );
});

test('按行切开：行数和原文一样，每行去掉标签后接起来还是原文，跨行的那一段每行各自关好', () => {
  for (const text of samples) {
    const lines = splitLines(highlightSvg(text));
    assert.equal(lines.length, text.split('\n').length);
    assert.equal(lines.map(plain).join('\n'), text);
    for (const line of lines)
      assert.equal((line.match(/<span/g) || []).length, (line.match(/<\/span>/g) || []).length);
  }
});

test('看得见的行：按滚动的位置算，上下多留几行，不出范围', () => {
  assert.deepEqual(
    visibleRange({ scrollTop: 0, height: 200, total: 5000, line: 17, padding: 8 }),
    [0, 24],
  );
  const [first, last] = visibleRange({
    scrollTop: 40000,
    height: 200,
    total: 5000,
    line: 17,
    padding: 8,
  });
  assert.ok(first > 2300 && last - first < 40);
  assert.deepEqual(visibleRange({ scrollTop: 0, height: 200, total: 3, line: 17 }), [0, 3]);
  assert.deepEqual(
    visibleRange({ scrollTop: 900, height: 200, total: 3, line: 17, spare: 0 }),
    [52, 52],
  );
});
