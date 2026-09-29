import { SCRIPT_UPDATE_URL, SCRIPT_FALLBACK_UPDATE_URL } from '../config/release.js';

// 请求单个发布地址，保留超时与油猴备用请求策略。
async function fetchVersionAt(sourceUrl) {
  const url = sourceUrl + '?t=' + Date.now();
  let text = '';
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null;

  // 优先读取脚本头部，避免不必要的完整下载。
  try {
    const res = await fetch(url, {
      headers: { Range: 'bytes=0-2048' },
      signal: controller ? controller.signal : undefined,
    });
    if (res.ok || res.status === 206) {
      text = await res.text();
      if (!readVersion(text)) text = '';
    }
  } catch {
    // 网络错误或超时后继续尝试油猴请求。
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }

  // 普通请求没有有效版本时，使用油猴跨域请求兜底。
  if (!text && typeof GM_xmlhttpRequest === 'function') {
    try {
      text = await new Promise((resolve) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          headers: { Range: 'bytes=0-2048' },
          timeout: 10000,
          onload: (r) => resolve(r.status === 200 || r.status === 206 ? r.responseText || '' : ''),
          onerror: () => resolve(''),
          ontimeout: () => resolve(''),
          onabort: () => resolve(''),
        });
      });
    } catch {
      // 当前地址不可用时，交由上层尝试旧发布地址。
    }
  }

  return readVersion(text);
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
