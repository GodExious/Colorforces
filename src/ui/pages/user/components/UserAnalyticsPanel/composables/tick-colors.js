/*
 * 坐标轴刻度文字换颜色时的过渡。
 *
 * 有几张图的刻度按难度分或评级的档位着色，颜色跟着难度分的显示样式走。样式一换（比如按快捷键），
 * 柱子的颜色是带着过渡变过去的，刻度却是一下子换掉的：图表库每次更新都把刻度文字整个重建，
 * 重建时只把位置从旧文字接过来做过渡，颜色不接。
 * 这里补上：更新之前记下每个刻度文字的颜色，更新之后让颜色变了的那些从旧颜色渐变到新颜色。
 * 认刻度靠图表库给刻度文字起的名字（anid，「label_」加刻度的数值）；一张图有几根轴，
 * 就按各根轴出现的先后分开记，两根轴上数值相同的刻度不会认混。
 */

// 图表里现有的刻度文字：「第几根轴|刻度」→ 文字图形。
function tickLabels(chart) {
  const labels = new Map();
  // 同一根轴的刻度文字放在同一个组里，按组出现的先后给轴编号。
  const axes = new Map();
  const walk = (node) => {
    if (node.type === 'text') {
      if (typeof node.anid !== 'string' || !node.anid.startsWith('label_')) return;
      if (!axes.has(node.parent)) axes.set(node.parent, axes.size);
      labels.set(`${axes.get(node.parent)}|${node.anid}`, node);
      return;
    }
    node.childrenRef?.().forEach(walk);
  };
  chart.getZr().storage.getRoots().forEach(walk);
  return labels;
}

// 更新之前调用：记下各个刻度现在的颜色。
export function readTickColors(chart) {
  const colors = new Map();
  for (const [key, label] of tickLabels(chart)) colors.set(key, label.style.fill);
  return colors;
}

// 更新之后调用：颜色变了的刻度，从 before 里记的旧颜色渐变到现在的颜色。
export function fadeTickColors(chart, before, { duration, easing }) {
  for (const [key, label] of tickLabels(chart)) {
    const from = before.get(key);
    const to = label.style.fill;
    if (typeof from !== 'string' || typeof to !== 'string' || from === to) continue;
    label.animateFrom({ style: { fill: from } }, { duration, easing });
  }
}
