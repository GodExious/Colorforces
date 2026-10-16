import test from 'node:test';
import assert from 'node:assert/strict';
import { keepWithinLimit } from '../../src/utils/input-limit.js';

// 一次输入：field 是输入框（value、maxLength、选中的范围），inputType 是浏览器给的输入种类。返回有没有被拦下。
function blocked(field, inputType, extra = {}) {
  let prevented = false;
  keepWithinLimit({
    target: { selectionStart: field.value.length, selectionEnd: field.value.length, ...field },
    inputType,
    ...extra,
    preventDefault: () => (prevented = true),
  });
  return prevented;
}

test('写满了再粘贴、打字、拖进来：拦下（不记没有变化的撤销）；还有地方、选中了要换掉的字时照常', () => {
  const full = { value: 'abcd', maxLength: 4 };
  assert.equal(blocked(full, 'insertFromPaste'), true);
  assert.equal(blocked(full, 'insertText'), true);
  assert.equal(blocked(full, 'insertFromDrop'), true);
  assert.equal(blocked({ value: 'abc', maxLength: 4 }, 'insertFromPaste'), false);
  assert.equal(
    blocked({ value: 'abcd', maxLength: 4, selectionStart: 1, selectionEnd: 3 }, 'insertFromPaste'),
    false,
  );
});

test('删字、撤销、没设上限、输入法拼字时都不管', () => {
  const full = { value: 'abcd', maxLength: 4 };
  assert.equal(blocked(full, 'deleteContentBackward'), false);
  assert.equal(blocked(full, 'historyUndo'), false);
  assert.equal(blocked({ value: 'abcd', maxLength: -1 }, 'insertFromPaste'), false);
  assert.equal(blocked(full, 'insertCompositionText', { isComposing: true }), false);
});
