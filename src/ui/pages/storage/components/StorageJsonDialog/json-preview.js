import { appStorage } from '../../../../../storage/gm.js';
import { PARALLEL_CONTESTS_KEY } from '../../../../../storage/keys.js';
import {
  getStorageItemBytes,
  formatStorageBytes,
} from '../../../../../features/storage/overview.js';
import { translate as t } from '../../../../../i18n/index.js';
// 为预览着色并限制高亮处理量，不改变用于复制的原始数据。
const formatJsonSyntaxHighlight = (json, forceTruncated = false) => {
  if (!json) return '';
  let displayStr = json;
  let isTruncated = forceTruncated;
  const MAX_CHARS = 25000;
  if (json.length > MAX_CHARS) {
    const cutIdx = json.lastIndexOf('\n', MAX_CHARS);
    displayStr = json.slice(0, cutIdx > 0 ? cutIdx : MAX_CHARS);
    isTruncated = true;
  }

  const escaped = displayStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const regex =
    /(\/\/[^\n]*|"([^"\\]|\\.)*"(?:\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let highlighted = escaped.replace(regex, (m) => {
    if (m.startsWith('//')) {
      return `<span class="cf-json-comment" style="color: #64748b; font-style: italic;">${m}</span>`;
    }
    if (m.charCodeAt(0) === 34) {
      if (m.endsWith(':')) {
        const colonIdx = m.lastIndexOf(':');
        const keyPart = m.slice(0, colonIdx);
        const colonPart = m.slice(colonIdx);
        return `<span class="cf-json-key">${keyPart}</span><span class="cf-json-punct">${colonPart}</span>`;
      }
      return `<span class="cf-json-string">${m}</span>`;
    }
    if (m === 'true' || m === 'false') {
      return `<span class="cf-json-boolean">${m}</span>`;
    }
    if (m === 'null') {
      return `<span class="cf-json-null">null</span>`;
    }
    return `<span class="cf-json-number">${m}</span>`;
  });

  if (isTruncated && !displayStr.includes('// ... [')) {
    const tipText = t('storageTruncatedTip');
    highlighted += `\n\n<span style="color: #64748b; font-style: italic;">// ... [${tipText}] ...</span>`;
  }

  return highlighted;
};
// 仅裁剪展示内容；targetKey 为 null 时直接展示整份文档，不套额外存储键。
export function buildPreview(targetKey, getContentForKeyFn, bytes) {
  let content;
  try {
    content =
      typeof getContentForKeyFn === 'function'
        ? getContentForKeyFn(targetKey)
        : appStorage.getJSON(targetKey, null);
  } catch (e) {
    content = { error: String(e) };
  }

  // 1. 获取完整项数与真实存储占用
  const count =
    content && typeof content === 'object'
      ? Object.keys(content).length
      : content !== null && content !== undefined
        ? 1
        : 0;
  let storageBytes = bytes ?? (targetKey === null ? 0 : getStorageItemBytes(targetKey));

  // 2. 切片构建轻量预览数据，彻底杜绝超大对象全量序列化造成的卡顿
  const PREVIEW_LIMIT = 60;
  const TRUNCATE_MARKER = '__CF_PREVIEW_TRUNCATED_MARKER__';
  let previewContent = content;
  let isTruncated = false;

  if (Array.isArray(content)) {
    if (content.length > PREVIEW_LIMIT) {
      previewContent = content.slice(0, PREVIEW_LIMIT);
      previewContent.push(TRUNCATE_MARKER);
      isTruncated = true;
    }
  } else if (content && typeof content === 'object') {
    const keys = Object.keys(content);
    if (keys.length > PREVIEW_LIMIT) {
      previewContent = {};
      for (let i = 0; i < PREVIEW_LIMIT; i++) {
        previewContent[keys[i]] = content[keys[i]];
      }
      previewContent[TRUNCATE_MARKER] = true;
      isTruncated = true;
    } else if (Array.isArray(content.solved) && content.solved.length > PREVIEW_LIMIT) {
      previewContent = {
        ...content,
        solved: [...content.solved.slice(0, PREVIEW_LIMIT), TRUNCATE_MARKER],
      };
      isTruncated = true;
    } else if (
      content.problems &&
      typeof content.problems === 'object' &&
      Object.keys(content.problems).length > PREVIEW_LIMIT
    ) {
      const pKeys = Object.keys(content.problems);
      const slicedProblems = {};
      for (let i = 0; i < PREVIEW_LIMIT; i++) {
        slicedProblems[pKeys[i]] = content.problems[pKeys[i]];
      }
      slicedProblems[TRUNCATE_MARKER] = true;
      previewContent = {
        ...content,
        problems: slicedProblems,
      };
      isTruncated = true;
    }
  }

  const displayPreviewObj =
    targetKey === null
      ? previewContent
      : {
          [targetKey]: previewContent !== undefined ? previewContent : null,
        };

  let previewJsonStr = JSON.stringify(displayPreviewObj, null, 2);
  if (isTruncated) {
    const tipText = t('storageTruncatedTip');
    previewJsonStr = previewJsonStr.replace(
      /([ \t]*)"__CF_PREVIEW_TRUNCATED_MARKER__"(?:\s*:\s*true)?/g,
      `$1// ... [${tipText}] ...`,
    );
  }
  if (targetKey === PARALLEL_CONTESTS_KEY || targetKey === 'cf_parallel_contests') {
    previewJsonStr = previewJsonStr.replace(/\[\s*([-\d\s,]+?)\s*\]/g, (match, nums) => {
      const compact = nums
        .split(/\s*,\s*/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(', ');
      return `[${compact}]`;
    });
  }

  if (bytes === undefined && (!storageBytes || storageBytes <= 0)) {
    storageBytes = new Blob([previewJsonStr]).size;
  }

  const highlightedHtml = formatJsonSyntaxHighlight(previewJsonStr, isTruncated);

  return {
    content,
    highlightedHtml,
    badgeText: t('storageItemCount', count) + ' · ' + formatStorageBytes(storageBytes),
  };
}
