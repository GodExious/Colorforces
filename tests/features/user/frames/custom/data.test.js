import test from 'node:test';
import assert from 'node:assert/strict';
import { CUSTOM_FRAMES_KEY, CUSTOM_FRAME_ART_KEY } from '../../../../../src/storage/keys.js';

// 用一张表顶替油猴存储，记下每次写了哪个键。每个用例重新载入模块，读到的那份从头开始。
let load = 0;
async function setup(initial = {}) {
  const store = new Map(Object.entries(initial));
  const writes = [];
  globalThis.GM_getValue = (key, fallback) => (store.has(key) ? store.get(key) : fallback);
  globalThis.GM_setValue = (key, value) => {
    writes.push(key);
    store.set(key, value);
  };
  globalThis.GM_deleteValue = (key) => store.delete(key);
  const data = await import(
    `../../../../../src/features/user/frames/custom/data.js?load=${++load}`
  );
  const saved = (key) => (store.has(key) ? JSON.parse(store.get(key)) : null);
  return { data, store, writes, saved };
}
const code = (name) =>
  `<svg xmlns="http://www.w3.org/2000/svg"><metadata><![CDATA[{"name":"${name}"}]]></metadata><rect/></svg>`;

test('保存、改、点开过、删掉：两个键各写各的，点开过只写目录', async () => {
  const { data, writes, saved } = await setup();
  let notices = 0;
  data.subscribeCustomFrames(() => notices++);
  const [id] = data.saveCustomFrames([code('猫')]);
  assert.deepEqual(writes, [CUSTOM_FRAMES_KEY, CUSTOM_FRAME_ART_KEY]);
  assert.equal(data.customFrame(id).meta.name, '猫');
  assert.equal(data.customFrame(id).mark, 'new');
  assert.deepEqual(data.customFrameIds(), [id]);
  writes.length = 0;
  data.seeCustomFrame(id);
  assert.deepEqual(writes, [CUSTOM_FRAMES_KEY]);
  assert.equal(data.customFrame(id).mark, '');
  assert.equal(data.updateCustomFrame(id, code('狗')), true);
  assert.equal(data.customFrame(id).meta.name, '狗');
  assert.equal(saved(CUSTOM_FRAMES_KEY).frames[id].mark, 'edit');
  assert.equal(data.updateCustomFrame('custom-x', code('鸟')), false);
  // 改过一次：导出的代码里记着改过 1 次（插件自己加的），别的和存进去的一样。
  assert.equal(data.customFrame(id).meta.revisions, 1);
  assert.equal(data.exportCustomFrames([id]), saved(CUSTOM_FRAME_ART_KEY)[id]);
  data.removeCustomFrames([id]);
  assert.equal(data.customFrame(id), undefined);
  assert.deepEqual(saved(CUSTOM_FRAME_ART_KEY), {});
  assert.equal(notices, 4);
});

test('没改什么时不写；清空两个键都删掉', async () => {
  const { data, writes, store } = await setup({
    [CUSTOM_FRAMES_KEY]: JSON.stringify({ order: ['a'], frames: { a: {} } }),
    [CUSTOM_FRAME_ART_KEY]: JSON.stringify({ a: code('猫') }),
  });
  data.seeCustomFrame('a');
  data.removeCustomFrames(['nope']);
  assert.deepEqual(writes, []);
  assert.deepEqual(data.readCustomCatalog().order, ['a']);
  assert.deepEqual(Object.keys(data.readCustomArt()), ['a']);
  data.clearCustomFrames();
  assert.ok(!store.has(CUSTOM_FRAMES_KEY) && !store.has(CUSTOM_FRAME_ART_KEY));
  assert.deepEqual(data.customFrameIds(), []);
});
