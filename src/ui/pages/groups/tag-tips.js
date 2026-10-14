// 页面上分组标签的悬停提示。
// 标签是用样式画在别的元素上的（见 features/user/groups/tags.js），不是一个元素：鼠标移到标签上，浏览器说的是
// 「在那个元素上」——可能是包着头像和名字的那一行、表格的格子，也可能就是名字的链接。共用的提示只认元素，
// 所以要么把提示浮在整行的正中，要么显示成名字的提示（原站的头衔）。
// 这里按鼠标的位置单独处理：鼠标在标签那一块上时，提示浮在标签上面，写分组的名字（标签上已经写全了名字的不提示）；
// 离开标签那一块，名字、头像各自的提示照旧。
import { tooltip } from '../../components/tooltips/FloatingTooltip/FloatingTooltip.vue';
import { groupTagAt } from '../../../features/user/groups/tags.js';

const TIPPED = '[data-tooltip], [title], [data-cf-native-tooltip]';

// 开始处理，返回停止的函数。
export function bindGroupTagTips() {
  // 鼠标正停在哪个元素的标签上；不在任何标签上时是 null。
  let over = null;
  function onMove(event) {
    const target = event.target;
    const host = target?.nodeType === 1 && target.hasAttribute('data-cf-group') ? target : null;
    const tag = host && groupTagAt(host, event.clientX);
    if (tag) {
      if (over === host) return;
      over = host;
      // 提示按标签的位置摆，不按整个元素。
      if (tag.title)
        tooltip.show({ getBoundingClientRect: () => tag.rect, closest: () => null }, tag.title);
      else tooltip.hide();
      return;
    }
    if (!over) return;
    const left = over;
    over = null;
    if (host === left) {
      // 还在同一个元素上，只是离开了标签那一块：这个元素自己有提示（名字的链接）就换回它的，没有就收起。
      const text = left.getAttribute('data-cf-native-tooltip') || left.getAttribute('title');
      if (text) tooltip.show(left, text);
      else tooltip.hide();
    } else if (!(target?.nodeType === 1 && target.closest(TIPPED))) {
      // 移到了没有提示的地方。移到有提示的元素上时，共用的提示已经换成它的了，这里不用管。
      tooltip.hide();
    }
  }
  document.addEventListener('mousemove', onMove);
  return () => document.removeEventListener('mousemove', onMove);
}
