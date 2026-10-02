import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleFromRow } from '../../src/utils/row-toggle.js';

// 最小的元素替身，只实现被测函数用到的选择器与层级查询。
function element(tag, className = '', parent = null) {
  const node = { tag, className, parent, disabled: false, clicks: 0 };
  node.matches = (selectors) =>
    selectors
      .split(',')
      .map((selector) => selector.trim())
      .some(
        (selector) =>
          selector === tag ||
          (selector.startsWith('.') && className.split(' ').includes(selector.slice(1))),
      );
  node.closest = (selectors) => {
    for (let current = node; current; current = current.parent)
      if (current.matches(selectors)) return current;
    return null;
  };
  node.contains = (other) => {
    for (let current = other; current; current = current.parent) if (current === node) return true;
    return false;
  };
  node.click = () => node.clicks++;
  return node;
}

// 搭出一行设置：文字区（含标签和提示按钮）加开关。
function buildRow() {
  const row = element('div', 'cf-setting-item');
  const text = element('span', 'cf-setting-label', row);
  const label = element('label', '', text);
  const hint = element('button', 'cf-info-hint', text);
  const hintGlyph = element('span', '', hint);
  const toggle = element('label', 'cf-toggle-switch', row);
  const input = element('input', '', toggle);
  const slider = element('span', 'cf-toggle-slider', toggle);
  row.querySelector = () => input;
  return { row, text, label, hintGlyph, input, slider };
}

// 模拟一次冒泡到行上的点击。
function click(row, target, extra = {}) {
  toggleFromRow({ currentTarget: row, target, defaultPrevented: false, ...extra });
}

test('点击行空白或普通文字会切换开关', () => {
  const { row, text, input } = buildRow();
  click(row, row);
  click(row, text);
  assert.equal(input.clicks, 2);
});

test('标签、提示按钮和开关本体不重复触发', () => {
  const { row, label, hintGlyph, slider, input } = buildRow();
  click(row, label);
  click(row, hintGlyph);
  click(row, slider);
  assert.equal(input.clicks, 0);
});

test('已被阻止的点击不切换', () => {
  const { row, input } = buildRow();
  click(row, row, { defaultPrevented: true });
  assert.equal(input.clicks, 0);
});

test('禁用的开关不切换', () => {
  const { row, input } = buildRow();
  input.disabled = true;
  click(row, row);
  assert.equal(input.clicks, 0);
});
