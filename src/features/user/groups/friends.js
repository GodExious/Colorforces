// 从原站「我的好友」页面（/friends）的源码里读出好友名单，从个人主页的源码里读出关注用的那颗星。
// 只认页面的写法，不碰存储和网络。
// 那一页是一张表，一行一个好友：
//   <tr> <td>1</td>
//     <td><a href="/profile/名字" class="rated-user user-orange">名字</a></td>
//     <td><img class="removeFriend friendStar" friendUserId="77498" .../></td> </tr>
// 星标上的 friendUserId 是原站的用户编号，关注和取消关注时要用它。
import { isHandle } from './store.js';

const ROW = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const STAR = /<img\b[^>]*\bfriendStar\b[^>]*>/i;
const PROFILE = /href=["']\/profile\/([^"'?#]+)["']/i;
const escapePattern = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 返回 [{ handle, id }]，先后和页面上一样。星标是「已关注」（removeFriend）的那些行才算；
// 名字不像账号的行跳过，编号读不出来的记成 0。
export function parseFriendsPage(html) {
  const friends = [];
  const seen = new Set();
  for (const [, row] of String(html || '').matchAll(ROW)) {
    const star = STAR.exec(row)?.[0];
    if (!star || !/\bremoveFriend\b/.test(star)) continue;
    let handle = PROFILE.exec(row)?.[1] || '';
    try {
      handle = decodeURIComponent(handle);
    } catch {
      continue;
    }
    if (!isHandle(handle) || seen.has(handle.toLowerCase())) continue;
    seen.add(handle.toLowerCase());
    friends.push({ handle, id: Number(/\bfriendUserId=["'](\d+)["']/i.exec(star)?.[1]) || 0 });
  }
  return friends;
}

// 个人主页上，名字后面紧跟着一颗星：
//   <a href="/profile/名字" title="Master 名字" class="rated-user user-orange">名字</a>
//   <img class="addFriend friendStar" friendUserId="1234" .../>
// 没关注的是 addFriend，已关注的是 removeFriend。读出 { handle, id, following }；
// 页面上没有这样的一颗星时返回 null：没有这个用户（原站会转到别的页面）、是自己的主页、或者没登录。
const PROFILE_STAR =
  /<a\b[^>]*\bhref=["']\/profile\/([^"'?#]+)["'][^>]*>(?:(?!<\/a>)[\s\S]){0,200}<\/a>\s*(<img\b[^>]*\bfriendStar\b[^>]*>)/i;
export function parseProfileStar(html) {
  const match = PROFILE_STAR.exec(String(html || ''));
  if (!match) return null;
  let handle = '';
  try {
    handle = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  const id = Number(/\bfriendUserId=["'](\d+)["']/i.exec(match[2])?.[1]) || 0;
  if (!isHandle(handle) || !id) return null;
  return { handle, id, following: /\bremoveFriend\b/.test(match[2]) };
}

// 这份源码是不是 owner 这个账号登录着时取到的页面：页面上有指向 owner 主页的链接（页头的账号名），
// 而且不是登录页。没登录时访问 /friends 会被转到登录页，那时读出零个好友不能当成好友被清空了。
export function isOwnPage(html, owner) {
  const page = String(html || '');
  if (!isHandle(owner) || /\bid=["']enterForm["']/.test(page)) return false;
  return new RegExp(`href=["']/profile/${escapePattern(owner)}["']`, 'i').test(page);
}
