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

// 接口（user.info）返回的一个人 → 头像缓存里的一条。页面上的头像、分组的成员、右键菜单的名片共用这一份缓存：
//   url、fallbackUrl 小头像和主页大图；time 什么时候查的；rank、maxRank 现在和到过的最高段位（未评级的是空串）；
//   rating 评分（未评级的是 null）；maxRating 到过的最高分（未评级的是 null）、contribution 贡献、
//   friends 被多少人关注、registered 注册的时间（秒）——这四项是右键菜单名片上的资料。
// rating 以后的几项都是后来加的，旧的条目里没有。四项资料的补法：页面上查头像时顺带重新查（见 enhance.js），
// 右键菜单打开时还缺就单独查那一个人（见 UserMenu）。
export const avatarEntry = (user, time) => ({
  url: normalizeAvatarUrl(user.avatar),
  fallbackUrl: normalizeAvatarUrl(user.titlePhoto),
  time,
  rank: user.rank || '',
  maxRank: user.maxRank || '',
  rating: Number.isFinite(user.rating) ? user.rating : null,
  maxRating: Number.isFinite(user.maxRating) ? user.maxRating : null,
  contribution: Number.isFinite(user.contribution) ? user.contribution : 0,
  friends: Number.isFinite(user.friendOfCount) ? user.friendOfCount : 0,
  registered: Number.isFinite(user.registrationTimeSeconds) ? user.registrationTimeSeconds : 0,
});

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
