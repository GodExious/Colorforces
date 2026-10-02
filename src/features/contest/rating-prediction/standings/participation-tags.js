const entries = new Map();

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
export function updateParticipationTag(cell, status, title = '') {
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
    cell.style.setProperty('--cf-participation-padding', getComputedStyle(cell).paddingRight);
    cell.dataset.cfParticipationHost = '';
    cell.dataset.cfParticipationVisible = 'false';
    cell.append(tag);
    entry = { tag, visible: false, frame: 0, timer: 0 };
    entries.set(cell, entry);
  }
  if (entry.tag.textContent !== status) entry.tag.textContent = status;
  entry.tag.dataset.status = status;
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
