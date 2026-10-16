// 读贴进来的代码（AI 的整段回答，或者导出的代码）：找出里面的每一段 <svg>，把每段整理成标准格式（见 format.js），
// 记下整理时去掉了什么、有什么不对。保存时存的就是整理好的那一段。
// 只做文字处理，不依赖浏览器；代码能不能画出来（XML 写没写对）要浏览器读一遍，见 syntaxError。
import { FRAME_FORMAT, readFrame } from '../format.js';

export const FRAME_VERSION = 1;
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
// 约定的画板：-20 -20 160 160。不一样时能用，只是显示出来偏大或偏小。
const BOX = [-20, -20, 160, 160];

// 按 <svg 和 </svg> 的层数找出最外层的每一段（AI 给了好几个方案时就有好几段；里面套着 svg 也不会切错）。
// 段外面的说明文字、``` 都不要（trimmed 记着有没有去掉过）。最后一段没有收尾时记成不完整（cut）。
// at 是这一段在原文里从第几个字开始。
export function splitBlocks(text) {
  const blocks = [];
  const tag = /<svg\b|<\/svg\s*>/gi;
  let depth = 0;
  let start = -1;
  let last = 0;
  let outside = '';
  for (let match; (match = tag.exec(text));) {
    if (match[0][1] !== '/') {
      if (depth === 0) {
        start = match.index;
        outside += text.slice(last, start);
      }
      depth += 1;
    } else if (depth > 0) {
      depth -= 1;
      if (depth === 0) {
        blocks.push({ code: text.slice(start, tag.lastIndex), at: start });
        last = tag.lastIndex;
      }
    }
  }
  if (depth > 0) blocks.push({ code: text.slice(start), at: start, cut: true });
  else outside += text.slice(last);
  return { blocks, trimmed: /\S/.test(outside), empty: !text.trim() };
}

