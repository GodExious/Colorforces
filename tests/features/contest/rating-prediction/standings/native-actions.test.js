import test from 'node:test';
import assert from 'node:assert/strict';
import {
  noteNative,
  noteAdopted,
  hasNativeAction,
} from '../../../../../src/features/contest/rating-prediction/standings/native-actions.js';

// 只带这里用得到的两样：类名和属性。
function cell({ who = false, problemId = null } = {}) {
  const attributes = new Map(problemId ? [['problemId', problemId]] : []);
  return {
    classList: { contains: (name) => who && name === 'contestant-cell' },
    hasAttribute: (name) => attributes.has(name),
    setAttribute: (name, value) => attributes.set(name, value),
  };
}
const row = (...cells) => ({ cells });

test('页面载入时就带题目编号的格子和选手格，算挂过原站操作的', () => {
  const who = cell({ who: true });
  const solved = cell({ problemId: '1' });
  const empty = cell();
  noteNative([row(who, solved, empty)]);
  assert.ok(hasNativeAction(who));
  assert.ok(hasNativeAction(solved));
  assert.ok(!hasNativeAction(empty));
});

test('载入时没有提交的格子，后来有了题目编号也不算', () => {
  const empty = cell();
  const rows = [row(empty)];
  noteNative(rows);
  empty.setAttribute('problemId', '2');
  noteNative(rows);
  assert.ok(!hasNativeAction(empty));
});

test('同步时整格新加进来的不算，哪怕带着题目编号', () => {
  const adopted = cell({ problemId: '3' });
  const who = cell({ who: true });
  noteAdopted([row(who, adopted)]);
  noteNative([row(who, adopted)]);
  assert.ok(!hasNativeAction(adopted));
  assert.ok(!hasNativeAction(who));
});
