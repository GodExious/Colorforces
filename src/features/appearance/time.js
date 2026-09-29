import { appSettings } from '../../settings.js';
import { customFormatTime } from '../../utils/time.js';
import { displayTime } from './time-motion.js';

// 识别页面中的时间文本，并按用户格式转换。
export function formatTimeStr(text) {
  if (!appSettings.timeFormat.enabled) return null;

  // Extract any UTC suffix (e.g. "UTC+8", "UTC-5", "UTC+3")
  let tzSuffix = '';
  const tzMatch = text.match(/UTC[+-]?\d*(:\d+)?/i);
  if (tzMatch) {
    tzSuffix = tzMatch[0].toUpperCase();
  }

  // Clean text for parsing
  let cleanText = text.replace(/UTC.*$/i, '').trim();

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
    return customFormatTime(d, appSettings.timeFormat.format);
  }
  return null;
}

// 标记虚拟参赛时间节点，保留原始时间便于恢复。
export function wrapVirtualParticipationTime() {
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

// 刷新已识别时间节点，在关闭设置时恢复原内容。
export function applyTimeFormatting() {
  const timeSpans = document.querySelectorAll(
    '.format-time, .format-date, .cf-formatted-time, .cf-table-time-cell',
  );
  timeSpans.forEach((span) => {
    span.classList.add('cf-formatted-time');
    let origHTML = span.getAttribute('data-original-time');
    if (!origHTML) {
      origHTML = span.innerHTML;
      span.setAttribute('data-original-time', origHTML);
    }
    if (origHTML.length < 8) return;

    if (appSettings.timeFormat.enabled) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = origHTML;
      const textContent = tempDiv.textContent.trim();
      const newTime = formatTimeStr(textContent);
      if (newTime) {
        displayTime(span, newTime);
        span.classList.remove('format-time', 'format-date');
      } else {
        displayTime(span, origHTML);
      }
    } else {
      displayTime(span, origHTML);
    }
  });
}
