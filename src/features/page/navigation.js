const menuSelector = '.second-level-menu-list, .main-menu-list';
// 逐组对齐原站已有指示条；没有灰条的主导航保持原样。
export function syncSecondLevelMenuLava() {
  for (const menu of document.querySelectorAll(menuSelector)) {
    const items = [...menu.children].filter((item) => !item.classList.contains('backLava'));
    const active =
      items.find((item) => item.matches(':hover')) ||
      items.find((item) => item.classList.contains('selectedLava')) ||
      items.find((item) => item.classList.contains('current'));
    const lava = menu.querySelector(':scope > li.backLava');
    if (!active || !lava || active.offsetWidth === 0) continue;
    for (const [key, value] of Object.entries({
      width: active.offsetWidth,
      left: active.offsetLeft,
      height: active.offsetHeight,
      top: active.offsetTop,
    })) {
      if (lava.style[key] !== value + 'px') lava.style[key] = value + 'px';
    }
  }
}

let stopObserving;
// 共用观察器监听所有短导航组，不轮询、不观察页面正文，排除灰条自身避免循环。
export function observeSecondLevelMenu() {
  if (stopObserving) return stopObserving;
  const roots = new Set(
    [...document.querySelectorAll(menuSelector)].map((menu) => menu.parentElement),
  );
  if (!roots.size) return () => {};
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      syncSecondLevelMenuLava();
    });
  };
  const resize = new ResizeObserver(schedule);
  const observeItems = () => {
    resize.disconnect();
    for (const root of roots) {
      resize.observe(root);
      for (const menu of root.querySelectorAll(menuSelector)) {
        resize.observe(menu);
        [...menu.children]
          .filter((item) => !item.classList.contains('backLava'))
          .forEach((item) => resize.observe(item));
      }
    }
    schedule();
  };
  const changes = new MutationObserver((records) => {
    const relevant = records.filter((record) => !record.target.closest('.backLava'));
    if (!relevant.length) return;
    if (relevant.some((record) => record.type === 'childList')) observeItems();
    else schedule();
  });
  for (const root of roots) {
    changes.observe(root, {
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    });
  }
  observeItems();
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  document.fonts?.addEventListener('loadingdone', schedule);
  stopObserving = () => {
    resize.disconnect();
    changes.disconnect();
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('resize', schedule);
    document.fonts?.removeEventListener('loadingdone', schedule);
    stopObserving = null;
  };
  window.addEventListener('pagehide', stopObserving, { once: true });
  return stopObserving;
}
