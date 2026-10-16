// 自定义头像框的读写。结构和各种改动在 store.js，读贴进来的代码在 read.js。
// 读到的放在一个响应式的值里：头像框库、头像框（AvatarFrame）、catalog.js 读它，增删改、别的标签页改了都跟着变。
// 第一次用到时才去读存储：没做过自定义头像框的人每个页面都不用多读一次。
import { shallowRef } from 'vue';
import { appStorage } from '../../../../storage/gm.js';
import { CUSTOM_FRAMES_KEY, CUSTOM_FRAME_ART_KEY } from '../../../../storage/keys.js';
import { readFrame } from '../format.js';
import {
  readStore,
  catalogOf,
  artOf,
  addFrames,
  updateFrame,
  removeFrames,
  markSeen,
  exportCode,
} from './store.js';

const loadStore = () =>
  readStore(
    appStorage.getJSON(CUSTOM_FRAMES_KEY, null),
    appStorage.getJSON(CUSTOM_FRAME_ART_KEY, null),
  );

// 给界面用的样子：编号 → { id, code, meta, svg, added, updated, mark }（meta、svg 见 format.js 的 readFrame），
// 和按头像框库先后排的编号。同一段代码只读一次元数据。
const parsed = new Map();
function viewOf(store) {
  const frames = new Map();
  for (const id of store.order) {
    const code = store.art[id];
    if (parsed.get(id)?.code !== code) parsed.set(id, { code, ...readFrame(code) });
    frames.set(id, { id, ...parsed.get(id), ...store.frames[id] });
  }
  for (const id of parsed.keys()) if (!frames.has(id)) parsed.delete(id);
  return { order: [...store.order], frames };
}

// 读到的那份放在 cache 里，version 每变一次界面就重新读一遍。第一次读放在 cache 里而不是直接改响应式的值：
// 第一次往往是在界面的计算属性里读到的，计算的过程中不能去改它自己依赖的值。
let cache = null;
const version = shallowRef(0);
const listeners = new Set();
function reload() {
  cache = viewOf(loadStore());
  version.value += 1;
  listeners.forEach((listener) => listener());
}
function current() {
  void version.value;
  if (!cache) {
    cache = viewOf(loadStore());
    // 别的标签页的改动：第一次读过之后才开始听。
    appStorage.onRemoteChange(CUSTOM_FRAMES_KEY, reload);
    appStorage.onRemoteChange(CUSTOM_FRAME_ART_KEY, reload);
  }
  return cache;
}

// 自定义头像框变了（本页改的、别的标签页改的、被清空了）时通知。返回取消订阅的函数。
export function subscribeCustomFrames(listener) {
  current();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// 一个自定义头像框（没有时是 undefined）；全部的编号，按头像框库里的先后。
export const customFrame = (id) => (id ? current().frames.get(id) : undefined);
export const customFrameIds = () => current().order;

// 改动：读出来、改、写回去一气做完，中间不留给别的标签页插进来的空当。art 为假时代码没变，只写目录。
function change(edit, art = true) {
  const store = loadStore();
  const result = edit(store);
  if (result === false) return result;
  appStorage.setJSON(CUSTOM_FRAMES_KEY, catalogOf(store));
  if (art) appStorage.setJSON(CUSTOM_FRAME_ART_KEY, artOf(store));
  reload();
  return result;
}

// 保存新的头像框（整理好的代码），返回新的编号。
export const saveCustomFrames = (codes) => change((store) => addFrames(store, codes));
// 改一个头像框的代码；这个头像框已经不在了（比如在别的标签页里删了）时返回 false。
export const updateCustomFrame = (id, code) => change((store) => updateFrame(store, id, code));
// 删掉几个头像框。
export const removeCustomFrames = (ids) => change((store) => removeFrames(store, ids) || false);
// 点开过了，去掉「新」「改」。
export const seeCustomFrame = (id) => change((store) => markSeen(store, id), false);
// 导出几个头像框的代码。
export const exportCustomFrames = (ids) => exportCode(loadStore(), ids);

// 清空全部自定义头像框（存储页用）。
export function clearCustomFrames() {
  appStorage.removeItem(CUSTOM_FRAMES_KEY);
  appStorage.removeItem(CUSTOM_FRAME_ART_KEY);
  reload();
}
// 存储页「查看」：目录和全部代码，原样读。
export const readCustomCatalog = () => catalogOf(loadStore());
export const readCustomArt = () => artOf(loadStore());
