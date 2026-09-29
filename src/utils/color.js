import { DEFAULT_SETTINGS } from '../config/defaults.js';
// 将旧版拆分的透明度设置合并成颜色字符串。
export function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return hex || DEFAULT_SETTINGS.acBgColor;
  let r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
