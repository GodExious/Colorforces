// 从页头登录链接识别当前账号；未登录时返回 null。
export function getCurrentUserHandle() {
  const userLink = document.querySelector(
    '#header .lang-chooser a[href^="/profile/"], #header a[href^="/profile/"]',
  );
  return userLink ? userLink.textContent.trim() : null;
}
// 页面上的防伪令牌：原站自己往服务器提交东西时都带着它。找不到时返回空串。
export function getCsrfToken() {
  return (
    document.querySelector('meta[name="X-Csrf-Token"]')?.content ||
    document.querySelector('.csrf-token')?.dataset.csrf ||
    ''
  );
}
