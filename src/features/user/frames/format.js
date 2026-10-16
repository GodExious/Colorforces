// 头像框的格式：一个头像框就是一段完整的 SVG，名字、介绍、画、动效都在它自己里面，复制这一段就能整个带走。
//   <svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 160 160">
//     <metadata><![CDATA[{ "format": "colorforces-frame", "version": 1,
//       "name": { "zh": "…", "en": "…" }, "intro": { "zh": "…", "en": ["第一段", "第二段"] } }]]></metadata>
//     <style>动效：CSS 关键帧</style>
//     画
//   </svg>
// 画板是 -20～140 的方块，头像是正中 (60, 60) 半径 40 的圆，画出画板的部分被裁掉。
// 名字、介绍按语言各写一份（语言代码当键），介绍分段的写成数组。动效的第一帧要和不动时一样（见 frameDocument）。
export const FRAME_FORMAT = 'colorforces-frame';
const METADATA = /<metadata\b[^>]*>([\s\S]*?)<\/metadata>/i;
const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

// 读出一个头像框：{ meta, svg }。meta 是元数据（没写或读不出来时是 null），svg 是去掉元数据后的画。
export function readFrame(code) {
  const text = String(code).trim();
  const found = METADATA.exec(text);
  if (!found) return { meta: null, svg: text };
  const body = found[1].trim();
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(body);
  const json = cdata
    ? cdata[1]
    : body.replace(/&(lt|gt|amp|quot|apos);/g, (all, name) => ENTITIES[name]);
  let meta = null;
  try {
    meta = JSON.parse(json);
  } catch {
    meta = null;
  }
  const svg = text.slice(0, found.index) + text.slice(found.index + found[0].length);
  return { meta, svg };
}

// 按语言取一项（名字或介绍）：这门语言没有就用英文的，再没有用中文的，再没有就用写着的第一种。只写了一段文字的不分语言。
function pick(field, lang) {
  if (typeof field === 'string' || Array.isArray(field)) return field;
  if (!field || typeof field !== 'object') return undefined;
  return field[lang] ?? field.en ?? field.zh ?? Object.values(field)[0];
}
// 头像框的名字和介绍：[名字, 介绍]，介绍分段的是数组。没写名字时用 fallback（头像框的编号）。
export function frameText(meta, lang, fallback = '') {
  return [pick(meta?.name, lang) || fallback, pick(meta?.intro, lang) || ''];
}

// 做成图片用的 SVG：在最外层 <svg> 里最前面加一段样式 head（比如嵌进去的字体）。
// 不动的那张再加一条停掉所有动画的规则，所以动效的第一帧要和不动时一样。
const STILL = '*{animation:none!important}';
export function frameDocument(svg, moving, head = '') {
  const style = `<style>${head}${moving ? '' : STILL}</style>`;
  return svg.replace(/<svg\b[^>]*>/i, (open) => open + style);
}
