// 头像框的画稿，和把画稿拼成图片。
// 每个头像框是 120×120 画板上的一张矢量图（src/assets/frames/，从草稿导出），按种类分文件夹：
//   ranks/    段位的（未评级到传奇特级大师，以及 4000 分以上的 tourist、jiangly）
//   special/  特别款（管理员）
//   decor/    头像框库里的常规款（金穗、嘟嘟猪、蝴蝶结）
// 文件名就是头像框的名字，各文件夹里不重名。头像是正中半径 40 的圆，环压住头像的边，
// 装饰可以伸到画板外面（帽子、荧光棒、试管伸出去十几个单位），所以拼成图片时画板四周各多留 20（-20 -20 160 160），
// 不然伸出去的部分被图片的边裁掉。用的地方按这个比例摆：图片的边长是头像直径的 160 / 80 = 2 倍，头像在正中。
// 同一种头像框，页面上所有用到它的头像共用同一张图片：动效写在图片里面，几百个头像也只解析、只画一份。
// 图片有两种：会动的（带动效样式）和静止的（不带）。动效设成「悬停时」时，平时显示静止的，鼠标移上去换成会动的。
import motionCss from './motion.css?raw';
import scriptFont from '../../../assets/fonts/kaushan-script/kaushan-script.woff2?inline';

const ART = import.meta.glob('../../../assets/frames/*/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});
// 头像框的名字 → 画稿；名字 → 种类（文件夹名：'ranks'、'special'、'decor'）。
const FRAMES = new Map();
const KINDS = new Map();
for (const [path, svg] of Object.entries(ART)) {
  const [, kind, id] = /\/([^/]+)\/([^/]+)\.svg$/.exec(path);
  FRAMES.set(id, svg.trim());
  KINDS.set(id, kind);
}
// 一个头像框是哪一种；不认识的返回空串。
export const frameKind = (id) => KINDS.get(id) || '';
// 有哪些头像框（给 choose.js 的 chooseFrame 用）。
export const KNOWN_FRAMES = new Set(FRAMES.keys());

// 绶带上的艺术字用的手写体，嵌进图片里（图片里用不了页面上的字体）。
const FONT = `@font-face{font-family:'Kaushan Script';src:url(${scriptFont}) format('woff2')}`;
const urls = new Map();
// 每张图片生成时就先解码一份，并一直留着这份引用。页面上同一时间只显示静止、会动两张里的一张，
// 没显示的那张浏览器不会去解码；第一次切换动效设置时它才开始解码，这一下头像框会空一瞬间。先解码好就不会了。
const decoded = new Map();
// 一个头像框的图片地址。moving 为假时是静止的那张。不认识的头像框返回空串。
export function frameImage(id, moving) {
  if (!FRAMES.has(id)) return '';
  const key = id + (moving ? '' : ':still');
  if (!urls.has(key)) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" class="cf-frame-art" viewBox="-20 -20 160 160">` +
      `<style>${FONT}${moving ? motionCss : ''}</style>${FRAMES.get(id)}</svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    urls.set(key, url);
    const image = new Image();
    image.src = url;
    image.decode?.().catch(() => {});
    decoded.set(key, image);
  }
  return urls.get(key);
}
