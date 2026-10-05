import { appSettings } from '../../../settings.js';
import { customFormatTime } from '../../../utils/time.js';
import { displayTime } from './motion.js';
import { inPluginUi } from '../../page/plugin-ui.js';

// 识别页面中的时间文本，并按用户格式转换。
export function formatTimeStr(text) {
  if (!appSettings.appearance.timeFormat.enabled) return null;

  // Clean text for parsing
  const cleanText = text
    .replace(/UTC.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  let d = new Date(cleanText);
  if (isNaN(d.getTime())) {
    // Try parsing Codeforces format: MMM/DD/YYYY HH:MM
    const cfMatch = cleanText.match(
      /([A-Za-z]{3})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(:(\d{2}))?/,
    );
    if (cfMatch) {
      const months = {
        jan: 1,
        feb: 2,
        mar: 3,
        apr: 4,
        may: 5,
        jun: 6,
        jul: 7,
        aug: 8,
        sep: 9,
        oct: 10,
        nov: 11,
        dec: 12,
      };
      const m = months[cfMatch[1].toLowerCase()];
      if (m) {
        const hh = cfMatch[4].padStart(2, '0');
        const mm = cfMatch[5].padStart(2, '0');
        const ss = (cfMatch[7] || '00').padStart(2, '0');
        d = new Date(
          `${cfMatch[3]}-${String(m).padStart(2, '0')}-${String(cfMatch[2]).padStart(2, '0')}T${hh}:${mm}:${ss}`,
        );
      }
    }

    // Try parsing Russian format: DD.MM.YYYY HH:MM:SS
    const ruMatch = cleanText.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})(:(\d{2}))?/);
    if (ruMatch) {
      const hh = ruMatch[4].padStart(2, '0');
      const mm = ruMatch[5].padStart(2, '0');
      const ss = (ruMatch[7] || '00').padStart(2, '0');
      d = new Date(`${ruMatch[3]}-${ruMatch[2]}-${ruMatch[1]}T${hh}:${mm}:${ss}`);
    }
  }

  if (!isNaN(d.getTime())) {
    return customFormatTime(d, appSettings.appearance.timeFormat.format);
  }
  return null;
}

// 原站写时间的两种写法：英文界面的 May/24/2021 06:44，俄文界面的 24.05.2021 06:44，秒可有可无。
const SITE_TIME =
  /[A-Za-z]{3}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?|\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?/g;

// 把一段文字里原站写法的时间换成用户设置的格式，其余内容（比如后面的时区）不动。
// 没有时间、或没开启时间格式化时原样返回。
// 供悬停提示使用：「最后访问」「注册于」这类字段，原站把完整时间写在 title 里，页面上的时间节点里没有它。
export function formatTimesInText(text) {
  if (!text || !appSettings.appearance.timeFormat.enabled) return text;
  return text.replace(SITE_TIME, (time) => formatTimeStr(time) || time);
}

