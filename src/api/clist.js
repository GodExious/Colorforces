// 优先使用油猴跨域请求访问 Clist，回退时携带登录 Cookie。
export function clistRequest(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const gmXhr =
      typeof GM_xmlhttpRequest === 'function'
        ? GM_xmlhttpRequest
        : typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function'
          ? GM.xmlHttpRequest
          : null;

    if (gmXhr) {
      gmXhr({
        method: 'GET',
        url: url,
        headers: headers,
        withCredentials: true,
        onload: (response) => {
          resolve({
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            statusText: response.statusText,
            json: () => Promise.resolve(JSON.parse(response.responseText)),
            text: () => Promise.resolve(response.responseText),
          });
        },
        onerror: (err) => {
          reject(new Error(err && err.error ? err.error : 'Network error (GM_xmlhttpRequest)'));
        },
        ontimeout: () => {
          reject(new Error('Request timeout'));
        },
      });
    } else {
      fetch(url, { headers, credentials: 'include' })
        .then((res) => resolve(res))
        .catch((err) => reject(err));
    }
  });
}
