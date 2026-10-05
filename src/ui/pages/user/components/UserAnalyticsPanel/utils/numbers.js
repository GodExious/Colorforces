// 图表里数字的写法，各张图共用。

// 占比：part 占 whole 的百分之几；whole 为 0 时记为 0。
export const percentOf = (part, whole) => (whole > 0 ? (part / whole) * 100 : 0);
// 百分数保留一位小数；满了就写 100%，不写成 100.0%。
export const percentText = (value) => (value >= 99.95 ? '100%' : `${value.toFixed(1)}%`);
// 纵轴刻度上的数量：位置窄，不加千位分隔；上万的写成「12k」「12.5k」。
export const axisCountText = (value) =>
  value >= 10000 ? `${+(value / 1000).toFixed(1)}k` : String(value);
// 柱状图左边留给纵轴刻度的宽度，各张图一样，绘图区的左边缘才对得齐。
export const AXIS_LEFT = 36;
// 数量加千位分隔。
export const countText = (value) => Math.round(value).toLocaleString('en-US');