// 标记虚拟参赛时间节点，保留原始时间便于恢复。
export function wrapVirtualParticipationTime() {
  // 历史比赛将日期与时刻用 br 分开；只收集时区前的正文，不移动原生上标。
  for (const zone of document.querySelectorAll('sup.tz-superscript')) {
    const parent = zone.parentElement;
    if (
      parent.closest('.cf-formatted-time, .format-time, .format-date, .cf-table-time-cell') ||
      parent.querySelector('.cf-formatted-time, .format-time, .format-date')
    )
      continue;
    const range = document.createRange();
    range.setStart(parent, 0);
    range.setEndBefore(zone);
    const content = document.createElement('span');
    content.append(range.cloneContents());
    content.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
    if (
      !/^\s*(?:[A-Za-z]{3}\/\d{1,2}\/\d{4}|\d{2}\.\d{2}\.\d{4})\s+\d{1,2}:\d{2}(?::\d{2})?\s*$/.test(
        content.textContent,
      )
    )
      continue;
    content.className = 'cf-formatted-time';
    content.replaceChildren(range.extractContents());
    zone.before(content);
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  const nodes = [];
  const dateRegex =
    /([A-Za-z]{3}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?|\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?)/i;
  while (walker.nextNode()) {
    if (
      walker.currentNode.parentElement &&
      walker.currentNode.parentElement.closest(
        '.format-time, .format-date, .cf-formatted-time, .cf-table-time-cell',
      )
    ) {
      continue; // Skip already formatted text
    }
    // 插件自己的界面不处理。悬停提示会显示原站的时间（原站写在 title 里的完整日期），
    // 如果把它的文字拆开包一层，提示组件之后只更新自己的文字，这一层会留在所有提示里。
    if (inPluginUi(walker.currentNode.parentElement)) continue;
    if (dateRegex.test(walker.currentNode.nodeValue)) {
      nodes.push(walker.currentNode);
    }
  }
  nodes.forEach((node) => {
    const match = node.nodeValue.match(dateRegex);
    if (match) {
      const timeStr = match[1];
      const timeIndex = node.nodeValue.indexOf(timeStr);
      const afterTime = node.nodeValue.substring(timeIndex + timeStr.length);

      node.nodeValue = node.nodeValue.substring(0, timeIndex);

      const span = document.createElement('span');
      span.className = 'cf-formatted-time';
      span.textContent = timeStr;

      const afterNode = document.createTextNode(afterTime);

      node.parentNode.insertBefore(span, node.nextSibling);
      node.parentNode.insertBefore(afterNode, span.nextSibling);
    }
  });
}

// 比赛列表按列汇总一致的时区，原生上标留在 DOM 中供关闭设置时恢复。
function updateContestTimeHeaders() {
  if (!/^\/contests\/?$/.test(location.pathname)) return;
  for (const table of document.querySelectorAll('#pageContent table')) {
    const header = table.rows[0];
    if (!header) continue;
    const start = [...header.cells].find(
      (cell) =>
        cell.classList.contains('cf-contest-time-header') ||
        /^(Start|Начало)$/i.test(cell.textContent.trim()),
    );
    if (!start) continue;
    const cells = [...table.rows]
      .slice(1)
      .map((row) => row.cells[start.cellIndex])
      .filter(Boolean);
    const zones = cells.flatMap((cell) => [...cell.querySelectorAll('sup.tz-superscript')]);
    const offsets = [...new Set(zones.map((zone) => zone.textContent.trim()))];
    const uniform = offsets.length === 1 && /^UTC[+-]/i.test(offsets[0]);
    cells.forEach((cell) => cell.classList.toggle('cf-contest-start-cell', uniform));
    let label = start.querySelector('.cf-contest-time-zone');
    if (!uniform) {
      label?.remove();
      continue;
    }
    start.classList.add('cf-contest-time-header');
    if (!label) {
      label = document.createElement('span');
      label.className = 'cf-contest-time-zone cf-time-timezone-label';
      start.append(label);
    }
    if (label.textContent !== offsets[0]) label.textContent = offsets[0];
  }
}

// 刷新已识别时间节点，在关闭设置时恢复原内容。
export function applyTimeFormatting() {
  updateContestTimeHeaders();
  const timeSpans = document.querySelectorAll(
    '.format-time, .format-date, .cf-formatted-time, .cf-table-time-cell',
  );
  timeSpans.forEach((span) => {
    if (inPluginUi(span)) return;
    // 表格单元格可能包含真正的时间节点，不重复包装整格及其链接。
    if (span.querySelector('.format-time, .format-date, .cf-formatted-time')) return;
    const zone = span.querySelector('sup.tz-superscript');
    if (zone && zone.parentElement === span) {
      const content = document.createElement('span');
      content.className = 'cf-formatted-time';
      const range = document.createRange();
      range.setStart(span, 0);
      range.setEndBefore(zone);
      content.append(range.extractContents());
      zone.before(content);
      span = content;
    }
    span.classList.add('cf-formatted-time');
    const adjacentZone = span.nextElementSibling;
    if (
      adjacentZone?.matches('sup.tz-superscript') &&
      !span.parentElement.textContent
        .replace(span.textContent, '')
        .replace(adjacentZone.textContent, '')
        .trim()
    ) {
      span.parentElement.classList.add('cf-time-with-zone');
    }
    let origHTML = span.getAttribute('data-original-time');
    if (!origHTML) {
      origHTML = span.innerHTML;
      span.setAttribute('data-original-time', origHTML);
    }
    if (origHTML.length < 8) return;

    if (appSettings.appearance.timeFormat.enabled) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = origHTML;
      tempDiv.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
      const textContent = tempDiv.textContent.trim();
      const newTime = formatTimeStr(textContent);
      if (newTime) {
        tempDiv.textContent = newTime;
        displayTime(span, tempDiv.innerHTML);
        span.classList.remove('format-time', 'format-date');
      }
    } else if (span.querySelector(':scope > .cf-time-slot')) {
      displayTime(span, origHTML);
    }
  });
}
