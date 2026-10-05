import test from 'node:test';
import assert from 'node:assert/strict';

// 用一张空表顶替油猴存储：设置取默认值（时间格式化开启，格式为 YYYY/MM/DD HH:mm）。
const store = new Map();
globalThis.GM_getValue = (key, fallback) => (store.has(key) ? store.get(key) : fallback);
globalThis.GM_setValue = (key, value) => store.set(key, value);
globalThis.GM_deleteValue = (key) => store.delete(key);
globalThis.GM_listValues = () => [...store.keys()];
globalThis.GM_addValueChangeListener = () => {};

const { appSettings } = await import('../../../../src/settings.js');
const { formatTimesInText } = await import('../../../../src/features/appearance/time/format.js');

test('悬停提示里原站写法的时间换成设置的格式，后面的时区原样保留', () => {
  assert.equal(formatTimesInText('May/24/2021 06:44 UTC-4'), '2021/05/24 06:44 UTC-4');
  assert.equal(formatTimesInText('Oct/04/2026 02:36UTC-4'), '2026/10/04 02:36UTC-4');
  // 俄文界面的写法，带秒。
  assert.equal(formatTimesInText('24.05.2021 06:44:09'), '2021/05/24 06:44');
});

test('一段文字里有几个时间就换几个，其余文字不动', () => {
  assert.equal(
    formatTimesInText('from May/24/2021 06:44 to Oct/04/2026 02:36'),
    'from 2021/05/24 06:44 to 2026/10/04 02:36',
  );
});

test('跟着设置里的格式走', () => {
  appSettings.appearance.timeFormat.format = 'YYYY-MM-DD HH:mm:ss';
  assert.equal(formatTimesInText('May/24/2021 06:44'), '2021-05-24 06:44:00');
  appSettings.appearance.timeFormat.format = 'YYYY/MM/DD HH:mm';
});

test('没有时间的文字、空值原样返回', () => {
  assert.equal(formatTimesInText('Click to see the list'), 'Click to see the list');
  assert.equal(formatTimesInText(''), '');
  assert.equal(formatTimesInText(null), null);
});

test('关闭时间格式化后不改写', () => {
  appSettings.appearance.timeFormat.enabled = false;
  assert.equal(formatTimesInText('May/24/2021 06:44 UTC-4'), 'May/24/2021 06:44 UTC-4');
  appSettings.appearance.timeFormat.enabled = true;
});
