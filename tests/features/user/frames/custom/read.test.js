import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readFrame } from '../../../../../src/features/user/frames/format.js';
import {
  splitBlocks,
  cleanFrame,
  cleanMeta,
  languagesOf,
  readPaste,
  syntaxError,
  lineAt,
  revisionsOf,
  sameFrame,
  withRevisions,
} from '../../../../../src/features/user/frames/custom/read.js';

const ART_DIR = fileURLToPath(new URL('../../../../../src/assets/frames/', import.meta.url));
const svg = (body, root = 'xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 160 160"') =>
  `<svg ${root}>${body}</svg>`;
const META = '<metadata><![CDATA[{"name":{"zh":"猫","en":"Cat"},"intro":{"zh":"喵"}}]]></metadata>';

test('找出每一段 <svg>：好几段、里面套着 svg、前后的说明文字、最后一段不完整', () => {
  const text = `好的！\n\`\`\`svg\n${svg('<svg><rect/></svg>')}\n\`\`\`\n第二个：${svg('<circle/>')}\n第三个：<svg viewBox="0 0 1 1"><g>`;
  const { blocks, trimmed, empty } = splitBlocks(text);
  assert.equal(blocks.length, 3);
  assert.ok(blocks[0].code.includes('<rect/>') && blocks[0].code.endsWith('</svg></svg>'));
  assert.equal(text.slice(blocks[1].at, blocks[1].at + 4), '<svg');
  assert.ok(blocks[2].cut && !blocks[0].cut && !blocks[1].cut);
  assert.ok(trimmed && !empty);
  assert.deepEqual(splitBlocks(svg('')), {
    blocks: [{ code: svg(''), at: 0 }],
    trimmed: false,
    empty: false,
  });
  assert.equal(splitBlocks('  \n ').empty, true);
  assert.equal(splitBlocks('没有代码').blocks.length, 0);
});

test('整理：去掉脚本（成对的、自己收尾的）和事件属性，记下几处', () => {
  const result = cleanFrame(
    svg(
      `${META}<script>alert(1)</script><script href="x"/><g onclick="go()" onLoad='x'><circle r="1"/></g>`,
    ),
  );
  assert.equal(result.scripts, 4);
  assert.ok(!/script|onclick|onload/i.test(result.code));
  assert.ok(result.code.includes('<circle r="1"/>') && result.code.includes('<g>'));
});

test('整理：去掉指向外面的链接和 SMIL 动画，留下同一段里的引用和内嵌的图片', () => {
  const { code } = cleanFrame(
    svg(
      `<style>@import url(https://a.b/c.css); .x{fill:url(#g)} .y{background:url('https://a.b/i.png')}</style>` +
        `<use href="#part"/><use xlink:href="https://a.b/s.svg#p"/><image href="data:image/png;base64,AAAA"/>` +
        `<a href="https://a.b"><rect fill="url(http://a.b/#g)"/></a>` +
        `<circle><animate attributeName="r" values="1;2"/></circle><set to="1"/><animateTransform type="rotate"></animateTransform>`,
    ),
  );
  assert.ok(!code.includes('a.b'));
  assert.ok(!/@import|<animate|<set\b/i.test(code));
  assert.ok(code.includes('url(#g)') && code.includes('href="#part"'));
  assert.ok(code.includes('href="data:image/png;base64,AAAA"'));
  assert.ok(code.includes('fill="none"') && code.includes('<a>'));
});

test('整理：根元素补上命名空间，用到 xlink: 时也补上；画板不对只记下来，不改', () => {
  const plain = cleanFrame('<svg viewBox="0 0 120 120"><use xlink:href="#a"/></svg>');
  assert.match(
    plain.code,
    /^<svg xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink" xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 120 120">/,
  );
  assert.equal(plain.box, false);
  assert.equal(cleanFrame(svg('')).box, true);
  assert.equal(cleanFrame(svg('', 'viewBox="-20,-20,160,160"')).box, true);
  assert.equal(cleanFrame(svg('')).code.match(/xmlns=/g).length, 1);
});

test('整理：元数据换成标准的一段放在最前面，只留名字、介绍、作者', () => {
  const result = cleanFrame(
    svg(
      `<rect/><metadata>{"format":"x","version":9,"name":"猫","intro":["一","二"],"author":"我","extra":1}</metadata>`,
    ),
  );
  assert.deepEqual(result.meta, {
    format: 'colorforces-frame',
    version: 1,
    name: '猫',
    intro: ['一', '二'],
    author: '我',
  });
  const opened = result.code.indexOf('>') + 1;
  assert.equal(result.code.slice(opened, opened + 21), '\n<metadata><![CDATA[\n');
  assert.equal(result.code.match(/<metadata/g).length, 1);
  assert.deepEqual(readFrame(result.code).meta, result.meta);
  // 名字里写了 ]]>：转义了，不会把 CDATA 提前收尾，读回来还是原样。
  const tricky = cleanFrame(svg('<metadata><![CDATA[{"name":"a]]>b"}]]></metadata>'));
  assert.equal(readFrame(tricky.code).meta.name, 'a]]>b');
});

