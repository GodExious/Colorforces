// 用户分组在页面上的启动：用户名后面的分组标签，和好友名单的自动同步。
import { appSettings } from '../../../settings.js';
import { getCurrentUserHandle } from '../../page/account.js';
import { readAccount, friendsStale, subscribeGroups, syncFriends } from './data.js';
import { applyGroupTags, refreshGroupTags } from './tags.js';
import { refreshFrames } from '../frames/page.js';

const whenIdle = (run) =>
  typeof requestIdleCallback === 'function'
    ? requestIdleCallback(run, { timeout: 4000 })
    : setTimeout(run, 1500);

// 页面加载好之后调用一次。
export function startUserGroups() {
  // 分组变了（菜单里改的、别的标签页改的、好友同步到了新的）时，页面上的标签跟着变。
  subscribeGroups(() => {
    refreshGroupTags();
    refreshFrames();
  });
  applyGroupTags();
  // 好友名单：功能关着或没登录时不同步。正开着原站的好友页时直接读这一页，不另发请求；
  // 别的页面上，名单过了有效期才在空闲时去取一次。
  if (!appSettings.groups.enabled) return;
  const owner = getCurrentUserHandle();
  if (!owner) return;
  if (/^\/friends\/?$/.test(location.pathname)) {
    syncFriends({ html: document.documentElement.outerHTML });
    return;
  }
  if (friendsStale(readAccount(owner))) whenIdle(() => syncFriends());
}
