import test from 'node:test';
import assert from 'node:assert/strict';
import { findTestInfo } from '../../../../src/features/appearance/verdicts/test-info.js';

// 找到的那一段文字；没找到是 null。
const found = (text) => {
  const info = findTestInfo(text);
  return info && text.slice(info.start, info.end);
};

test('测试点信息：编号写在同一段文字里', () => {
  assert.equal(found('Wrong answer on test 5'), ' on test 5');
  assert.equal(found('Time limit exceeded on pretest 12'), ' on pretest 12');
  assert.equal(found('Running on test 3'), ' on test 3');
  assert.equal(findTestInfo('Wrong answer on test 5').numbered, true);
  // 后面还有别的内容时只取到编号为止。
  assert.equal(found('Wrong answer on test 5 [main tests]'), ' on test 5');
});

test('测试点信息：编号在后面的节点里，这一段只有「on test」', () => {
  const info = findTestInfo('Wrong answer on test ');
  assert.deepEqual(info, { start: 12, end: 20, numbered: false });
  // 缩写之后，「on test」前面的判题名称在另一个节点里，这一段从头就是它。
  assert.equal(found(' on test '), ' on test');
  assert.equal(found('on pretest '), 'on pretest');
});

test('测试点信息：俄文界面', () => {
  assert.equal(found('Неправильный ответ на тесте 3'), ' на тесте 3');
  assert.equal(found('Выполняется на претесте 7'), ' на претесте 7');
});

test('没有测试点信息的判题文字', () => {
  for (const text of [
    'Accepted',
    'Pretests passed',
    'Compilation error',
    'Hacked',
    'Partial result: 30 points',
    'In queue',
    'Running',
    'Skipped',
    '',
  ])
    assert.equal(findTestInfo(text), null, text);
  // 不把别的词里的「on test…」当成测试点。
  assert.equal(findTestInfo('Wrong answer on tests'), null);
  assert.equal(findTestInfo('Decision on testing'), null);
  assert.equal(findTestInfo(undefined), null);
});
