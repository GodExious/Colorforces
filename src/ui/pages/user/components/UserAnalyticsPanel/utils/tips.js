import { mixHex } from '../../../../../../utils/color.js';
import { grays } from './grays.js';

// 柱状图和条形图共用的悬停提示，样子和评级曲线、难度热力图的提示是一套：
// 标题是这一项的名称，用这一项柱子的颜色（调深一些，在浅底上看得清）；
// 面板的底色和边线带一点同样的颜色；下面是一张小表，左边一栏是灰色的项目名，右边是数值。
// color 是这一项柱子的颜色（十六进制），不给时用面板的主色；rows 是 [[项目名, 数值], ...]。
const ACCENT = '#5b8fd6';
export function tintedTip(name, color, rows) {
  const tone = color || ACCENT;
  return {
    lead: name,
    leadColor: mixHex(tone, '#1f2d3d', 0.3),
    background: mixHex(tone, '#ffffff', 0.94),
    border: mixHex(tone, '#ffffff', 0.62),
    items: tipRows(rows),
  };
}
// 只要那张小表：给自己另有一套配色的图表用（比如按难度档位着色的难度分布）。
export function tipRows(rows) {
  const color = grays().label;
  return rows.map(([label, text]) => ({ label, text, color }));
}
