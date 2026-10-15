import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 每个有画稿的头像框，在每种语言的介绍文件里都要有名字和介绍；介绍文件里也不能有没有画稿的头像框。
// 介绍是一段文字，或分段的数组；分段的各语言段数一样。
const ART_DIR = fileURLToPath(new URL('../../../../src/assets/frames/', import.meta.url));
const INTRO_DIR = fileURLToPath(
  new URL('../../../../src/features/user/frames/intro/', import.meta.url),
);
const known = new Set();
for (const kind of readdirSync(ART_DIR))
  for (const name of readdirSync(ART_DIR + kind).filter((item) => item.endsWith('.svg')))
    known.add(name.replace(/\.svg$/, ''));

test('每个头像框在每种语言里都有名字和介绍，介绍里没有多出来的头像框', async () => {
  const files = readdirSync(INTRO_DIR).filter((item) => item.endsWith('.js'));
  assert.ok(files.includes('zh.js') && files.includes('en.js'));
  const counts = new Map();
  for (const file of files) {
    const { default: intros } = await import(
      new URL(file, new URL('file:///' + INTRO_DIR.replace(/\\/g, '/')))
    );
    for (const id of known) {
      const entry = intros[id];
      assert.ok(Array.isArray(entry) && entry.length === 2, `${file} 缺 ${id}`);
      const paragraphs = [].concat(entry[1]);
      assert.ok(typeof entry[0] === 'string' && entry[0].trim(), `${file} 里 ${id} 的名字是空的`);
      assert.ok(
        paragraphs.length && paragraphs.every((text) => typeof text === 'string' && text.trim()),
        `${file} 里 ${id} 的介绍是空的`,
      );
      if (!counts.has(id)) counts.set(id, paragraphs.length);
      assert.equal(
        paragraphs.length,
        counts.get(id),
        `${file} 里 ${id} 的介绍段数和别的语言不一样`,
      );
    }
    for (const id of Object.keys(intros)) assert.ok(known.has(id), `${file} 里的 ${id} 没有画稿`);
  }
});
