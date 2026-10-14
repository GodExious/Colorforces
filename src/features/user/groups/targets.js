// 右键菜单认人：鼠标下的东西是不是页面上某个用户的「头像 + 用户名」，是的话是谁。
// 算的有：用户名的链接、头像功能加的头像、头像那一行里名字前后的小记号和空隙，以及用户名后面的分组标签。
// 插件自己的界面里只认标了 data-cf-user-menu（值是账号名）的元素，比如分组管理弹窗里成员的名字和头像。
import { PLUGIN_UI_SELECTOR } from '../../page/plugin-ui.js';
import { groupTagAt } from './tags.js';
import { isHandle, profileHandle } from './store.js';

const USER_LINK = 'a[href*="/profile/"]';
const AVATAR_LINK = 'cf-avatar-container';

// 一个主页链接算不算这个用户的名字或头像：头像功能加的头像链接算；别的链接要文字就是账号名才算
// （「查看主页」这类写着别的字的不算）。算的话返回 { handle, href }，href 是链接的完整地址。
function userOf(link) {
  const handle = profileHandle(link.getAttribute('href'));
  if (!handle) return null;
  if (
    !link.classList.contains(AVATAR_LINK) &&
    link.textContent.trim().toLowerCase() !== handle.toLowerCase()
  )
    return null;
  return { handle, href: link.href };
}

// element 是鼠标下的元素，x 是鼠标的横坐标（认分组标签用）。是某个用户时返回 { handle, href }，否则 null。
export function userAt(element, x) {
  if (!element?.closest) return null;
  if (element.closest(PLUGIN_UI_SELECTOR)) {
    const own = element.closest('[data-cf-user-menu]');
    const handle = own?.getAttribute('data-cf-user-menu') || '';
    return isHandle(handle)
      ? { handle, href: new URL('/profile/' + encodeURIComponent(handle), location.origin).href }
      : null;
  }
  const link = element.closest(USER_LINK);
  if (link) return userOf(link);
  // 不在链接上：在头像那一行里（名字和头像之间的空隙、名字后面的小记号、分组标签），
  // 或者在别的元素上画着的分组标签上（表格的格子、名字的链接以外的那一层）。认的是里面唯一的那个用户。
  const line = element.closest('.cf-avatar-line-wrapper');
  const host =
    line || (element.hasAttribute('data-cf-group') && groupTagAt(element, x) ? element : null);
  if (!host) return null;
  const users = [...host.querySelectorAll(`${USER_LINK}:not(.${AVATAR_LINK})`)]
    .map(userOf)
    .filter(Boolean);
  return users.length === 1 ? users[0] : null;
}
