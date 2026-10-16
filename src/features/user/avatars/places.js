// 头像显示在哪（设置里头像下面的「显示位置」）：表格里、右键菜单、分组管理、其他页面，各一个开关。
// 个人主页本来就有大照片，不在这里。总开关「显示用户头像」关着时哪儿都不显示。
// 页面上的头像（avatars/enhance.js）分表格和其他页面两处：隐藏的那一处不再新建头像、不戴头像框，
// 已经有的由样式收起（根元素上的 cf-hide-avatar-tables、cf-hide-avatar-others，见 appearance/dynamic-style.js）。
import { appSettings } from '../../../settings.js';

export const AVATAR_PLACES = ['tables', 'menus', 'groups', 'others'];
export const avatarShownAt = (place) =>
  appSettings.user.avatar.enabled && appSettings.user.avatar.showAt[place] !== false;
// 页面上的一个元素算哪一处：在表格里的算 tables，别处的算 others。
export const pagePlaceOf = (node) => (node.closest('table') ? 'tables' : 'others');
