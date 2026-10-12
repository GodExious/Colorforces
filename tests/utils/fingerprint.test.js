import test from 'node:test';
import assert from 'node:assert/strict';
import { textFingerprint } from '../../src/utils/fingerprint.js';

// 一段很长的文字：指纹只读开头、结尾各 256 个字符和中间均匀抽的 1024 个。
const long = 'abcdefghij'.repeat(200000);
const replaceAt = (text, index, char) => text.slice(0, index) + char + text.slice(index + 1);

test('同样的文字指纹相同', () => {
  assert.equal(textFingerprint(long), textFingerprint('abcdefghij'.repeat(200000)));
  assert.equal(textFingerprint(''), textFingerprint(''));
});

test('长度变了指纹就变', () => {
  assert.notEqual(textFingerprint(long), textFingerprint(long + 'a'));
  assert.notEqual(textFingerprint(long), textFingerprint(long.slice(1)));
});

test('短文字每个字符都读，改任何一个都看得出来', () => {
  const short = 'x'.repeat(1500);
  for (const index of [0, 1, 700, 1498, 1499])
    assert.notEqual(textFingerprint(short), textFingerprint(replaceAt(short, index, 'y')));
});

test('长文字：开头、结尾和被抽到的位置改了看得出来', () => {
  const print = textFingerprint(long);
  // 开头和结尾各 256 个字符。
  for (const index of [0, 255, long.length - 256, long.length - 1])
    assert.notEqual(print, textFingerprint(replaceAt(long, index, '#')));
  // 中间第一个被抽到的位置紧跟在开头那一段后面。
  assert.notEqual(print, textFingerprint(replaceAt(long, 256, '#')));
});

test('长文字：没被读到的位置改了看不出来（已知的盲区）', () => {
  // 第 257 个字符夹在两个抽样点之间。
  assert.equal(textFingerprint(long), textFingerprint(replaceAt(long, 257, '#')));
});
