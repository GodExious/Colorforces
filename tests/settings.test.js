import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS_KEY, LEGACY_SETTINGS_KEY } from '../src/storage/keys.js';
import { DEFAULT_SETTINGS } from '../src/config/defaults.js';
import { legacySettings, upgradedSettings } from './helpers/legacy-settings.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
// 用一张表顶替油猴存储，并记下设置模块登记的「别的标签页改了值」的回调。
// 每个用例重新载入设置模块，相当于新开一个标签页。
let load = 0;
async function openTab(store) {
  const writes = [];
  const remoteListeners = [];
  globalThis.GM_getValue = (key, fallback) => (store.has(key) ? store.get(key) : fallback);
  globalThis.GM_setValue = (key, value) => {
    store.set(key, value);
    writes.push(key);
  };
  globalThis.GM_deleteValue = (key) => store.delete(key);
  globalThis.GM_listValues = () => [...store.keys()];
  globalThis.GM_addValueChangeListener = (key, listener) => remoteListeners.push({ key, listener });
  const settings = await import(`../src/settings.js?load=${++load}`);
  // 模拟另一个标签页保存了整份设置：先改存储，再触发通知。
  const otherTabSaves = (change) => {
    const stored = store.has(SETTINGS_KEY)
      ? JSON.parse(store.get(SETTINGS_KEY))
      : clone(DEFAULT_SETTINGS);
    change(stored);
    store.set(SETTINGS_KEY, JSON.stringify(stored));
    for (const { key, listener } of remoteListeners)
      if (key === SETTINGS_KEY) listener(key, null, store.get(key), true);
  };
  const saved = () => JSON.parse(store.get(SETTINGS_KEY));
  return { settings, writes, remoteListeners, otherTabSaves, saved };
}
// 存储里已有一份设置（默认值上改几项）。
function storeWith(change = () => {}) {
  const stored = clone(DEFAULT_SETTINGS);
  change(stored);
  return new Map([[SETTINGS_KEY, JSON.stringify(stored)]]);
}
// 老用户的存储：只有旧键，里面是第一版结构的设置。
const legacyStore = (settings = legacySettings) =>
  new Map([[LEGACY_SETTINGS_KEY, JSON.stringify(settings)]]);
// 列出设置里最里层的每一项：[路径, 值]。
function leaves(value, path = []) {
  if (!value || typeof value !== 'object') return [[path.join('.'), value]];
  return Object.entries(value).flatMap(([key, item]) => leaves(item, [...path, key]));
}

test('别的标签页保存设置后，本页原地更新并通知各功能，但不写回存储', async () => {
  const tab = await openTab(storeWith());
  const { appSettings, subscribeSettings } = tab.settings;
  assert.equal(tab.remoteListeners.length, 1);
  assert.equal(tab.remoteListeners[0].key, SETTINGS_KEY);
  const langIcon = appSettings.appearance.langIcon;
  let notified = 0;
  subscribeSettings(() => notified++);
  tab.writes.length = 0;

  tab.otherTabSaves((stored) => {
    stored.appearance.langIcon.enabled = false;
    stored.user.avatar.size = 2.4;
  });

  assert.equal(appSettings.appearance.langIcon.enabled, false);
  assert.equal(appSettings.user.avatar.size, 2.4);
  // 嵌套对象还是原来那一个，一直拿着它的模块不会对不上。
  assert.equal(appSettings.appearance.langIcon, langIcon);
  assert.equal(notified, 1);
  assert.deepEqual(tab.writes, []);
});

test('内容没有变化的通知不触发刷新；本页自己的写入不算别的标签页', async () => {
  const store = storeWith();
  const tab = await openTab(store);
  const { appSettings, subscribeSettings } = tab.settings;
  let notified = 0;
  subscribeSettings(() => notified++);
  tab.otherTabSaves(() => {});
  assert.equal(notified, 0);
  // 通知里标明是本页写入（最后一个参数为假）时，不重新读取。
  const changed = storeWith((stored) => (stored.user.avatar.size = 3));
  store.set(SETTINGS_KEY, changed.get(SETTINGS_KEY));
  tab.remoteListeners[0].listener(SETTINGS_KEY, null, store.get(SETTINGS_KEY), false);
  assert.equal(appSettings.user.avatar.size, DEFAULT_SETTINGS.user.avatar.size);
  assert.equal(notified, 0);
});

