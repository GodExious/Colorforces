import { DEFAULT_SETTINGS } from '../config/defaults.js';
// 将旧版拆分的透明度设置合并成颜色字符串。
export function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return hex || DEFAULT_SETTINGS.appearance.acHighlight.color;
  let r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 两种十六进制颜色按比例相混：share 是 second 占的份额，0 得到 first，1 得到 second。
// 结果仍是十六进制色值，可以交给图表库做颜色过渡（它不认识 CSS 的 color-mix）。
export function mixHex(first, second, share) {
  const part = Math.min(1, Math.max(0, share));
  const channel = (hex, at) => parseInt(hex.slice(at, at + 2), 16);
  return (
    '#' +
    [1, 3, 5]
      .map((at) =>
        Math.round(channel(first, at) * (1 - part) + channel(second, at) * part)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
