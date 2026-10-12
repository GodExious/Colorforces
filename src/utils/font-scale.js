import { appSettings } from '../settings.js';
import { FONT_SIZE } from '../config/defaults.js';

// 插件字体大小的倍数（默认字号时是 1）。
export const fontScale = () => appSettings.general.fontSize / FONT_SIZE.base;
// 一个随插件字体大小放大缩小的像素值，取整（不用半像素）。
// 图表里的字由图表库画，读不到样式变量：字号，以及给字留的宽度、高度，都用它来算。
// 在生成图表配置的地方调用，字号一改，配置跟着重新生成。
export const scaled = (px) => Math.round(px * fontScale());
