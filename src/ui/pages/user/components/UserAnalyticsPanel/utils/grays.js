// 图表里的文字和线条是矢量图形的属性，写不了 CSS 变量，所以在这里把设计变量读成具体的色值再交给图表库。
// 以后主题改了变量，图表下次更新时就跟着变。
export function grays() {
  const style = getComputedStyle(document.documentElement);
  const read = (level) => style.getPropertyValue(`--cf-gray-${level}`).trim();
  return {
    faint: read(100),
    line: read(200),
    edge: read(300),
    muted: read(400),
    label: read(500),
    name: read(600),
    text: read(700),
    strong: read(800),
  };
}
