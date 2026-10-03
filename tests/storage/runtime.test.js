import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeLegacyRuntime } from '../../src/storage/runtime.js';
import { RUNTIME_DATA_KEY, LEGACY_RUNTIME_KEYS } from '../../src/storage/keys.js';

// 用一张表顶替油猴存储。每个用例重新载入模块，「本次页面加载已迁移」的标记从头开始。
let load = 0;
async function setup(initial = {}) {
  const store = new Map(Object.entries(initial));
  globalThis.GM_getValue = (key, fallback) => (store.has(key) ? store.get(key) : fallback);
  globalThis.GM_setValue = (key, value) => store.set(key, value);
  globalThis.GM_deleteValue = (key) => store.delete(key);
  const runtime = await import(`../../src/storage/runtime.js?load=${++load}`);
  const saved = () =>
    store.has(RUNTIME_DATA_KEY) ? JSON.parse(store.get(RUNTIME_DATA_KEY)) : null;
  return { store, runtime, saved };
}

test('合并旧值：时间取较新的，语言标记只在缺失时补上', () => {
  const merged = mergeLegacyRuntime(
    { ratingsTime: 500, clistSyncTime: 900, ratingsLocale: 'en' },
    { ratingsTime: '800', clistSyncTime: '100', ratingsLocale: 'ru' },
  );
  assert.deepEqual(merged, { ratingsTime: 800, clistSyncTime: 900, ratingsLocale: 'en' });
});

test('合并旧值：更新检查状态取检查时间较新的一份', () => {
  const older = { lastCheckTime: 10, latestKnownVersion: '1.0.0' };
  const newer = { lastCheckTime: 20, latestKnownVersion: '1.1.0' };
  assert.deepEqual(mergeLegacyRuntime({}, { updateCheck: older }).updateCheck, older);
  assert.deepEqual(
    mergeLegacyRuntime({ updateCheck: older }, { updateCheck: newer }).updateCheck,
    newer,
  );
  assert.deepEqual(
    mergeLegacyRuntime({ updateCheck: newer }, { updateCheck: older }).updateCheck,
    newer,
  );
});

test('合并旧值：不改动传入的对象，无效的旧值不写入', () => {
  const current = { ratingsTime: 500 };
  const merged = mergeLegacyRuntime(current, { ratingsTime: 'abc', updateCheck: 'broken' });
  assert.deepEqual(merged, { ratingsTime: 500 });
  assert.notEqual(merged, current);
});

test('迁移：四个旧键并入新键后删除', async () => {
  const { store, runtime, saved } = await setup({
    [LEGACY_RUNTIME_KEYS.ratingsTime]: '1700000000000',
    [LEGACY_RUNTIME_KEYS.ratingsLocale]: 'en',
    [LEGACY_RUNTIME_KEYS.clistSyncTime]: '1700000001000',
    [LEGACY_RUNTIME_KEYS.updateCheck]: '{"lastCheckTime":5,"latestKnownVersion":"1.7.0"}',
  });
  const expected = {
    ratingsTime: 1700000000000,
    ratingsLocale: 'en',
    clistSyncTime: 1700000001000,
    updateCheck: { lastCheckTime: 5, latestKnownVersion: '1.7.0' },
  };
  assert.deepEqual(runtime.readRuntimeData(), expected);
  assert.deepEqual(saved(), expected);
  assert.deepEqual([...store.keys()], [RUNTIME_DATA_KEY]);
});

test('迁移：没有旧键时不写存储', async () => {
  const { store, runtime } = await setup();
  assert.deepEqual(runtime.readRuntimeData(), {});
  assert.equal(runtime.getRuntimeValue('ratingsTime'), null);
  assert.equal(store.size, 0);
});

test('写入只改给定字段，其余字段保留', async () => {
  const { runtime, saved } = await setup({
    [RUNTIME_DATA_KEY]: '{"ratingsTime":1,"ratingsLocale":"en"}',
  });
  runtime.setRuntimeValues({ clistSyncTime: 2 });
  assert.deepEqual(saved(), { ratingsTime: 1, ratingsLocale: 'en', clistSyncTime: 2 });
  assert.equal(runtime.getRuntimeValue('clistSyncTime'), 2);
});

test('删除字段：其余字段保留，删空后连键一起删掉', async () => {
  const { store, runtime, saved } = await setup({
    [RUNTIME_DATA_KEY]: '{"ratingsTime":1,"ratingsLocale":"en","clistSyncTime":2}',
  });
  runtime.removeRuntimeValues(['ratingsTime', 'ratingsLocale']);
  assert.deepEqual(saved(), { clistSyncTime: 2 });
  runtime.removeRuntimeValues(['clistSyncTime']);
  assert.equal(store.has(RUNTIME_DATA_KEY), false);
});

test('删除本来就没有的字段：不写存储', async () => {
  const { store, runtime } = await setup();
  runtime.removeRuntimeValues(['clistSyncTime']);
  assert.equal(store.size, 0);
});

test('清空：新键和还没迁移的旧键都删掉', async () => {
  const { store, runtime } = await setup({
    [RUNTIME_DATA_KEY]: '{"ratingsTime":1}',
    [LEGACY_RUNTIME_KEYS.clistSyncTime]: '2',
  });
  runtime.clearRuntimeData();
  assert.equal(store.size, 0);
});
