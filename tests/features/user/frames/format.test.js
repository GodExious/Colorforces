import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  FRAME_FORMAT,
  readFrame,
  frameText,
  frameDocument,
} from '../../../../src/features/user/frames/format.js';

const ART_DIR = fileURLToPath(new URL('../../../../src/assets/frames/', import.meta.url));
const sample = (metadata) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 160 160">${metadata}<circle cx="60" cy="60" r="44"/></svg>`;

test('读出元数据：CDATA 里的 JSON，或者转义过的文字；去掉元数据后剩下画', () => {
  const plain = readFrame(
    sample('<metadata><![CDATA[{"name":{"zh":"猫","en":"Cat"},"intro":"<喵>"}]]></metadata>'),
  );
  assert.deepEqual(plain.meta, { name: { zh: '猫', en: 'Cat' }, intro: '<喵>' });
  assert.ok(!plain.svg.includes('metadata') && plain.svg.includes('<circle'));
  const escaped = readFrame(sample('<metadata>{"intro":"&lt;a &amp; b&gt;"}</metadata>'));
  assert.equal(escaped.meta.intro, '<a & b>');
});

test('元数据没写或写坏了：meta 是 null，画照样留着', () => {
  assert.equal(readFrame(sample('')).meta, null);
  const broken = readFrame(sample('<metadata><![CDATA[{"name":]]></metadata>'));
  assert.equal(broken.meta, null);
  assert.ok(broken.svg.includes('<circle'));
});

test('按语言取名字和介绍：这门语言 → 英文 → 中文 → 写着的第一种 → 编号', () => {
  const meta = {
    name: { zh: '猫', en: 'Cat', ja: 'ネコ' },
    intro: { zh: ['一', '二'], ja: 'にゃ' },
  };
  assert.deepEqual(frameText(meta, 'ja', 'cat'), ['ネコ', 'にゃ']);
  assert.deepEqual(frameText(meta, 'en', 'cat'), ['Cat', ['一', '二']]);
  assert.deepEqual(frameText({ name: { ja: 'ネコ' } }, 'zh', 'cat'), ['ネコ', '']);
  assert.deepEqual(frameText({ name: '猫猫' }, 'en', 'cat'), ['猫猫', '']);
  assert.deepEqual(frameText(null, 'zh', 'cat'), ['cat', '']);
});

test('做成图片：最外层 <svg> 里最前面加一段样式，不动的那张停掉所有动画', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><style>.a{animation:x 1s}</style></svg>';
  const moving = frameDocument(svg, true, '@font-face{}');
  assert.equal(
    moving,
    '<svg xmlns="http://www.w3.org/2000/svg"><style>@font-face{}</style><style>.a{animation:x 1s}</style></svg>',
  );
  assert.ok(frameDocument(svg, false).includes('<style>*{animation:none!important}</style>'));
});

// 每个内置的头像框都是一段完整的 SVG：格式对、中英两种名字和介绍都有、分段的段数一样、没有脚本和外部链接。
test('内置的头像框各自带着名字、介绍和动效', () => {
  let count = 0;
  for (const kind of readdirSync(ART_DIR))
    for (const file of readdirSync(ART_DIR + kind).filter((item) => item.endsWith('.svg'))) {
      const id = `${kind}/${file}`;
      const code = readFileSync(ART_DIR + kind + '/' + file, 'utf8');
      assert.match(
        code,
        /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="-20 -20 160 160">/,
        id,
      );
      assert.doesNotMatch(code, /<script|\son[a-z]+=|href=|xlink:/i, `${id} 里有脚本或外部链接`);
      const { meta } = readFrame(code);
      assert.ok(meta, `${id} 的元数据读不出来`);
      assert.equal(meta.format, FRAME_FORMAT, id);
      assert.equal(meta.version, 1, id);
      const counts = new Set();
      for (const lang of ['zh', 'en']) {
        assert.ok(meta.name?.[lang]?.trim(), `${id} 没有 ${lang} 名字`);
        const paragraphs = [].concat(meta.intro?.[lang] ?? []);
        assert.ok(
          paragraphs.length && paragraphs.every((text) => typeof text === 'string' && text.trim()),
          `${id} 没有 ${lang} 介绍`,
        );
        counts.add(paragraphs.length);
      }
      assert.equal(counts.size, 1, `${id} 的介绍各语言段数不一样`);
      count += 1;
    }
  assert.ok(count > 0);
});
