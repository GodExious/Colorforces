import { appStorage } from '../../../storage/gm.js';
import { AVATAR_CACHE_KEY } from '../../../storage/keys.js';

// 头像加载失败时使用的站点默认图片。
export { DEFAULT_AVATAR_URL } from '../../../assets/remote.js';

// 将头像地址规范为可访问的 Codeforces 反代地址。
export function normalizeAvatarUrl(url) {
  if (!url) return '';
  // 核心修复：直连 userpic.codeforces.org 返回 503 Service Unavailable，必须走 codeforces.com 反代路径
  if (url.includes('userpic.codeforces.org')) {
    return url.replace(
      /^(?:https?:)?\/\/userpic\.codeforces\.org\//,
      'https://codeforces.com/userpic.codeforces.org/',
    );
  }
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return 'https://codeforces.com' + url;
  return url;
}

// 保存已验证可加载的头像地址。
export function updateAvatarCacheUrl(handle, workingUrl) {
  if (!handle || !workingUrl) return;
  try {
    const cache = appStorage.getJSON(AVATAR_CACHE_KEY, null);
    if (cache && cache[handle]) {
      cache[handle].url = workingUrl;
      appStorage.setJSON(AVATAR_CACHE_KEY, cache);
    }
  } catch (e) {}
}
