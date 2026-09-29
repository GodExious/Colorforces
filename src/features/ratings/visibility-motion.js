const running = new Map();
const horizontal = [
  'width',
  'minWidth',
  'maxWidth',
  'paddingLeft',
  'paddingRight',
  'borderLeftWidth',
  'borderRightWidth',
];
const vertical = [
  'height',
  'minHeight',
  'paddingTop',
  'paddingBottom',
  'borderTopWidth',
  'borderBottomWidth',
];

// 记录评分列或榜单评分行的实际尺寸，反向切换沿用当前帧。
function measure(element, row) {
  const cells = row ? [...element.cells] : [element];
  return {
    visible: !!element.getClientRects().length,
    cells: cells.map((cell) => {
      const style = getComputedStyle(cell);
      return {
        cell,
        fields: Object.fromEntries((row ? vertical : horizontal).map((key) => [key, style[key]])),
        clip: cell.querySelector(':scope > .cf-rating-clip')?.getBoundingClientRect(),
      };
    }),
  };
}

// 仅为表格内容提供裁剪槽，不拷贝评分或重建原站行。
function ensureClip(cell) {
  let clip = cell.querySelector(':scope > .cf-rating-clip');
  if (!clip) {
    clip = document.createElement('span');
    clip.className = 'cf-rating-clip';
    while (cell.firstChild) clip.appendChild(cell.firstChild);
    cell.appendChild(clip);
  }
  return clip;
}

// 列开关压缩横向空间，榜单开关压缩纵向空间；结束后恢复原站 table 布局。
export function transitionRatingVisibility(update) {
  const entries = [...document.querySelectorAll('.cf-rating-col, .cf-rating-standings-row')].map(
    (element) => {
      const row = element.matches('tr');
      const before = measure(element, row);
      const interrupted = running.has(element);
      running.get(element)?.();
      return { element, row, before, interrupted };
    },
  );
  update();
  if (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (const { element, row, before, interrupted } of entries) {
    const after = measure(element, row);
    if (!interrupted && before.visible === after.visible) continue;
    const animations = [],
      restores = [];
    const options = { duration: 280, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' };
    // 隐藏目标先保持在表格中，收缩到零后才让 CSS 的 display:none 生效。
    const display = element.style.getPropertyValue('display'),
      priority = element.style.getPropertyPriority('display');
    element.style.setProperty('display', row ? 'table-row' : 'table-cell', 'important');
    restores.push(() => {
      if (display) element.style.setProperty('display', display, priority);
      else element.style.removeProperty('display');
    });
    const expanded = measure(element, row);
    expanded.cells.forEach(({ cell, fields }, index) => {
      const clip = ensureClip(cell);
      const size = clip.getBoundingClientRect();
      const dimension = row ? 'height' : 'width';
      const beforeSize = before.cells[index]?.clip?.[dimension] ?? size[dimension];
      const variables = {};
      for (const [key, value] of Object.entries(fields)) {
        variables[
          '--cf-rating-base-' + key.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase())
        ] = Number.isFinite(parseFloat(value)) ? value : '0px';
      }
      variables['--cf-rating-content-size'] = size[dimension] + 'px';
      const lineHeight = getComputedStyle(cell).lineHeight;
      variables['--cf-rating-line-height'] = lineHeight === 'normal' ? 'normal' : lineHeight;
      const saved = Object.keys(variables).map((key) => [key, cell.style.getPropertyValue(key)]);
      for (const [key, value] of Object.entries(variables)) cell.style.setProperty(key, value);
      restores.push(() =>
        saved.forEach(([key, value]) => {
          if (value) cell.style.setProperty(key, value);
          else cell.style.removeProperty(key);
        }),
      );
      const progress = before.visible ? Math.min(1, beforeSize / (size[dimension] || 1)) : 0;
      animations.push(
        cell.animate(
          [
            { '--cf-rating-progress': String(progress) },
            { '--cf-rating-progress': after.visible ? '1' : '0' },
          ],
          options,
        ),
      );
    });
    element.classList.add('cf-rating-moving');
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      element.classList.remove('cf-rating-moving');
      restores.forEach((restore) => restore());
      animations.forEach((animation) => animation.cancel());
      running.delete(element);
    };
    running.set(element, cleanup);
    Promise.all(animations.map((animation) => animation.finished)).then(cleanup, cleanup);
  }
}