// 头像框里不要的元素：脚本，和 SMIL 动画（动效只用 CSS，见提示词）。先去掉自己收尾的写法，再去掉成对的。
const SCRIPT = '(?:[\\w-]+:)?script';
const SMIL = '(?:[\\w-]+:)?(?:animate|animateMotion|animateTransform|animateColor|set|discard)';
const selfClosing = (name) => new RegExp(`<(${name})\\b[^>]*?\\/\\s*>`, 'gi');
const paired = (name) => new RegExp(`<(${name})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, 'gi');
const loose = (name) => new RegExp(`<\\/?(${name})\\b[^>]*>`, 'gi');
// 指向外面的地址：不是 # 开头（同一段里的元素）、也不是 data: 内嵌的。
const EXTERNAL = /^\s*(?!#|data:)/i;
const OUTER_URL = /url\(\s*(['"]?)\s*(?!#|data:)[^)'"]*\1\s*\)/gi;
const ATTRIBUTE = /\s+([^\s=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
const unquote = (value = '') => value.replace(/^(["'])([\s\S]*)\1$/, '$2');

// 一个开始标签里的属性：去掉 onclick 这类事件（算作脚本），去掉指向外面的链接。
function cleanTag(open, name, attributes, end, removed) {
  const kept = [];
  for (const match of attributes.matchAll(ATTRIBUTE)) {
    const [whole, key, value] = match;
    if (/^on/i.test(key)) {
      removed.scripts += 1;
      continue;
    }
    if (/^(?:xlink:)?href$/i.test(key) && EXTERNAL.test(unquote(value))) continue;
    kept.push(whole);
  }
  return `${open}${name}${kept.join('')}${end}`;
}

// 名字、介绍、作者：只留认得的这几项，类型不对的不要。
const isText = (value) => typeof value === 'string';
const isParagraphs = (value) => isText(value) || (Array.isArray(value) && value.every(isText));
const isPlain = (value) => value && typeof value === 'object' && !Array.isArray(value);
function cleanField(value, ok) {
  if (ok(value)) return value;
  if (!isPlain(value)) return undefined;
  const entries = Object.entries(value).filter(([, text]) => ok(text));
  return entries.length ? Object.fromEntries(entries) : undefined;
}
// 标准的元数据：格式和版本是插件写的，名字、介绍、作者、改过几次照原样留下。
// author 是做这个头像框的一方的署名（AI 做的就是 AI 的模型名），revisions 是在插件里改过几次（显示成「第 revisions + 1 版」），
// 不是整数或小于 0 的不要。
export function cleanMeta(meta) {
  const clean = { format: FRAME_FORMAT, version: FRAME_VERSION };
  if (!isPlain(meta)) return clean;
  const name = cleanField(meta.name, isText);
  const intro = cleanField(meta.intro, isParagraphs);
  if (name !== undefined) clean.name = name;
  if (intro !== undefined) clean.intro = intro;
  if (isText(meta.author) && meta.author.trim()) clean.author = meta.author;
  if (Number.isSafeInteger(meta.revisions) && meta.revisions >= 0) clean.revisions = meta.revisions;
  return clean;
}
// 写进代码里的那一段元数据。名字、介绍里万一写了 ]]>，会把 CDATA 提前收尾，换成转义的写法。
const metadataBlock = (meta) =>
  `<metadata><![CDATA[\n${JSON.stringify(meta, null, 2).replace(/]]>/g, ']]\\u003e')}\n]]></metadata>`;

// 根元素的画板是不是约定的那个。
function boxOf(root) {
  const found = /\sviewBox\s*=\s*(["'])([^"']*)\1/i.exec(root);
  const numbers = found
    ? found[2]
        .trim()
        .split(/[\s,]+/)
        .map(Number)
    : [];
  return numbers.length === 4 && numbers.every((value, index) => value === BOX[index]);
}

// 把一段 <svg> 整理成标准格式：
// - 最外层只有这一段 <svg>，带 xmlns（用到 xlink: 时也带上 xlink 的）；
// - 去掉脚本、事件属性、指向外面的链接（href、CSS 里的 url()、@import）、SMIL 动画；
// - 元数据换成标准的一段，放在最前面（格式、版本由插件写；名字、介绍、作者照留）；
// - 画板（viewBox）不动，不对时只提醒。
// 返回 { code, meta, scripts 去掉了几处脚本, box 画板对不对, motion 有没有动效 }。
export function cleanFrame(source) {
  const removed = { scripts: 0 };
  const meta = cleanMeta(readFrame(source).meta);
  // 注释、CDATA 里的东西先收起来，整理完再放回去：里面的文字不是标签，不能当标签改。
  const kept = [];
  let body = String(source).replace(
    /<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->/g,
    (all) => `\u0000${kept.push(all) - 1}\u0000`,
  );
  body = body.replace(/<metadata\b[^>]*\/\s*>|<metadata\b[^>]*>[\s\S]*?<\/metadata\s*>/gi, '');
  for (const pattern of [selfClosing(SCRIPT), paired(SCRIPT), loose(SCRIPT)])
    body = body.replace(pattern, () => {
      removed.scripts += 1;
      return '';
    });
  for (const pattern of [selfClosing(SMIL), paired(SMIL), loose(SMIL)])
    body = body.replace(pattern, '');
  body = body.replace(
    /(<)([a-zA-Z][\w:.-]*)(\s[^<>]*?)?(\s*\/?>)/g,
    (all, open, name, attrs = '', end) => cleanTag(open, name, attrs, end, removed),
  );
  body = body.replace(/\u0000(\d+)\u0000/g, (all, index) => kept[Number(index)]);
  // CSS 里指向外面的地址：@import 整条去掉，url() 换成 none。
  body = body.replace(/@import\b[^;]*;?/gi, '').replace(OUTER_URL, 'none');
  // 根元素：补上缺的命名空间，紧接着放标准的元数据。
  let box = false;
  body = body.replace(/<svg\b[^>]*>/i, (root) => {
    box = boxOf(root);
    let open = root;
    if (!/\sxmlns\s*=/.test(open)) open = open.replace(/^<svg\b/i, `<svg xmlns="${SVG_NS}"`);
    if (/\bxlink:/.test(body) && !/\sxmlns:xlink\s*=/.test(open))
      open = open.replace(/^<svg\b/i, `<svg xmlns:xlink="${XLINK_NS}"`);
    return `${open}\n${metadataBlock(meta)}`;
  });
  // 元数据后面换一次行接着往下写（整理第二遍时和第一遍一样）；去掉的东西留下的空行并成一行。
  const code = body
    .replace(/(<\/metadata>)\s*/, '$1\n')
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n')
    .trim();
  return { code, meta, scripts: removed.scripts, box, motion: /@keyframes\b/i.test(code) };
}

// 一段整理好的代码（cleanFrame 的结果）改过几次；没写的是 0。
export const revisionsOf = (code) => cleanMeta(readFrame(code).meta).revisions ?? 0;
// 把整理好的代码里「改过几次」换成 count：元数据那一段整个按标准的样子重写，别的不动。
export function withRevisions(code, count) {
  const meta = { ...cleanMeta(readFrame(code).meta), revisions: count };
  return String(code).replace(
    /<metadata\b[^>]*\/\s*>|<metadata\b[^>]*>[\s\S]*?<\/metadata\s*>/i,
    () => metadataBlock(meta),
  );
}

// 两段整理好的代码是不是同一个头像框的同一版：除了改过几次（revisions）以外一模一样就算。
// 编辑时只改了 revisions 那个数不算改动（插件保存时自己按存着的加一，写的数本来就不用）。
export const sameFrame = (a, b) => a === b || withRevisions(a, 0) === withRevisions(b, 0);

// 名字、介绍里写了几种语言（语言代码；只写了一段文字、不分语言的算一种）。
export function languagesOf(meta) {
  const codes = new Set();
  for (const field of [meta?.name, meta?.intro])
    if (isParagraphs(field)) codes.add('');
    else if (isPlain(field)) Object.keys(field).forEach((code) => codes.add(code));
  return codes.size;
}

// 读一整段贴进来的文字：{ blocks, trimmed, empty }。每段是 cleanFrame 的结果，加上 at（在原文里的位置）；
// 不完整的一段只有 { cut: true, at }。
export function readPaste(text) {
  const { blocks, trimmed, empty } = splitBlocks(String(text ?? ''));
  return {
    trimmed,
    empty,
    blocks: blocks.map((block) =>
      block.cut
        ? { cut: true, at: block.at }
        : { ...cleanFrame(block.code), at: block.at, raw: block.code },
    ),
  };
}

// 浏览器能不能把这段代码读成 SVG（图片是按 XML 读的，写错一点就整张画不出来）。
// 读得出来返回 null；读不出来返回 { line }，line 是出错的那一行（这段代码里的第几行，读不出来时是 0）。
// 不在浏览器里（测试）时当作读得出来。
export function syntaxError(code) {
  if (typeof DOMParser !== 'function') return null;
  const doc = new DOMParser().parseFromString(code, 'image/svg+xml');
  const error = doc.getElementsByTagName('parsererror')[0];
  if (!error) return null;
  const line = /line\s*(?:number\s*)?(\d+)/i.exec(error.textContent || '');
  return { line: line ? Number(line[1]) : 0 };
}

// 原文里第 at 个字在第几行（从 1 数）。
export const lineAt = (text, at) => String(text).slice(0, at).split('\n').length;
