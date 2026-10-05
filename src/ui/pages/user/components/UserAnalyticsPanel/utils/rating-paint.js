import { appSettings } from '../../../../../../settings.js';
import { mixHex } from '../../../../../../utils/color.js';
import {
  getRatingBgColor,
  getRatingBorderColor,
  getRatingTextColor,
  getRatingTagStyle,
} from '../../../../../../features/ratings/rules.js';

// 按难度分取一组颜色：柱子的填充与边线、文字的颜色，以及一个很浅的底色（给悬停提示这类小面板做背板）。
// 「沿用难度分样式」开启且难度分配色开着时，跟随「难度分」面板选的样式：
// 标签样式用浅底、细边和深色字；色块样式以及其余情况用经典的档位色。
// mark / markEdge 是给很小的图形（如热力图的格子）用的填充与边线：
// 标签样式的浅底铺在十来个像素的格子上几乎看不出颜色，所以改用它的边线色来填，边线再往文字色靠一半；
// 色相和这套配色是一致的，只是更实一些。经典档位色本来就够浓，直接沿用。
// 读的是响应式设置，放在计算属性里用时，样式一变颜色就跟着变。
export function ratingPaint(rating) {
  const styled = appSettings.user.analytics.followRatingStyle && appSettings.ratings.enabled;
  if (styled && appSettings.ratings.style === 'tag') {
    const { bg, border, text } = getRatingTagStyle(rating);
    return {
      fill: bg,
      edge: border,
      text,
      tint: bg,
      mark: border,
      markEdge: mixHex(border, text, 0.5),
    };
  }
  const fill = getRatingBgColor(rating);
  const edge = getRatingBorderColor(rating);
  return {
    fill,
    edge,
    text: getRatingTextColor(rating),
    // 经典档位色比较浓，背板只取它的一小部分，和白色调在一起。
    tint: `color-mix(in srgb, ${fill} 24%, #fff)`,
    mark: fill,
    markEdge: edge,
  };
}
