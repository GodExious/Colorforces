const entries = new Map();

// 新建标签前要记下格子原来的右内边距。向浏览器要这个数，它得先把样式当场算一遍；
// 一行要一次、中间又夹着对别的格子的改动，榜单一页两百行就要算两百遍。
// 所以这一轮渲染里碰到第一个要新建标签的格子时，把同一张表里还没有标签的格子一次量完，后面的直接取。
// 每个格子仍然各量各的（队伍的行、被别的脚本改过的格子可以不一样），只是都排在改动之前。
let paddings = new WeakMap();
// 一轮渲染开始时调用：上一轮量的不留到这一轮。
export function resetParticipationMeasures() {
  paddings = new WeakMap();
}
function nativePadding(cell) {
  if (!paddings.has(cell)) {
    for (const other of cell.closest('table')?.querySelectorAll('td.contestant-cell') || [])
      if (!entries.has(other)) paddings.set(other, getComputedStyle(other).paddingRight);
    if (!paddings.has(cell)) paddings.set(cell, getComputedStyle(cell).paddingRight);
  }
  return paddings.get(cell);
}

// 收起结束后再移除节点和预留空间，快速反向切换可以继续当前过渡。
function release(cell, entry) {
  cancelAnimationFrame(entry.frame);
  clearTimeout(entry.timer);
  entry.tag.remove();
  delete cell.dataset.cfParticipationHost;
  delete cell.dataset.cfParticipationVisible;
  cell.style.removeProperty('--cf-participation-padding');
  entries.delete(cell);
}

// 标签从右侧展开，同时让原生表格逐帧分配空间，不包装或重排昵称节点。
// teamSize 大于 0 表示这一行是队伍：标签末尾多接一小段、写人数（样式里用这个属性画出来）。
// 是队伍但数不出人数的（Ghost 队伍的成员只是一段文字，写法不认得时）传 '?'，写成 ×?.
export function updateParticipationTag(cell, status, title = '', teamSize = 0) {
  let entry = entries.get(cell);
  if (entry && (!cell.isConnected || !cell.contains(entry.tag))) {
    release(cell, entry);
    entry = null;
  }
  // 页面重排只能移动标签位置，不应改变其所属单元格或重新启动整段动画。
  if (entry && entry.tag.parentElement !== cell) cell.append(entry.tag);
  if (!status) {
    if (!entry || !entry.visible) return;
    entry.visible = false;
    cancelAnimationFrame(entry.frame);
    cell.dataset.cfParticipationVisible = 'false';
    entry.tag.setAttribute('aria-hidden', 'true');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) release(cell, entry);
    else
      entry.timer = setTimeout(() => {
        if (!entry.visible) release(cell, entry);
      }, 300);
    return;
  }
  const fresh = !entry;
  if (fresh) {
    const tag = document.createElement('span');
    tag.dataset.cfPrediction = '';
    tag.className = 'cf-participation-tag';
    cell.style.setProperty('--cf-participation-padding', nativePadding(cell));
    cell.dataset.cfParticipationHost = '';
    cell.dataset.cfParticipationVisible = 'false';
    cell.append(tag);
    entry = { tag, visible: false, frame: 0, timer: 0 };
    entries.set(cell, entry);
  }
  if (entry.tag.textContent !== status) entry.tag.textContent = status;
  entry.tag.dataset.status = status;
  if (teamSize === '?' || teamSize > 0) entry.tag.dataset.teamSize = String(teamSize);
  else delete entry.tag.dataset.teamSize;
  // 两位数的人数多占一个字的宽度，预留的位置跟着加。
  entry.tag.toggleAttribute('data-team-wide', teamSize > 9);
  entry.tag.dataset.tooltip = title;
  entry.tag.removeAttribute('aria-hidden');
  clearTimeout(entry.timer);
  if (entry.visible) return;
  entry.visible = true;
  const reveal = () => {
    if (entry.visible && cell.isConnected) cell.dataset.cfParticipationVisible = 'true';
  };
  if (fresh && !matchMedia('(prefers-reduced-motion: reduce)').matches)
    entry.frame = requestAnimationFrame(() => {
      entry.frame = requestAnimationFrame(reveal);
    });
  else reveal();
}

// 关闭整个功能也沿用标签退出动画，不留下有宽度的空槽。
export function clearParticipationTags() {
  for (const cell of entries.keys()) updateParticipationTag(cell, null);
}
