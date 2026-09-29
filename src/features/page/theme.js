// 根据站点主题与页面背景判断是否使用深色配色。
export const isDarkTheme = () => {
  // Dark Reader will handle inverting our light colors automatically as long as we don't use !important
  if (document.querySelector('.darkreader') || document.querySelector('meta[name="darkreader"]'))
    return false;
  if (
    document.documentElement.getAttribute('data-theme') === 'dark' ||
    (document.body && document.body.classList.contains('dark'))
  )
    return true;
  try {
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    const match = bodyBg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const brightness =
        (parseInt(match[1]) * 299 + parseInt(match[2]) * 587 + parseInt(match[3]) * 114) / 1000;
      if (brightness < 128) return true;
    }
  } catch (e) {}
  return false;
};
