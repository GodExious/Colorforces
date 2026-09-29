// 浮层到达滚动边界时阻止滚动传递给底层页面。
export function preventScrollChaining(element) {
  if (!element) return;

  // 保留链接的中键开新标签行为，仅阻止非链接区域触发自动滚屏。
  const preventMiddleClick = (e) => {
    if (e.button !== 1) return;
    const target = e.target instanceof Element ? e.target : e.target?.parentElement;
    const link = target?.closest('a[href], area[href]');
    if (link && element.contains(link)) return;
    e.preventDefault();
  };
  element.addEventListener('mousedown', preventMiddleClick);
  element.addEventListener('auxclick', preventMiddleClick);

  // 2. Prevent mouse wheel scroll penetration to background page
  element.addEventListener(
    'wheel',
    (e) => {
      let target = e.target;
      let scrollableY = null;
      let scrollableX = null;

      while (target) {
        if (target.nodeType === 1) {
          const style = window.getComputedStyle(target);
          if (
            !scrollableY &&
            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            target.scrollHeight > target.clientHeight
          ) {
            scrollableY = target;
          }
          if (
            !scrollableX &&
            (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
            target.scrollWidth > target.clientWidth
          ) {
            scrollableX = target;
          }
          if (scrollableY && scrollableX) break;
        }
        if (target === element) break;
        target = target.parentElement;
      }

      const deltaY = e.deltaY;
      const deltaX = e.deltaX;

      let canScrollY = false;
      if (scrollableY && deltaY !== 0) {
        const isUp = deltaY < 0;
        const isDown = deltaY > 0;
        const isAtTop = scrollableY.scrollTop <= 0;
        const isAtBottom =
          Math.ceil(scrollableY.scrollTop + scrollableY.clientHeight) >=
          scrollableY.scrollHeight - 1;
        if ((isUp && !isAtTop) || (isDown && !isAtBottom)) {
          canScrollY = true;
        }
      }

      let canScrollX = false;
      if (scrollableX && deltaX !== 0) {
        const isLeft = deltaX < 0;
        const isRight = deltaX > 0;
        const isAtLeft = scrollableX.scrollLeft <= 0;
        const isAtRight =
          Math.ceil(scrollableX.scrollLeft + scrollableX.clientWidth) >=
          scrollableX.scrollWidth - 1;
        if ((isLeft && !isAtLeft) || (isRight && !isAtRight)) {
          canScrollX = true;
        }
      }

      if (!canScrollY && !canScrollX) {
        e.preventDefault();
      }
      e.stopPropagation();
    },
    { passive: false },
  );
}
