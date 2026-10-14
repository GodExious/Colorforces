import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

// 界面文字的各份语言文件。少了一条不会报错：界面会悄悄拿另一种语言的顶上（英文界面里冒出一句中文），
// 所以在这里核对。新增语言文件后自动纳入检查。
const dir = fileURLToPath(new URL('../../src/i18n/locales/', import.meta.url));
const locales = new Map();
for (const file of readdirSync(dir).filter((name) => name.endsWith('.js')))
  locales.set(
    file.replace(/\.js$/, ''),
    (await import(pathToFileURL(join(dir, file)).href)).default,
  );
const names = [...locales.keys()];

test('至少有中文和英文两份界面文字', () => {
  assert.ok(names.includes('zh') && names.includes('en'), names.join(', '));
});

test('各种语言的词条一一对应，没有哪种语言少一条', () => {
  for (const name of names) {
    const own = Object.keys(locales.get(name));
    for (const other of names.filter((item) => item !== name)) {
      const missing = Object.keys(locales.get(other)).filter((key) => !own.includes(key));
      assert.deepEqual(missing, [], `${name} 里缺少这些词条（${other} 里有）`);
    }
  }
});

test('同一条词条在各种语言里是同一类：都是文字，或者都是要带数的函数', () => {
  const [first, ...rest] = names;
  for (const [key, value] of Object.entries(locales.get(first)))
    for (const other of rest)
      assert.equal(
        typeof locales.get(other)[key],
        typeof value,
        `${key}：${first} 和 ${other} 不是同一类`,
      );
});

test('文字词条不是空的', () => {
  for (const name of names)
    for (const [key, value] of Object.entries(locales.get(name)))
      if (typeof value === 'string') assert.ok(value.trim(), `${name} 的 ${key} 是空的`);
});
