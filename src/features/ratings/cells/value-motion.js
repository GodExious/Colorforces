const pending = new Map();
const targets = new WeakMap();
let frame = 0;

// 所有评分共用一个短生命周期帧任务，快速切换从当前数值继续。
function tick(now) {
  for (const [element, state] of pending) {
    const progress = Math.max(0, Math.min(1, (now - state.start) / 280));
    if (state.to === null) {
      // 空值先收起旧文字，收放结束再清空，不能把缺分解释成零分。
      if (progress === 1) element.textContent = '';
    } else {
      const value = Math.round(state.from + (state.to - state.from) * (1 - (1 - progress) ** 3));
      element.textContent = (state.prefix === '+' && value <= 0 ? '' : state.prefix) + value;
    }
    if (progress === 1 || !element.isConnected) pending.delete(element);
  }
  frame = pending.size ? requestAnimationFrame(tick) : 0;
}

// 数值之间递变；有无评分由 CSS 收放，保留旧文字直到收起完成。
export function updateRatingValue(element, rating, prefix = '') {
  const previous = targets.get(element);
  if (previous?.rating === rating && previous.prefix === prefix) return;
  targets.set(element, { rating, prefix });
  pending.delete(element);
  const animated =
    element.isConnected &&
    !document.hidden &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 无穷是有效评级边界，直接显示符号，不能参与数值插值。
  if (rating === Infinity) {
    element.textContent = '+∞';
    return;
  }
  if (rating === null) {
    if (!animated || !element.textContent) {
      element.textContent = '';
      return;
    }
    pending.set(element, { to: null, start: performance.now() });
    if (!frame) frame = requestAnimationFrame(tick);
    return;
  }
  const text = prefix + rating;
  if (element.textContent === text) {
    pending.delete(element);
    return;
  }
  const from = Number(element.textContent.replace(/^\*/, ''));
  if (!element.textContent || previous?.rating === null || !Number.isFinite(from) || !animated) {
    pending.delete(element);
    element.textContent = text;
    return;
  }
  pending.set(element, { from, to: rating, prefix, start: performance.now() });
  if (!frame) frame = requestAnimationFrame(tick);
}
