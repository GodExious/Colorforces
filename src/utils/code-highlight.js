// 代码上色：SVG 的标签、属性、值，<style> 里的 CSS，<metadata> 里的 JSON，还有 AI 回答里的 ``` 和说明文字。
// 输出带 <span class="cf-code-…"> 的 HTML，颜色由样式里的 --cf-code-* 变量决定（见 CodeBox 组件），
// 以后做主题时只改这几个变量。上色只是把原文切开包上标签：去掉标签、还原转义后和原文一字不差，
// 代码框靠这一点让上色的那层和底下输入框里的字对齐。
const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char],
  );
const span = (kind, text) => `<span class="cf-code-${kind}">${escapeHtml(text)}</span>`;

function highlightCss(text) {
  return text.replace(
    /(@[\w-]+)|(\.[\w-]+)|([a-z-]+)(?=\s*:)|(-?\d*\.?\d+(?:px|deg|ms|s|%)?)|([^@.a-z\d-]+|[\s\S])/gi,
    (all, at, selector, property, number) =>
      at
        ? span('at', at)
        : selector
          ? span('selector', selector)
          : property
            ? span('property', property)
            : number
              ? span('number', number)
              : escapeHtml(all),
  );
}
function highlightJson(text) {
  return text.replace(
    /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)|([\s\S])/g,
    (all, string, colon, number) =>
      string
        ? colon
          ? span('key', string) + escapeHtml(colon)
          : span('string', string)
        : number
          ? span('number', number)
          : escapeHtml(all),
  );
}
function highlightTag(text) {
  return text.replace(
    /^(<\/?)([\w:-]+)|([\w:-]+)(=)("[^"]*"|'[^']*')|(\/?>)$|([\s\S])/g,
    (all, open, name, attribute, equals, value, close) =>
      open
        ? span('punct', open) + span('tag', name)
        : attribute
          ? span('attr', attribute) + escapeHtml(equals) + span('string', value)
          : close
            ? span('punct', close)
            : escapeHtml(all),
  );
}
// 一段 SVG（或者 AI 的整段回答）上好色的 HTML。
export function highlightSvg(text) {
  let out = '';
  let inStyle = false;
  let last = 0;
  const token = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[a-zA-Z][^<>]*>|```[\w-]*/g;
  const plain = (part) =>
    inStyle ? highlightCss(part) : part.trim() ? span('text', part) : escapeHtml(part);
  for (let match; (match = token.exec(text));) {
    out += plain(text.slice(last, match.index));
    const piece = match[0];
    if (piece.startsWith('<!--')) out += span('comment', piece);
    else if (piece.startsWith('<![CDATA['))
      out +=
        span('punct', '<![CDATA[') +
        (inStyle ? highlightCss : highlightJson)(piece.slice(9, -3)) +
        span('punct', ']]>');
    else if (piece.startsWith('```')) out += span('fence', piece);
    else {
      out += highlightTag(piece);
      if (/^<style\b/i.test(piece)) inStyle = true;
      if (/^<\/style/i.test(piece)) inStyle = false;
    }
    last = token.lastIndex;
  }
  return out + plain(text.slice(last));
}

// 把上好色的 HTML 按行切开：跨行的那一段（注释、元数据里的 JSON 这类）在行尾先关上，下一行开头再接着开。
// 代码框只画看得见的那几十行，靠它一行一行地取。
export function splitLines(html) {
  const lines = [];
  let line = '';
  let open = '';
  const piece = /<span class="(cf-code-[\w-]+)">|<\/span>|\n|[^<\n]+/g;
  for (let match; (match = piece.exec(html));) {
    if (match[0] === '\n') {
      lines.push(line + (open ? '</span>' : ''));
      line = open ? `<span class="${open}">` : '';
    } else {
      if (match[1]) open = match[1];
      else if (match[0] === '</span>') open = '';
      line += match[0];
    }
  }
  lines.push(line + (open ? '</span>' : ''));
  return lines;
}

// 看得见的是第几行到第几行（从 0 数，不含 last）：按滚动的距离、框里的高度、行高、上边的留白算，上下各多留 spare 行。
export function visibleRange({ scrollTop, height, total, line, padding = 0, spare = 12 }) {
  const first = Math.max(0, Math.floor((scrollTop - padding) / line) - spare);
  const last = Math.min(total, Math.ceil((scrollTop - padding + height) / line) + spare);
  return [first, Math.max(first, last)];
}