test('元数据：类型不对的、空的都不要；分语言的只留写对了的语言', () => {
  assert.deepEqual(cleanMeta(null), { format: 'colorforces-frame', version: 1 });
  assert.deepEqual(
    cleanMeta({ name: { zh: '猫', en: 3 }, intro: { zh: ['a', 2], en: 'b' }, author: ' ' }),
    {
      format: 'colorforces-frame',
      version: 1,
      name: { zh: '猫' },
      intro: { en: 'b' },
    },
  );
});

test('改过几次：是不小于 0 的整数才留；换成别的次数只重写元数据那一段，整理一遍不变', () => {
  assert.equal(cleanMeta({ revisions: 3 }).revisions, 3);
  for (const bad of [-1, 1.5, '2', null])
    assert.equal('revisions' in cleanMeta({ revisions: bad }), false, String(bad));
  const once = cleanFrame(svg(`${META}<rect/>`)).code;
  assert.equal(revisionsOf(once), 0);
  const next = withRevisions(once, 4);
  assert.equal(revisionsOf(next), 4);
  assert.equal(readFrame(next).svg, readFrame(once).svg);
  assert.equal(readFrame(next).meta.name.zh, '猫');
  assert.equal(cleanFrame(next).code, next);
});

test('只改了 revisions 的两段算同一个头像框的同一版；画、名字改了就不是', () => {
  const once = cleanFrame(svg(`${META}<rect/>`)).code;
  assert.ok(sameFrame(once, withRevisions(once, 9)));
  assert.ok(sameFrame(withRevisions(once, 2), withRevisions(once, 3)));
  assert.equal(sameFrame(once, cleanFrame(svg(`${META}<circle/>`)).code), false);
});

test('整理两遍和整理一遍一样；注释和 CDATA 里的文字不当标签改', () => {
  const once = cleanFrame(
    svg(
      `${META}<!-- <script>x</script> --><style><![CDATA[.a>b{fill:red}]]></style><g onclick="x"/>`,
    ),
  );
  assert.equal(cleanFrame(once.code).code, once.code);
  assert.ok(once.code.includes('<!-- <script>x</script> -->'));
  assert.ok(once.code.includes('<![CDATA[.a>b{fill:red}]]>'));
});

test('有没有动效、写了几种语言', () => {
  assert.equal(cleanFrame(svg('<style>@keyframes a{}</style>')).motion, true);
  assert.equal(cleanFrame(svg('<rect/>')).motion, false);
  assert.equal(languagesOf({ name: { zh: 'a', en: 'b' }, intro: { ja: 'c' } }), 3);
  assert.equal(languagesOf({ name: '猫', intro: ['一'] }), 1);
  assert.equal(languagesOf(null), 0);
});

test('读一整段：每段整理好，带着在原文里的位置和原来的代码；不完整的一段只有位置', () => {
  const text = `前面\n${svg(`${META}<rect/>`)}\n<svg>`;
  const { blocks, trimmed } = readPaste(text);
  assert.ok(trimmed);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].meta.name.en, 'Cat');
  assert.equal(blocks[0].raw, svg(`${META}<rect/>`));
  assert.equal(lineAt(text, blocks[0].at), 2);
  assert.deepEqual(blocks[1], { cut: true, at: text.lastIndexOf('<svg') });
  assert.equal(readPaste(undefined).empty, true);
});

test('不在浏览器里时当作读得出来', () => {
  assert.equal(syntaxError('<svg'), null);
});

test('内置的头像框整理之后画和元数据都不变', () => {
  for (const kind of readdirSync(ART_DIR))
    for (const file of readdirSync(ART_DIR + kind).filter((name) => name.endsWith('.svg'))) {
      const code = readFileSync(`${ART_DIR}${kind}/${file}`, 'utf8');
      const before = readFrame(code);
      const after = readFrame(cleanFrame(code).code);
      const squash = (text) => text.replace(/\s+/g, ' ').trim();
      assert.deepEqual(after.meta, before.meta, file);
      assert.equal(squash(after.svg), squash(before.svg), file);
      assert.equal(cleanFrame(code).box, true, file);
    }
});
