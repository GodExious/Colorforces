// 做头像框的提示词：用户写下想法，复制它发给 AI，AI 回一段代码贴回来。用插件当前的界面语言写；
// 这门语言还没有提示词时用英文的。每种语言一个文件（zh.js、en.js），拿到的东西一样，见 zh.js。
// 想法前后包着标记，查看全文时把想法那一段标出来（promptParts）；复制的是去掉标记的（promptText）。
import { languages } from '../../../../../i18n/languages.js';
import zh from './zh.js';
import en from './en.js';

const TEMPLATES = { zh, en };
// 一次最多让 AI 给几个方案：再多回答太长，有的 AI 写不完。
export const MAX_DESIGNS = 5;
const OPEN = '<<IDEA>>';
const CLOSE = '<</IDEA>>';

// lang 界面语言；idea 想法；motion 要不要动效；code 现在的代码（编辑一个头像框时有，新建时是空串）；
// count 要几个方案（1～MAX_DESIGNS，不是整数的当 1 个）。
export function framePrompt(lang, { idea = '', motion = true, code = '', count = 1 } = {}) {
  const template = TEMPLATES[lang] || en;
  const lines = template({
    idea: (empty) => OPEN + (idea.trim() || empty) + CLOSE,
    motion,
    code: code.trim(),
    count: Number.isInteger(count) ? Math.min(MAX_DESIGNS, Math.max(1, count)) : 1,
    languages: languages.map(({ code: id, label }) => ({ code: id, label })),
  });
  // 连着的空行只留一行（编辑、不要动效时有几段是空的）。
  return lines.filter((line, index) => line !== '' || lines[index - 1] !== '').join('\n');
}
// 复制用的：去掉想法前后的标记。
export const promptText = (text) => text.replace(OPEN, '').replace(CLOSE, '');
// 查看用的：[想法前面, 想法, 想法后面]。
export function promptParts(text) {
  const start = text.indexOf(OPEN);
  const end = text.indexOf(CLOSE);
  if (start < 0 || end < start) return [text, '', ''];
  return [
    text.slice(0, start),
    text.slice(start + OPEN.length, end),
    text.slice(end + CLOSE.length),
  ];
}
