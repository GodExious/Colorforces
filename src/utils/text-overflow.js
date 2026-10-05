// 判断单行文字有没有被省略。
// 不用 scrollWidth 和 clientWidth 相比：两者都是取整后的值，系统缩放不是整数倍（如 125%）时，
// 完全放得下的文字也可能算出 1 像素的差，于是每一处都被当成「被省略了」。
// 这里量的是文字本身的宽度和容纳它的宽度，都带小数。

const EDGES = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'];

// 文字比容纳它的宽度多出多少像素；放得下时不大于 0。
export function textOverflow(element) {
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  const room =
    element.getBoundingClientRect().width -
    EDGES.reduce((sum, edge) => sum + (parseFloat(style[edge]) || 0), 0);
  return range.getBoundingClientRect().width - room;
}

// 留出十分之一像素的余量，抵消小数计算的误差。
export const isTruncated = (element) => textOverflow(element) > 0.1;
