import {
  SCRIPT_UPDATE_URL,
  SCRIPT_FALLBACK_UPDATE_URL,
  CHANGELOG_URLS,
} from '../config/release.js';

// 请求一个地址的文字内容，保留超时与油猴备用请求策略。
// valid(text) 判断内容合不合格（错误页也可能正常返回）；range 给了就只取开头这么多字节。
// 两种请求都拿不到合格的内容时返回空字符串。
async function requestText(sourceUrl, { valid, range = 0, timeout = 10000 }) {
  const url = sourceUrl + '?t=' + Date.now();
  const headers = range ? { Range: 'bytes=0-' + range } : {};
  let text = '';
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeout) : null;

  try {
    const res = await fetch(url, { headers, signal: controller ? controller.signal : undefined });
    if (res.ok || res.status === 206) {
      text = await res.text();
      if (!valid(text)) text = '';
    }
  } catch {
    // 网络错误或超时后继续尝试油猴请求。
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }

  // 普通请求没有合格的内容时，使用油猴跨域请求兜底。
  if (!text && typeof GM_xmlhttpRequest === 'function') {
    try {
      text = await new Promise((resolve) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          headers,
          timeout,
          onload: (r) => resolve(r.status === 200 || r.status === 206 ? r.responseText || '' : ''),
          onerror: () => resolve(''),
          ontimeout: () => resolve(''),
          onabort: () => resolve(''),
        });
      });
    } catch {
      // 当前地址不可用时，交由上层处理。
    }
  }

  return valid(text) ? text : '';
}

// 请求单个发布地址。优先读取脚本头部，避免不必要的完整下载。
async function fetchVersionAt(sourceUrl) {
  return readVersion(await requestText(sourceUrl, { valid: readVersion, range: 2048 }));
}

// 只解析脚本元数据中的数字版本，排除错误页和正文内容。
function readVersion(text) {
  if (!text) return null;
  text = text.slice(0, 2048).split('// ==UserScript==')[1]?.split('// ==/UserScript==')[0];
  if (!text) return null;
  const match = text.slice(0, 2048).match(/\/\/\s*@version\s+([0-9\.]+)/i);
  return match && /^[0-9]+(?:[.][0-9]+)*$/.test(match[1]) ? match[1] : null;
}

// Release 有效时以其为准；无有效发布附件时才检查根目录兼容地址。
export async function fetchRemoteRelease() {
  for (const url of [SCRIPT_UPDATE_URL, SCRIPT_FALLBACK_UPDATE_URL]) {
    const version = await fetchVersionAt(url);
    if (version) return { version, url };
  }
  return null;
}

// 仓库里某种语言的更新日志文档，给更新提示列出更新内容用；取不到时返回空字符串。
// 它不是必需的，等的时间比检查版本短一些。
export function fetchChangelogText(lang) {
  return requestText(CHANGELOG_URLS[lang], {
    valid: (text) => /^#{2,4}\s*v\s*[0-9]/im.test(text || ''),
    timeout: 6000,
  });
}
