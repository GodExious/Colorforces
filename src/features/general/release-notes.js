// 从仓库的更新日志文档（docs/CHANGELOG.md 和 CHANGELOG_zh.md）里读出各版本的更新内容，给更新提示用。
// 纯计算，不发请求。

// 分类标题对应的类别，决定标签的颜色。文档是哪种语言就认哪种写法。
const SECTION_TYPES = {
  新增: 'added',
  优化: 'optimized',
  修复: 'fixed',
  公告: 'announcement',
  Added: 'added',
  Optimized: 'optimized',
  Fixed: 'fixed',
  Announcement: 'announcement',
};

// 文档的写法：「### v1.8.0」起一个版本，下一行反引号里是发布时间（`2026-10-06 00:22 UTC+8`），
// 「**新增**」起一个分类，下面「1. ……」逐条列出。
// 返回 [{ version, date, sections: [{ type, title, items }] }]，顺序同文档（新的在前）。
// version 不带开头的 v；date 是发布时间里的日期（2026-10-06），文档里没写时是空字符串；
// title 是分类标题的原文；认不出的分类 type 是空字符串。
// 没有条目的分类、没有分类的版本不列出。
export function parseReleaseNotes(markdown) {
  const notes = [];
  let note = null;
  let section = null;
  for (const raw of String(markdown || '').split(/\r?\n/)) {
    const line = raw.trim();
    const version = line.match(/^#{2,4}\s*v\s*([0-9]+(?:\.[0-9]+)*)$/i);
    if (version) {
      note = { version: version[1], date: '', sections: [] };
      notes.push(note);
      section = null;
      continue;
    }
    if (!note) continue;
    // 发布时间紧跟在版本标题后面，分类开始之后的反引号内容不算。
    const date = !note.sections.length && line.match(/^`(\d{4}-\d{2}-\d{2})\b[^`]*`$/);
    if (date) {
      note.date = date[1];
      continue;
    }
    const title = line.match(/^\*\*(.+?)\*\*$/);
    if (title) {
      const text = title[1].trim();
      section = { type: SECTION_TYPES[text] || '', title: text, items: [] };
      note.sections.push(section);
      continue;
    }
    const item = line.match(/^(?:\d+\.|[-*])\s+(.+)$/);
    if (item && section) section.items.push(item[1]);
  }
  return notes
    .map((entry) => ({
      ...entry,
      sections: entry.sections.filter((part) => part.items.length),
    }))
    .filter((entry) => entry.sections.length);
}

// 把一条更新内容拆成几段：普通文字 { text }、`代码` { code }、[文字](链接) { text, href }。
// 界面按段画，文档里的文字始终当文字显示，不当成网页代码；链接只认 http 和 https 开头的。
export function splitInline(text) {
  const source = String(text || '');
  const parts = [];
  let last = 0;
  for (const match of source.matchAll(/`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)) {
    if (match.index > last) parts.push({ text: source.slice(last, match.index) });
    parts.push(match[1] !== undefined ? { code: match[1] } : { text: match[2], href: match[3] });
    last = match.index + match[0].length;
  }
  if (last < source.length) parts.push({ text: source.slice(last) });
  return parts;
}