test('同步之后本页再保存，不会把别的标签页的修改盖掉', async () => {
  const tab = await openTab(storeWith());
  const { appSettings, saveSettings } = tab.settings;

  tab.otherTabSaves((stored) => {
    stored.appearance.langIcon.enabled = false;
  });
  appSettings.appearance.shortVerdict = false;
  saveSettings();

  assert.equal(tab.saved().appearance.langIcon.enabled, false);
  assert.equal(tab.saved().appearance.shortVerdict, false);
});

test('脚本管理器没有通知接口时不报错，仍可手动重新读取', async () => {
  const store = storeWith();
  // 先借 openTab 装好假的存储，再去掉通知接口，重新载入一次模块。
  await openTab(store);
  delete globalThis.GM_addValueChangeListener;
  const fallback = await import(`../src/settings.js?load=${++load}`);
  const changed = storeWith((stored) => (stored.user.avatar.size = 2));
  store.set(SETTINGS_KEY, changed.get(SETTINGS_KEY));
  assert.equal(fallback.syncSettingsFromStorage(), true);
  assert.equal(fallback.appSettings.user.avatar.size, 2);
  assert.equal(fallback.syncSettingsFromStorage(), false);
});

test('老用户的设置（旧键里平铺的旧结构）载入后每一项都带到新结构里，写进新键，旧键原样不动', async () => {
  const store = legacyStore();
  const before = store.get(LEGACY_SETTINGS_KEY);
  const tab = await openTab(store);
  assert.deepEqual(clone(tab.settings.appSettings), upgradedSettings);
  assert.deepEqual(tab.saved(), upgradedSettings);
  assert.deepEqual(tab.writes, [SETTINGS_KEY]);
  assert.equal(store.get(LEGACY_SETTINGS_KEY), before);
  // 旧数据里每一项都特意设成了非默认值：迁移后没有哪一项落回默认值，说明没有漏掉的。
  const defaults = new Map(leaves(DEFAULT_SETTINGS));
  const kept = leaves(upgradedSettings).filter(([path]) => path !== 'version');
  for (const [path, value] of kept) {
    if (defaults.has(path)) assert.notDeepEqual(value, defaults.get(path), path);
  }
  for (const path of defaults.keys()) {
    if (path === 'version' || path === 'general.menuPosition.panelSize') continue;
    assert.ok(
      kept.some(([name]) => name === path),
      path,
    );
  }
  // 迁移只做一次：再开一个标签页读到的已经是新结构，内容不变。
  const next = await openTab(store);
  assert.deepEqual(clone(next.settings.appSettings), upgradedSettings);
});

test('升级时还开着的旧版本页面：它改写旧键不影响本页，本页保存也不碰旧键', async () => {
  const store = legacyStore();
  const tab = await openTab(store);
  const { appSettings, saveSettings, syncSettingsFromStorage } = tab.settings;
  // 本页只监听新键；旧版本页面读写的都是旧键，读不到新结构。
  assert.deepEqual(
    tab.remoteListeners.map(({ key }) => key),
    [SETTINGS_KEY],
  );
  // 旧版本页面把一份默认值写回了旧键。
  const overwritten = JSON.stringify({ lang: 'en', show: { langIcon: true }, avatarSize: 1.6 });
  store.set(LEGACY_SETTINGS_KEY, overwritten);
  assert.equal(syncSettingsFromStorage(), false);
  assert.deepEqual(clone(appSettings), upgradedSettings);

  tab.writes.length = 0;
  appSettings.user.avatar.size = 2.8;
  saveSettings();
  assert.deepEqual(tab.writes, [SETTINGS_KEY]);
  assert.equal(store.get(LEGACY_SETTINGS_KEY), overwritten);
  // 再开一个新版本的标签页，读到的是新键里那份，不是旧键里被改写的默认值。
  const next = await openTab(store);
  assert.deepEqual(clone(next.settings.appSettings), {
    ...upgradedSettings,
    user: { ...upgradedSettings.user, avatar: { enabled: false, size: 2.8 } },
  });
});

