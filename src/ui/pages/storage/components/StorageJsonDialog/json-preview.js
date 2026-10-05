import { appStorage } from '../../../../../storage/gm.js';
import { ANALYTICS_KEY, PARALLEL_CONTESTS_KEY } from '../../../../../storage/keys.js';
import {
  getStorageItemBytes,
  formatStorageBytes,
} from '../../../../../features/storage/overview.js';
import { translate as t } from '../../../../../i18n/index.js';
import { stringifyCompact, trimPreview } from '../../../../../utils/json.js';
// 预览里被省掉的内容用这个标记占位（数组里是一项，对象里是一个键），生成文字后换成「已截断」的说明。
export const TRUNCATE_MARKER = '__CF_PREVIEW_TRUNCATED_MARKER__';
// 这些键里有大量纯数字的小数组（平行比赛的编号、数据分析的每条提交记录），这样的数组各写成一行。
const COMPACT_KEYS = new Set([PARALLEL_CONTESTS_KEY, ANALYTICS_KEY]);
// 把某个键的数据写成带缩进的 JSON 文字，预览和复制都用它。
export const stringifyStored = (key, value) =>
  COMPACT_KEYS.has(key) ? stringifyCompact(value) : JSON.stringify(value, null, 2);
// 为预览着色并限制高亮处理量，不改变用于复制的原始数据。
const formatJsonSyntaxHighlight = (json, forceTruncated = false) => {
  if (!json) return '';
  let displayStr = json;
  let isTruncated = forceTruncated;
  // 预览最多显示这么多字。字数越多，着色后要放进页面的元素越多，切换时越慢。
  const MAX_CHARS = 16000;
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

  // 各处省掉的地方只有一个省略号，完整的说明在整段的末尾写一次。
  if (isTruncated) {
    const tipText = t('storageTruncatedTip');
    highlighted += `\n\n<span style="color: #64748b; font-style: italic;">// ... [${tipText}] ...</span>`;
  }

  return highlighted;
};
// 仅裁剪展示内容，展示时把数据套在它的存储键下面。
// previewOf(key, content) 可选：结构特殊、按通用规则截不好的数据，由调用方自己给出缩略版和项数，
// 返回 { content, count }；不需要时返回 null。
export function buildPreview(targetKey, getContentForKeyFn, previewOf) {
  let content;
  try {
    content =
      typeof getContentForKeyFn === 'function'
        ? getContentForKeyFn(targetKey)
        : appStorage.getJSON(targetKey, null);
  } catch (e) {
    content = { error: String(e) };
  }

  let custom = null;
  try {
    custom = typeof previewOf === 'function' ? previewOf(targetKey, content) : null;
  } catch (e) {
    custom = null;
  }

  // 1. 获取完整项数与真实存储占用
  const count =
    custom?.count ??
    (content && typeof content === 'object'
      ? Object.keys(content).length
      : content !== null && content !== undefined
        ? 1
        : 0);
  let storageBytes = getStorageItemBytes(targetKey);

  // 2. 先做一份缩略版再写成文字：不管数据是什么形状、有多大，写出来的都只是一小段，不会把整份数据都写一遍。
  // 小的数据（比如设置）不截，原样显示；大的每一层只留开头的若干项，见 trimPreview。
  let previewContent;
  try {
    previewContent = custom ? custom.content : trimPreview(content, TRUNCATE_MARKER);
  } catch (e) {
    previewContent = content;
  }

  const displayPreviewObj = {
    [targetKey]: previewContent !== undefined ? previewContent : null,
  };

  let previewJsonStr = stringifyStored(targetKey, displayPreviewObj);
  // 缩略版里有没有省掉东西，看里面有没有占位的标记。
  const isTruncated = previewJsonStr.includes(TRUNCATE_MARKER);
  // 省掉的地方可能有很多处（每一层都可能截），各写成一个省略号；完整的说明由着色那一步在末尾写一次。
  if (isTruncated) {
    previewJsonStr = previewJsonStr.replace(
      /([ \t]*)"__CF_PREVIEW_TRUNCATED_MARKER__"(?:\s*:\s*true)?/g,
      '$1// ...',
    );
  }
  if (!storageBytes || storageBytes <= 0) {
    storageBytes = new Blob([previewJsonStr]).size;
  }

  const highlightedHtml = formatJsonSyntaxHighlight(previewJsonStr, isTruncated);

  return {
    content,
    highlightedHtml,
    badgeText: t('storageItemCount', count) + ' · ' + formatStorageBytes(storageBytes),
  };
}
