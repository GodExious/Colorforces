import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  PETAL_COLORS,
  petalPosition,
  petalColor,
  petalTint,
} from '../../src/utils/petal-palette.js';
import { MENU_TAB_IDS } from '../../src/config/menu-tabs.js';

const iconPath = (id) =>
  fileURLToPath(new URL(`../../src/assets/icons/menu/${id}.svg`, import.meta.url));

test('页签在色环上均分：首页在第一片花瓣，位置随序号递增且不超过一圈', () => {
  assert.equal(petalPosition(0, 10), 0);
  assert.equal(petalPosition(5, 10), 4);
  assert.equal(petalPosition(4, 8), 4);
  for (let index = 1; index < 13; index++) {
    assert.ok(petalPosition(index, 13) > petalPosition(index - 1, 13));
    assert.ok(petalPosition(index, 13) < PETAL_COLORS.length);
  }
});

test('位置无效时回到起点', () => {
  assert.equal(petalPosition(-1, 10), 0);
  assert.equal(petalPosition(3, 0), 0);
  assert.equal(petalPosition(NaN, 10), 0);
});

test('正好落在花瓣上时取花瓣原色，绕一圈后回到起点', () => {
  PETAL_COLORS.forEach((color, index) => assert.equal(petalColor(index), color));
  assert.equal(petalColor(PETAL_COLORS.length), PETAL_COLORS[0]);
  assert.equal(petalColor(-1), PETAL_COLORS.at(-1));
  assert.equal(petalColor(NaN), PETAL_COLORS[0]);
});

test('落在两片花瓣之间时取中间色，越靠近哪一片越像哪一片', () => {
  const distance = (a, b) =>
    [1, 3, 5].reduce(
      (sum, at) =>
        sum + Math.abs(parseInt(a.slice(at, at + 2), 16) - parseInt(b.slice(at, at + 2), 16)),
      0,
    );
  const near = petalColor(0.2);
  const far = petalColor(0.8);
  assert.match(near, /^#[0-9a-f]{6}$/);
  assert.ok(distance(near, PETAL_COLORS[0]) < distance(near, PETAL_COLORS[1]));
  assert.ok(distance(far, PETAL_COLORS[1]) < distance(far, PETAL_COLORS[0]));
});

test('浅色版本：与白色相混，比例为 1 时不变，为 0 时是白色', () => {
  assert.equal(petalTint('#e45b96', 1), '#e45b96');
  assert.equal(petalTint('#e45b96', 0), '#ffffff');
  assert.equal(petalTint('#000000', 0.6), '#666666');
});

// 各页的主题色写在图标文件里，侧栏从图标读取。顺序或页数变了，这里会指出要改成什么颜色。
test('页签图标的颜色与它在色环上的位置一致', () => {
  MENU_TAB_IDS.forEach((id, index) => {
    const source = readFileSync(iconPath(id), 'utf8');
    const primary = petalColor(petalPosition(index, MENU_TAB_IDS.length));
    assert.match(
      source,
      new RegExp(`--cf-icon-primary: ${primary}; --cf-icon-secondary: ${petalTint(primary)}`),
      `${id}.svg 应为 --cf-icon-primary: ${primary}; --cf-icon-secondary: ${petalTint(primary)}`,
    );
  });
});