test('新键已有设置时不再看旧键；旧键里已经是新结构时直接采用', async () => {
  const store = storeWith((stored) => (stored.general.lang = 'zh'));
  store.set(LEGACY_SETTINGS_KEY, JSON.stringify(legacySettings));
  const tab = await openTab(store);
  assert.equal(tab.settings.appSettings.general.lang, 'zh');
  assert.equal(tab.settings.appSettings.user.avatar.size, DEFAULT_SETTINGS.user.avatar.size);

  const adopted = await openTab(legacyStore(upgradedSettings));
  assert.deepEqual(clone(adopted.settings.appSettings), upgradedSettings);
  assert.deepEqual(adopted.saved(), upgradedSettings);
});

test('什么都没保存过时用默认设置，不写存储', async () => {
  const tab = await openTab(new Map());
  assert.deepEqual(clone(tab.settings.appSettings), DEFAULT_SETTINGS);
  assert.deepEqual(tab.writes, []);
});

test('已保存的设置里类型或取值不对的项落回默认值，不认识的项被丢掉', async () => {
  const store = storeWith((stored) => {
    stored.general.lang = '';
    stored.general.disableUpdateCheck = 'yes';
    stored.appearance.langIcon.size = 9;
    stored.appearance.timeFormat.format = '';
    stored.appearance.tags = null;
    stored.ratings.style = 'rainbow';
    stored.ratings.clist.authMode = 'token';
    stored.contest.prediction.cacheContests = 0;
    stored.user.avatar.size = 'big';
    stored.user.analytics.ratingsMode = 'percent';
    stored.user.analytics.hoursSpan = 'day';
    stored.user.analytics.cacheUsers = -1;
    stored.user.analytics.recentCount = 0;
    stored.user.analytics.recentSpan = 'day';
    stored.user.analytics.rankDivision = 'div5';
    stored.user.analytics.charts.notAChart = true;
    stored.shortcuts.hideTags = 5;
    stored.unknown = { anything: 1 };
  });
  const tab = await openTab(store);
  const expected = clone(DEFAULT_SETTINGS);
  // 语言图标大小超出范围时收到上限；时间格式允许留空。
  expected.appearance.langIcon.size = 3;
  expected.appearance.timeFormat.format = '';
  assert.deepEqual(clone(tab.settings.appSettings), expected);
  assert.deepEqual(tab.saved(), expected);
});

test('新加的快捷键：默认键已被别的绑定占用时保持未绑定', async () => {
  const store = storeWith((stored) => {
    delete stored.shortcuts.predictionEnabled;
    delete stored.shortcuts.menuLanguage;
    stored.shortcuts.hideTags = DEFAULT_SETTINGS.shortcuts.predictionEnabled.toLowerCase();
  });
  const { appSettings } = (await openTab(store)).settings;
  assert.equal(appSettings.shortcuts.predictionEnabled, '');
  assert.equal(appSettings.shortcuts.menuLanguage, DEFAULT_SETTINGS.shortcuts.menuLanguage);
});

test('修改设置：按路径写入并保存；切换 CList 认证方式时同步登录标记', async () => {
  const tab = await openTab(storeWith());
  const { appSettings, setSetting } = tab.settings;
  setSetting('general.lang', 'zh');
  setSetting('ratings.clist.authMode', 'api');
  assert.equal(appSettings.general.lang, 'zh');
  assert.equal(tab.saved().general.lang, 'zh');
  assert.equal(tab.saved().ratings.clist.authMode, 'api');
  assert.equal(tab.saved().ratings.clist.isLoggedIn, false);
});

test('恢复默认设置：就地写回默认值，嵌套对象还是原来那一个', async () => {
  const tab = await openTab(legacyStore());
  const { appSettings, resetSettings } = tab.settings;
  const avatar = appSettings.user.avatar;
  const menuPosition = appSettings.general.menuPosition;
  resetSettings();
  assert.deepEqual(clone(appSettings), DEFAULT_SETTINGS);
  assert.deepEqual(tab.saved(), DEFAULT_SETTINGS);
  assert.equal(appSettings.user.avatar, avatar);
  assert.equal(appSettings.general.menuPosition, menuPosition);
});
