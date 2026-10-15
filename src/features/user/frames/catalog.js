// 头像框的画稿，和把画稿拼成图片。
// 每个头像框是 120×120 画板上的一张矢量图（src/assets/frames/，从草稿导出），按种类分文件夹：
//   ranks/    段位的（未评级到传奇特级大师）
//   special/  特别款（4000 分以上的 tourist、jiangly，管理员）；和段位的一样跟着段位走，不能手动佩戴
//   decor/    常规款（金穗、嘟嘟猪、蝴蝶结、Joker、气球、小黄鸭……），谁都能戴，也能设给分组
// 文件名就是头像框的名字，各文件夹里不重名。头像是正中半径 40 的圆，环压住头像的边，
// 装饰可以伸到画板外面（帽子、荧光棒、扑克牌伸出去十几个单位），所以拼成图片时画板四周各多留 20（-20 -20 160 160），
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
// 头像框在头像框库里的先后：段位从低到高，特别款是 tourist、jiangly、管理员，常规款按这里的先后；没列到的排在后面。
const ORDER = [
  'unrated',
  'newbie',
  'pupil',
  'specialist',
  'expert',
  'cm',
  'master',
  'im',
  'gm',
  'igm',
  'lgm',
  'tourist',
  'jiangly',
  'headquarters',
  'wheat',
  'pig',
  'bow',
  'joker',
  'balloons',
  'duck',
  'headphones',
  'starry',
  'catnap',
  'planet',
  'corgi',
  'board',
  'wheelchair',
  'train',
  'electric',
  'instant',
];
const orderAt = (id) => (ORDER.includes(id) ? ORDER.indexOf(id) : Infinity);
// 某一种的头像框，按上面的先后。
export const framesOfKind = (kind) =>
  [...KINDS]
    .filter(([, own]) => own === kind)
    .map(([id]) => id)
    .sort((a, b) => orderAt(a) - orderAt(b) || a.localeCompare(b));
// 能自己戴、能设给分组的（常规款）。段位、特别款跟着段位走。
export const LIBRARY_FRAMES = framesOfKind('decor');
export const wearableFrame = (id) => frameKind(id) === 'decor';

// 一个头像框在头像上面、下面各伸出去多少（画板的单位，头像直径是 80）：{ up, down }。
// 画稿各不一样（帽子、皇冠伸得高，猪耳朵伸得矮），没法事先写死，就把静止的那张画到画布上，找最上、最下有颜色的一行。
// 量一次记下来；量不了（浏览器不让读画布）时是 null，用的地方按伸得最高的那种留。
// frameReach 返回量的结果（Promise）；measuredReach 是已经量好的结果，还没量好时是 undefined。
const reaches = new Map();
const measured = new Map();
const SIDE = 320; // 画布边长：画板 160 个单位，一个单位 2 像素
async function measureReach(id) {
  try {
    const image = new Image();
    image.src = frameImage(id, false);
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIDE;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, SIDE, SIDE);
    const pixels = context.getImageData(0, 0, SIDE, SIDE).data;
    const filled = (y) => {
      for (let x = 0; x < SIDE; x++) if (pixels[(y * SIDE + x) * 4 + 3] > 16) return true;
      return false;
    };
    let top = 0,
      bottom = SIDE - 1;
    while (top < SIDE && !filled(top)) top++;
    while (bottom > top && !filled(bottom)) bottom--;
    if (top >= SIDE) return null;
    // 画布上的一行 → 画板的单位：画板从 -20 开始；头像的上边在 20，下边在 100。
    return { up: Math.max(0, 40 - top / 2), down: Math.max(0, (bottom + 1) / 2 - 120) };
  } catch {
    return null;
  }
}
export function frameReach(id) {
  if (!reaches.has(id))
    reaches.set(
      id,
      measureReach(id).then((reach) => {
        measured.set(id, reach);
        return reach;
      }),
    );
  return reaches.get(id);
}
export const measuredReach = (id) => measured.get(id);

// 头像框的名字和介绍，按语言分文件放在 intro 目录下（{ 头像框: [名字, 介绍] }，介绍分段的是数组）。
// 这门语言没有就用英文的，再没有用中文的；都没有时名字就是头像框的名字，没有介绍。
const INTROS = import.meta.glob('./intro/*.js', { eager: true, import: 'default' });
export function frameIntro(id, lang) {
  const pick = (code) => INTROS[`./intro/${code}.js`]?.[id];
  return pick(lang) || pick('en') || pick('zh') || [id, ''];
}

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
