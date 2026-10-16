// 内置的头像框，和把头像框做成图片。
// 每个头像框是一段完整的 SVG（src/assets/frames/，从草稿导出），名字、介绍、画、动效都在它自己里面（格式见 format.js）。
// 按种类分文件夹：
//   ranks/    段位的（未评级到传奇特级大师）
//   special/  特别款（4000 分以上的 tourist、jiangly，管理员）；和段位的一样跟着段位走，不能手动佩戴
//   decor/    常规款（金穗、嘟嘟猪、蝴蝶结、Joker、气球、小黄鸭……），谁都能戴，也能设给分组
// 自定义的（用户自己做的，存在油猴存储里，见 custom/data.js）是第四种 'custom'，编号以 custom- 开头，
// 也是谁都能戴、能设给分组；增删改时这里的各个函数跟着变（读的是响应式的值）。
// 文件名就是头像框的编号，各文件夹里不重名。头像是正中半径 40 的圆，环压住头像的边，
// 装饰可以伸到画板外面（帽子、荧光棒、扑克牌伸出去十几个单位），所以画板四周各多留 20（-20 -20 160 160），
// 不然伸出去的部分被图片的边裁掉。用的地方按这个比例摆：图片的边长是头像直径的 160 / 80 = 2 倍，头像在正中。
// 同一种头像框，页面上所有用到它的头像共用同一张图片：动效写在图片里面，几百个头像也只解析一份。
// 图片写在样式表里一条规则的背景上，头像上放的是带这个类的空元素（见下面的 frameArt），同一种头像框只有一份动画、步调一致。
// 图片有两种：会动的和静止的（停掉所有动画）。动效设成「悬停时」时，平时显示静止的，鼠标移上去换成会动的。
import scriptFont from '../../../assets/fonts/kaushan-script/kaushan-script.woff2?inline';
import { readFrame, frameText, frameDocument } from './format.js';
import { customFrame, customFrameIds } from './custom/data.js';

const ART = import.meta.glob('../../../assets/frames/*/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});
// 头像框的编号 → { meta, svg }（元数据和去掉元数据的画）；编号 → 种类（文件夹名：'ranks'、'special'、'decor'）。
const FRAMES = new Map();
const KINDS = new Map();
for (const [path, code] of Object.entries(ART)) {
  const [, kind, id] = /\/([^/]+)\/([^/]+)\.svg$/.exec(path);
  FRAMES.set(id, readFrame(code));
  KINDS.set(id, kind);
}
// 一个头像框是哪一种；不认识的返回空串。
export const frameKind = (id) => KINDS.get(id) || (customFrame(id) ? 'custom' : '');
// 认不认识这个头像框（给 choose.js 的 chooseFrame 用，它只用 has）：内置的，和现在还在的自定义的。
export const KNOWN_FRAMES = { has: (id) => FRAMES.has(id) || Boolean(customFrame(id)) };
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
// 某一种的头像框，按上面的先后；自定义的按做出来的先后。
export const framesOfKind = (kind) =>
  kind === 'custom'
    ? customFrameIds()
    : [...KINDS]
        .filter(([, own]) => own === kind)
        .map(([id]) => id)
        .sort((a, b) => orderAt(a) - orderAt(b) || a.localeCompare(b));
// 能自己戴、能设给分组的（常规款和自定义的）。段位、特别款跟着段位走。
export const wearableFrame = (id) => ['decor', 'custom'].includes(frameKind(id));
// 一个头像框的代码：{ meta, svg }（见 format.js 的 readFrame）。
const sourceOf = (id) => FRAMES.get(id) || customFrame(id);
// 头像框的画是哪一版：内置的不会变（空串）；自定义的每保存一次换一版，量的结果、图片都按版记（见下面）。
const frameStamp = (id) => (FRAMES.has(id) ? '' : String(customFrame(id)?.updated ?? ''));

// 一个头像框在头像上面、下面、左边、右边各伸出去多少（画板的单位，头像直径是 80）：{ up, down, left, right }。
// 画稿各不一样（帽子、皇冠伸得高，猪耳朵伸得矮），没法事先写死，就把静止的那张画到画布上，找最上、最下有颜色的一行，
// 和最左、最右有颜色的一列（左右给横向的右键菜单名片用，见 UserMenu）。
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
    const filledColumn = (x) => {
      for (let y = top; y <= bottom; y++) if (pixels[(y * SIDE + x) * 4 + 3] > 16) return true;
      return false;
    };
    let left = 0,
      right = SIDE - 1;
    while (left < SIDE && !filledColumn(left)) left++;
    while (right > left && !filledColumn(right)) right--;
    // 画布上的一行（一列）→ 画板的单位：画板从 -20 开始；头像的上边（左边）在 20，下边（右边）在 100。
    return {
      up: Math.max(0, 40 - top / 2),
      down: Math.max(0, (bottom + 1) / 2 - 120),
      left: Math.max(0, 40 - left / 2),
      right: Math.max(0, (right + 1) / 2 - 120),
    };
  } catch {
    return null;
  }
}
// 自定义的头像框改过之后画就变了，量的结果、图片都按「编号 + 哪一版」记。
const versionOf = (id) => id + '@' + frameStamp(id);
export function frameReach(id) {
  const key = versionOf(id);
  if (!reaches.has(key))
    reaches.set(
      key,
      measureReach(id).then((reach) => {
        measured.set(key, reach);
        return reach;
      }),
    );
  return reaches.get(key);
}
export const measuredReach = (id) => measured.get(versionOf(id));

