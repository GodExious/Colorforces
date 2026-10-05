import test from 'node:test';
import assert from 'node:assert/strict';
import { upgradeLegacySettings } from '../../../src/storage/migrations/settings.js';
import { DEFAULT_SETTINGS } from '../../../src/config/defaults.js';
import { RUNTIME_DATA_KEY } from '../../../src/storage/keys.js';
import { legacySettings, upgradedSettings } from '../../helpers/legacy-settings.js';

// 用一张表顶替油猴存储：迁移 CList 同步时间时会读写插件数据。
function useStore(initial = {}) {
  const store = new Map(Object.entries(initial));
  globalThis.GM_getValue = (key, fallback) => (store.has(key) ? store.get(key) : fallback);
  globalThis.GM_setValue = (key, value) => store.set(key, value);
  globalThis.GM_deleteValue = (key) => store.delete(key);
  return () => (store.has(RUNTIME_DATA_KEY) ? JSON.parse(store.get(RUNTIME_DATA_KEY)) : null);
}

test('旧结构的每一项都挪到所属页签下面，值不变', () => {
  useStore();
  const { version, ...expected } = upgradedSettings;
  assert.equal(version, DEFAULT_SETTINGS.version);
  assert.deepEqual(upgradeLegacySettings(legacySettings), expected);
});

test('旧数据里没有的项留空，不凭空造值', () => {
  useStore();
  const upgraded = upgradeLegacySettings({ lang: 'zh', show: { langIcon: false } });
  assert.equal(upgraded.general.lang, 'zh');
  assert.equal(upgraded.general.disableUpdateCheck, undefined);
  assert.equal(upgraded.appearance.langIcon.enabled, false);
  assert.equal(upgraded.appearance.acHighlight.enabled, undefined);
  assert.equal(upgraded.appearance.acHighlight.color, undefined);
  assert.equal(upgraded.ratings.clist, undefined);
  assert.equal(upgraded.contest.prediction, undefined);
  assert.equal(upgraded.user.analytics, undefined);
  assert.equal(upgraded.shortcuts, undefined);
});

test('高亮色：分开保存的颜色和透明度合并成一个颜色字符串', () => {
  useStore();
  const color = (old) => upgradeLegacySettings(old).appearance.acHighlight.color;
  assert.equal(color({ acBgColor: '#d4edc9', acBgAlpha: 0.5 }), 'rgba(212, 237, 201, 0.5)');
  // 不透明时保持十六进制写法；已经是合并格式的原样保留。
  assert.equal(color({ acBgColor: '#d4edc9', acBgAlpha: 1 }), '#d4edc9');
  assert.equal(color({ acBgColor: 'rgba(1, 2, 3, 0.4)', acBgAlpha: 0.5 }), 'rgba(1, 2, 3, 0.4)');
});

test('语言图标大小：按像素保存的旧值换算成倍数', () => {
  useStore();
  const size = (value) => upgradeLegacySettings({ langIconSize: value }).appearance.langIcon.size;
  assert.equal(size(28), 2);
  assert.equal(size('21'), 1.5);
  assert.equal(size(1.3), 1.3);
});

test('CList：设置里的同步时间挪到插件数据，只在比已有的新时才覆盖', () => {
  const clist = { enabled: true, apiKey: 'user:example', lastSyncTime: 500 };
  let runtime = useStore();
  assert.deepEqual(upgradeLegacySettings({ clist }).ratings.clist, {
    enabled: true,
    apiKey: 'user:example',
  });
  assert.equal(runtime().clistSyncTime, 500);

  runtime = useStore({ [RUNTIME_DATA_KEY]: JSON.stringify({ clistSyncTime: 900 }) });
  upgradeLegacySettings({ clist });
  assert.equal(runtime().clistSyncTime, 900);
});

test('快捷键：还停在旧默认 Alt 组合键上的换成新的默认值，改过的不动', () => {
  useStore();
  const { shortcuts } = upgradeLegacySettings({
    shortcuts: { hideTags: 'Alt+H', timeFormat: 'Alt+X', userAvatar: 'Alt+A' },
  });
  assert.deepEqual(shortcuts, {
    hideTags: DEFAULT_SETTINGS.shortcuts.hideTags,
    timeFormat: 'Alt+X',
    userAvatar: DEFAULT_SETTINGS.shortcuts.userAvatar,
  });
});

test('只要有值就按真假算的几项：数字、字符串也换成布尔值', () => {
  useStore();
  const upgraded = upgradeLegacySettings({ hideTags: 1, colorRatings: 0, tagFillCell: '' });
  assert.equal(upgraded.appearance.tags.hide, true);
  assert.equal(upgraded.ratings.enabled, false);
  assert.equal(upgraded.ratings.tagFillCell, false);
});
