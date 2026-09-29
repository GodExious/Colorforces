// 用户名链接才代表成员；插件生成的头像链接不能参与人数判断。
export function getProfileLinks(cell) {
  return [...cell.querySelectorAll('a[href*="/profile/"]:not(.cf-avatar-container)')];
}

// 依据原站队伍链接、幽灵标记或多个成员判断，不依赖可能过期的增强样式类。
export function isTeamCell(cell) {
  return (
    !!cell.querySelector('a[href*="/team/"], img[src*="ghost.png"]') ||
    getProfileLinks(cell).length > 1
  );
}
