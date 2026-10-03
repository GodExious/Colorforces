let remembered;
// 根据站点主题与页面背景判断是否使用深色配色。
// 每个评分单元格取色时都会问一次，而判断本身要在整页里找两次节点、再读一次页面背景色；
// 榜单一页两百行时一轮渲染要问上千次。所以同一段同步代码里只判断一次，这段代码跑完后结果作废。
export const isDarkTheme = () => {
  if (remembered === undefined) {
    remembered = detectDarkTheme();
    queueMicrotask(() => {
      remembered = undefined;
    });
  }
  return remembered;
};

function detectDarkTheme() {
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
}
