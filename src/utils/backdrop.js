// 弹窗遮罩的「点空白处关闭」，返回的监听器用 v-on 绑在遮罩上。
// 只有按下和松开都落在遮罩本身才算点了空白处。在弹窗里按下、拖到弹窗外才松开时
// （比如拖选输入框里的文字），浏览器会把这次点击算在两者共同的上层节点，也就是遮罩头上；
// 只看点击落点的话，弹窗会被误关。
export function backdropClose(close) {
  let pressed = false;
  return {
    pointerdown(event) {
      pressed = event.target === event.currentTarget;
    },
    click(event) {
      const hit = pressed && event.target === event.currentTarget;
      pressed = false;
      if (hit) close(event);
    },
  };
}
