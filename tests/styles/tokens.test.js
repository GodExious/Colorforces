import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const uiDir = join(root, 'src/ui');
const tokensSource = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');

// 从变量文件读出「变量名 → 数值」，测试始终以它为准，新增变量无需改测试。
const tokens = new Map(
  [...tokensSource.matchAll(/(--cf-[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
);
const valuesOf = (prefix) =>
  [...tokens].filter(([name]) => name.startsWith(prefix)).map(([, value]) => value);

// 各类别对应的 CSS 属性；该属性的值若等于某个变量的数值，就必须写成变量。
const categories = [
  { prefix: '--cf-font-size-', property: 'font-size' },
  { prefix: '--cf-radius-', property: 'border-radius' },
  { prefix: '--cf-font-weight-', property: 'font-weight' },
];

// 收集全部组件文件。
function vueFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) vueFiles(path, out);
    else if (name.endsWith('.vue')) out.push(path);
  }
  return out;
}

// 在所有组件中查找匹配项，返回「文件:行号 内容」列表。
function findAll(pattern) {
  const hits = [];
  for (const file of vueFiles(uiDir)) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        for (const match of line.matchAll(pattern))
          hits.push(`${relative(root, file).replaceAll('\\', '/')}:${index + 1}  ${match[0]}`);
      });
  }
  return hits;
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('变量文件包含四类设计变量', () => {
  assert.ok(valuesOf('--cf-gray-').length >= 10);
  for (const { prefix } of categories) assert.ok(valuesOf(prefix).length >= 3);
});

test('同一类别内没有数值重复的变量', () => {
  for (const prefix of ['--cf-gray-', ...categories.map((c) => c.prefix)]) {
    const values = valuesOf(prefix);
    assert.equal(new Set(values).size, values.length, `${prefix} 存在重复数值`);
  }
});

test('组件引用的设计变量都已定义', () => {
  const missing = findAll(/var\((--cf-(?:gray|font-size|radius|font-weight)-[a-z0-9]+)\)/g).filter(
    (hit) => !tokens.has(hit.match(/--cf-[a-z0-9-]+/)[0]),
  );
  assert.deepEqual(missing, []);
});

test('组件中不直接写灰阶色值', () => {
  const greys = valuesOf('--cf-gray-').map((value) => escape(value.slice(1)));
  // 后面紧跟十六进制字符的是带透明度的八位色值，不属于灰阶变量。
  const pattern = new RegExp(`#(?:${greys.join('|')})(?![0-9a-fA-F])`, 'gi');
  assert.deepEqual(findAll(pattern), []);
});

for (const { prefix, property } of categories) {
  test(`组件中 ${property} 等于变量数值时必须引用变量`, () => {
    const values = valuesOf(prefix).map(escape);
    // 只匹配整个值恰好是该数值的写法；多值写法（如四个角各不相同的圆角）不在此列。
    const pattern = new RegExp(
      `${property}:\\s*(?:${values.join('|')})(?=\\s*(?:;|["'\`]|!important|$))`,
      'g',
    );
    assert.deepEqual(findAll(pattern), []);
  });
}
