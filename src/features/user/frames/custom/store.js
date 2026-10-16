// 自定义头像框的存法和各种改动。只管结构，不碰存储和页面；读写在 data.js。
// 分两个键存（见 storage/keys.js）：
//   目录 CUSTOM_FRAMES_KEY：{ order: [编号…], frames: { 编号: { name, added, updated, mark } } }
//     order    头像框库里的先后（先加的在前）
//     name     名字（各语言，取自代码里的元数据；存储页的目录里看着方便，显示时以代码里的为准）
//     added    加进来的时间，updated 最后一次保存的时间（毫秒）
//     mark     'new' 刚保存、'edit' 刚改过，还没点开过；点开后去掉（空串）
//   代码 CUSTOM_FRAME_ART_KEY：{ 编号: 整段 SVG（标准格式，见 read.js 的 cleanFrame） }
// 内存里合成一份：{ order, frames, art }。
import { readFrame } from '../format.js';
import { revisionsOf, withRevisions } from './read.js';

const MARKS = ['new', 'edit'];
const isPlain = (value) => value && typeof value === 'object' && !Array.isArray(value);
const time = (value) => (Number.isFinite(value) && value > 0 ? value : 0);

// 从两个键里读出来的值合成一份。读不懂的部分丢掉：没有代码的目录项不要；
// 有代码、目录里却没有的（比如目录被清过）补一条，排在最后。
export function readStore(catalog, art) {
  const codes = isPlain(art) ? art : {};
  const listed = isPlain(catalog) && isPlain(catalog.frames) ? catalog.frames : {};
  const order = isPlain(catalog) && Array.isArray(catalog.order) ? catalog.order : [];
  const store = { order: [], frames: {}, art: {} };
  const take = (id) => {
    if (typeof id !== 'string' || !id || id in store.art || typeof codes[id] !== 'string') return;
    const entry = isPlain(listed[id]) ? listed[id] : {};
    store.order.push(id);
    store.art[id] = codes[id];
    store.frames[id] = {
      name: entry.name ?? nameOf(codes[id]),
      added: time(entry.added),
      updated: time(entry.updated),
      mark: MARKS.includes(entry.mark) ? entry.mark : '',
    };
  };
  order.forEach(take);
  Object.keys(listed).forEach(take);
  Object.keys(codes).forEach(take);
  return store;
}

// 写回去的两份。
export const catalogOf = (store) => ({ order: [...store.order], frames: store.frames });
export const artOf = (store) => store.art;

// 代码里写的名字（各语言），没写时是 null。
export function nameOf(code) {
  const name = readFrame(code).meta?.name;
  return name === undefined ? null : name;
}

// 新的编号：custom- 开头，和内置的（文件名）分开；和已有的不重。
export function newFrameId(taken, now = Date.now(), random = Math.random) {
  for (;;) {
    const id = `custom-${now.toString(36)}-${Math.floor(random() * 36 ** 4)
      .toString(36)
      .padStart(4, '0')}`;
    if (!(id in taken)) return id;
  }
}

// 加进来几段代码（已经整理好的），排在最后，挂上「新」。返回新的编号。
export function addFrames(store, codes, now = Date.now(), random = Math.random) {
  return codes.map((code) => {
    const id = newFrameId(store.art, now, random);
    store.order.push(id);
    store.art[id] = code;
    store.frames[id] = { name: nameOf(code), added: now, updated: now, mark: 'new' };
    return id;
  });
}

// 改一个头像框的代码，挂上「改」（还没点开过的新头像框仍是「新」）。没有这个头像框时返回 false。
// 代码是整理好的（read.js 的 cleanFrame）。「改过几次」由插件记：原来的加 1，不管新代码里写的是多少。
export function updateFrame(store, id, code, now = Date.now()) {
  const entry = store.frames[id];
  if (!entry) return false;
  store.art[id] = withRevisions(code, revisionsOf(store.art[id]) + 1);
  entry.name = nameOf(code);
  entry.updated = now;
  if (entry.mark !== 'new') entry.mark = 'edit';
  return true;
}

// 删掉几个头像框，返回删了几个。
export function removeFrames(store, ids) {
  const gone = new Set(ids.filter((id) => id in store.frames));
  for (const id of gone) {
    delete store.frames[id];
    delete store.art[id];
  }
  store.order = store.order.filter((id) => !gone.has(id));
  return gone.size;
}

// 点开过了：去掉「新」「改」。原来就没有标记时返回 false（不用写回去）。
export function markSeen(store, id) {
  const entry = store.frames[id];
  if (!entry?.mark) return false;
  entry.mark = '';
  return true;
}

// 导出的代码：几段按头像框库里的先后连在一起，中间空一行。贴到「新建」里能一次导回来。
export function exportCode(store, ids) {
  const wanted = new Set(ids);
  return store.order
    .filter((id) => wanted.has(id))
    .map((id) => store.art[id])
    .join('\n\n');
}
