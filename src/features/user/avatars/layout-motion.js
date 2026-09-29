const active = new WeakMap();

// 按链接和出现次序匹配成员，避免把头像链接算作另一位用户。
function memberRects(cell) {
  const counts = new Map();
  return new Map(
    [
      ...cell.querySelectorAll('a[href*="/profile/"]:not(.cf-avatar-container), a[href*="/team/"]'),
    ].map((link) => {
      const count = counts.get(link.href) || 0;
      counts.set(link.href, count + 1);
      return [link.href + ':' + count, { link, rect: link.getBoundingClientRect() }];
    }),
  );
}

// 格式化之前记录队伍成员的位置，中途改回时以当前画面为起点。
export function captureTeamLayout(cell) {
  const snapshot = { cell, rect: cell.getBoundingClientRect(), members: memberRects(cell) };
  active.get(cell)?.();
  return snapshot;
}

// 队伍结构改变时移动实际成员节点，并通过内容高度平滑推动后续表格行。
export function animateTeamLayout({ cell, rect, members }) {
  if (
    !cell.isConnected ||
    document.hidden ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return;
  const layout = document.createElement('div');
  layout.className = 'cf-team-layout';
  while (cell.firstChild) layout.appendChild(cell.firstChild);
  cell.appendChild(layout);
  const style = getComputedStyle(cell);
  const padding = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce(
    (sum, key) => sum + (parseFloat(style[key]) || 0),
    0,
  );
  const options = { duration: 280, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' };
  const animations = [];
  for (const [key, { link, rect: next }] of memberRects(cell)) {
    const old = members.get(key)?.rect;
    if (!old) continue;
    const element = link.closest('.cf-avatar-line-wrapper') || link;
    animations.push(
      element.animate(
        [
          { transform: `translate(${old.x - next.x}px, ${old.y - next.y}px)` },
          { transform: 'translate(0, 0)' },
        ],
        options,
      ),
    );
  }
  animations.push(
    layout.animate(
      [
        { height: Math.max(0, rect.height - padding) + 'px' },
        { height: layout.getBoundingClientRect().height + 'px' },
      ],
      options,
    ),
  );
  cell.classList.add('cf-team-moving');
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    animations.forEach((animation) => animation.cancel());
    // 最终恢复原来的层级，不让动画包装逐次累积。
    layout.replaceWith(...layout.childNodes);
    cell.classList.remove('cf-team-moving');
    active.delete(cell);
  };
  active.set(cell, cleanup);
  Promise.all(animations.map((animation) => animation.finished)).then(cleanup, cleanup);
}
