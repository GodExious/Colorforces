// 从页头登录链接识别当前账号；未登录时返回 null。
export function getCurrentUserHandle() {
  const userLink = document.querySelector(
    '#header .lang-chooser a[href^="/profile/"], #header a[href^="/profile/"]',
  );
  return userLink ? userLink.textContent.trim() : null;
}
