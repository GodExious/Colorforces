const running = new Map();
const progressProperty = '--cf-prediction-column-progress';

// 异步评分更新也使用同一裁剪层，不让新文字撑开正在收放的列。
function clipContents(cell) {
  const existing = cell.querySelector(':scope > .cf-prediction-column-clip');
  if (existing) return existing;
  const clip = document.createElement('span');
  clip.className = 'cf-prediction-column-clip';
  clip.dataset.cfPrediction = '';
  while (cell.firstChild) clip.append(cell.firstChild);
  cell.append(clip);
  return clip;
}

// 只解除本功能的裁剪层，保留评分、按钮及原站行的节点身份。
function unwrap(cell) {
  const clip = cell.querySelector(':scope > .cf-prediction-column-clip');
  if (clip) clip.replaceWith(...clip.childNodes);
}

// 收起后重新标记首末列，避免残留缺失的边框。
function borders(row) {
  if (!row?.isConnected) return;
  const cells = [...row.querySelectorAll('[data-prediction-column]')];
  cells.forEach((cell, index) => {
    cell.classList.toggle('cf-prediction-first', index === 0);
    cell.classList.toggle('right', cell === row.lastElementChild);
  });
}

// 列先展开/收拢占位，再保留或移除；快速反向切换从当前帧继续。
export function syncPredictionColumns(table, columns) {
  const instant = document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const jobs = [];
  const repairs = [];
  for (const cell of table.querySelectorAll('[data-prediction-column]')) {
    const visible = columns.includes(cell.dataset.predictionColumn);
    const previous = running.get(cell);
    const fresh = cell.hasAttribute('data-cf-prediction-new');
    if (!instant && previous?.visible === visible) {
      if (!cell.querySelector(':scope > .cf-prediction-column-clip')) repairs.push(cell);
      continue;
    }
    if (!previous && !fresh && visible) continue;
    const from = previous
      ? parseFloat(getComputedStyle(cell).getPropertyValue(progressProperty))
      : fresh
        ? 0
        : 1;
    jobs.push({ cell, visible, from: Number.isFinite(from) ? from : 0, previous });
  }
  // 收放途中内容被整格重画时裁剪层会丢，补回即可；裁剪层不定高，无需重新测量。
  repairs.forEach(clipContents);
  // 先统一复位，再统一测量，避免逐格读写触发布局抖动。
  jobs.forEach(({ cell, previous }) => {
    previous?.cancel();
    cell.removeAttribute('data-cf-prediction-new');
  });
  const measurements = jobs.map((job) => {
    const style = getComputedStyle(job.cell),
      rect = job.cell.getBoundingClientRect();
    const number = (key) => parseFloat(style[key]) || 0;
    return {
      ...job,
      values: {
        width: Math.max(
          0,
          rect.width -
            number('paddingLeft') -
            number('paddingRight') -
            number('borderLeftWidth') -
            number('borderRightWidth'),
        ),
        left: number('paddingLeft'),
        right: number('paddingRight'),
        borderLeft: number('borderLeftWidth'),
        borderRight: number('borderRightWidth'),
      },
    };
  });
  for (const { cell, visible, from, values } of measurements) {
    if (instant || !cell.isConnected || (!visible && from === 0)) {
      if (!visible) {
        const row = cell.parentElement;
        cell.remove();
        borders(row);
      }
      continue;
    }
    clipContents(cell);
    const properties = Object.entries(values).map(([key, value]) => {
      const property = '--cf-prediction-column-' + key;
      const saved = cell.style.getPropertyValue(property);
      cell.style.setProperty(property, value + 'px');
      return [property, saved];
    });
    cell.classList.add('cf-prediction-column-moving');
    const animation = cell.animate(
      [{ [progressProperty]: String(from) }, { [progressProperty]: visible ? '1' : '0' }],
      {
        duration: Math.max(90, 280 * Math.abs((visible ? 1 : 0) - from)),
        easing: 'cubic-bezier(.22,1,.36,1)',
        fill: 'both',
      },
    );
    const state = {
      visible,
      cancel: () => {
        animation.cancel();
        cell.classList.remove('cf-prediction-column-moving');
        unwrap(cell);
        properties.forEach(([key, saved]) =>
          saved ? cell.style.setProperty(key, saved) : cell.style.removeProperty(key),
        );
        if (running.get(cell) === state) running.delete(cell);
      },
    };
    running.set(cell, state);
    animation.finished
      .then(() => {
        if (running.get(cell) !== state) return;
        const row = cell.parentElement;
        state.cancel();
        if (!visible) cell.remove();
        borders(row);
      })
      .catch(() => {});
  }
}