// 头像框的名字和介绍：[名字, 介绍]，介绍分段的是数组。取自头像框自己的元数据，
// 这门语言没有就用英文的，再没有用中文的；都没有时内置的名字是头像框的编号，自定义的是空串（用的地方写「未命名」），没有介绍。
export function frameIntro(id, lang) {
  if (FRAMES.has(id)) return frameText(FRAMES.get(id).meta, lang, id);
  return frameText(customFrame(id)?.meta, lang, '');
}

// 头像框的署名和第几版：{ author, edition }。author 是做的一方的署名（没署名是空串），
// edition 是在插件里改过的次数加 1（元数据的 revisions，见 custom/read.js 的 cleanMeta）。不认识的头像框是 null。
export function frameCredit(id) {
  const source = sourceOf(id);
  if (!source) return null;
  return creditOf(source.meta);
}
// 一段元数据里的署名和第几版（还没保存的代码试戴时也用）。
export function creditOf(meta) {
  const author = typeof meta?.author === 'string' ? meta.author.trim() : '';
  const revisions =
    Number.isSafeInteger(meta?.revisions) && meta.revisions >= 0 ? meta.revisions : 0;
  return { author, edition: revisions + 1 };
}

// 绶带上的艺术字用的手写体，嵌进图片里（图片里用不了页面上的字体）。
const FONT = `@font-face{font-family:'Kaushan Script';src:url(${scriptFont}) format('woff2')}`;
const urls = new Map();
// 每张图片生成时就先解码一份，并一直留着这份引用。页面上同一时间只显示静止、会动两张里的一张，
// 没显示的那张浏览器不会去解码；第一次切换动效设置时它才开始解码，这一下头像框会空一瞬间。先解码好就不会了。
const decoded = new Map();
function makeImage(svg, moving) {
  const url = URL.createObjectURL(
    new Blob([frameDocument(svg, moving, FONT)], { type: 'image/svg+xml' }),
  );
  const image = new Image();
  image.src = url;
  image.decode?.().catch(() => {});
  return { url, image };
}
// 用不着的图片过一会儿再放掉：页面上的旧图要先淡出。
const RELEASE_TIME = 2000;
const release = (url) =>
  setTimeout(() => {
    URL.revokeObjectURL(url);
    dropArt(url);
  }, RELEASE_TIME);
// 自定义的头像框现在是哪一版（编号 → versionOf 的结果）；换了版，旧的两张放掉。
const latest = new Map();
function retire(id, version) {
  const before = latest.get(id);
  latest.set(id, version);
  if (!before || before === version) return;
  for (const key of [before, before + ':still']) {
    if (urls.has(key)) release(urls.get(key));
    urls.delete(key);
    decoded.delete(key);
  }
}
// 一个头像框的图片地址。moving 为假时是静止的那张。不认识的头像框返回空串。
export function frameImage(id, moving) {
  const source = sourceOf(id);
  if (!source) return '';
  const version = FRAMES.has(id) ? id : versionOf(id);
  if (!FRAMES.has(id)) retire(id, version);
  const key = version + (moving ? '' : ':still');
  if (!urls.has(key)) {
    const { url, image } = makeImage(source.svg, moving);
    urls.set(key, url);
    decoded.set(key, image);
  }
  return urls.get(key);
}
// 还没保存的代码（新建、编辑时的试戴）的图片地址。按代码记，最多留 DRAFTS 份（各两张），最早的放掉。
const DRAFTS = 24;
const drafts = new Map();
export function codeImage(code, moving) {
  if (!code) return '';
  const key = (moving ? 'm:' : 's:') + code;
  const found = drafts.get(key);
  // 用到的挪到最后，最早的就是最久没用的。
  if (found) {
    drafts.delete(key);
    drafts.set(key, found);
    return found;
  }
  const { url } = makeImage(readFrame(code).svg, moving);
  drafts.set(key, url);
  if (drafts.size > DRAFTS * 2) {
    const [oldest, old] = drafts.entries().next().value;
    drafts.delete(oldest);
    release(old);
  }
  return url;
}

// —— 头像框画成「带类的空元素」，图片写在样式表里那一条规则的背景上 ——
// 同一张图片不管多少个头像在用，都是同一条规则里的同一张背景图，浏览器只放一份动画，同一种头像框步调一致。
// 不用 <img>：浏览器每把一张 <img> 放到页面上，都让这张图片的动画从头开始，头像一批批出来时，
// 同一种头像框会被一次次拉回开头（出来得勤的时候看着像不动）。背景图不会：后出来的头像从中途接着播，悬停时播放也是接着播。
// 规则按图片地址记；图片放掉时（自定义的头像框换了版、试戴用过的代码太多），规则跟着删掉（见上面的 release）。
let artSheet = null;
const artClasses = new Map();
let artCount = 0;
function artClass(url) {
  if (!url) return '';
  let name = artClasses.get(url);
  if (name) return name;
  if (!artSheet) {
    const style = document.createElement('style');
    style.dataset.cfFrameArt = '';
    (document.head || document.documentElement).appendChild(style);
    artSheet = style.sheet;
  }
  name = `cf-frame-art-${++artCount}`;
  artSheet.insertRule(
    `.cf-frame.${name}{background-image:url("${url}")!important}`,
    artSheet.cssRules.length,
  );
  artClasses.set(url, name);
  return name;
}
function dropArt(url) {
  const name = artClasses.get(url);
  if (!name || !artSheet) return;
  artClasses.delete(url);
  const index = [...artSheet.cssRules].findIndex(
    (rule) => rule.selectorText === `.cf-frame.${name}`,
  );
  if (index >= 0) artSheet.deleteRule(index);
}
// 一个头像框画在头像上用的类。moving 为假时是静止的那张。不认识的头像框返回空串。
export const frameArt = (id, moving) => artClass(frameImage(id, moving));
// 还没保存的代码（试戴）用的类。
export const codeArt = (code, moving) => artClass(codeImage(code, moving));
