// 认管理员。管理员在接口里没有段位（查到的是未评级），只能从页面上认。
// 页面上的头像框（page.js）和右键菜单（UserMenu）都按这里的结果戴管理员的头像框。
import { profileHandle, userId } from '../groups/store.js';
import { rankFromTitle } from './choose.js';

const USER_LINK = 'a[href*="/profile/"]';

// 这一页上哪些人是管理员（小写名字）。管理员在接口里没有段位，只能从页面上认：名字带 user-admin 类、
// 名字的提示写着 Headquarters，或者正开着他的主页、名字上面那一行写着 Headquarters。
// 认出来的对这一页上他所有的头像都算数（导航栏里的名字只是普通的链接，自己认不出来）。
export function pageAdmins() {
  const admins = new Set();
  for (const link of document.querySelectorAll(
    `${USER_LINK}.user-admin, ${USER_LINK}[title^="Headquarters"]`,
  )) {
    const handle = profileHandle(link.getAttribute('href'));
    if (
      handle &&
      (link.classList.contains('user-admin') ||
        rankFromTitle(link.title, handle) === 'headquarters')
    )
      admins.add(userId(handle));
  }
  const owner = profileHandle(location.pathname);
  const rankLine = document
    .querySelector('.main-info .user-rank')
    ?.textContent.trim()
    .toLowerCase();
  if (owner && rankLine === 'headquarters') admins.add(userId(owner));
  return admins;
}
// 这个人在这一页上是不是管理员。
export const adminOnPage = (handle) => Boolean(handle) && pageAdmins().has(userId(handle));
