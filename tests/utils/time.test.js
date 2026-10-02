import test from 'node:test';
import assert from 'node:assert/strict';
import { customFormatTime } from '../../src/utils/time.js';

// 2024-01-05 是星期五；使用本地时间构造，结果不受时区影响。
const morning = new Date(2024, 0, 5, 9, 7, 3, 45);

test('常用日期时间格式', () => {
  assert.equal(customFormatTime(morning, 'YYYY-MM-DD HH:mm:ss'), '2024-01-05 09:07:03');
  assert.equal(customFormatTime(morning, 'YY/M/D H:m:s'), '24/1/5 9:7:3');
  assert.equal(customFormatTime(morning, 'ss.SSS'), '03.045');
});

test('月份和星期名称', () => {
  assert.equal(customFormatTime(morning, 'MMMM MMM'), 'January Jan');
  assert.equal(customFormatTime(morning, 'dddd ddd d'), 'Friday Fri 5');
});

test('12 小时制与上下午', () => {
  assert.equal(customFormatTime(morning, 'hh:mm A'), '09:07 AM');
  assert.equal(customFormatTime(new Date(2024, 0, 5, 0, 30), 'h:mm a'), '12:30 am');
  assert.equal(customFormatTime(new Date(2024, 0, 5, 12, 30), 'h:mm A'), '12:30 PM');
  assert.equal(customFormatTime(new Date(2024, 0, 5, 13, 5), 'hh:mm A'), '01:05 PM');
});

test('方括号内的文字原样输出', () => {
  assert.equal(customFormatTime(morning, '[at] H [h] m [min]'), 'at 9 h 7 min');
  assert.equal(customFormatTime(morning, '[]YYYY'), '2024');
});

test('无效输入返回空字符串', () => {
  assert.equal(customFormatTime(morning, ''), '');
  assert.equal(customFormatTime(morning, null), '');
  assert.equal(customFormatTime(new Date(NaN), 'YYYY'), '');
  assert.equal(customFormatTime('2024-01-05', 'YYYY'), '');
});
