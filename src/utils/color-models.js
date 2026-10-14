// 颜色在几种写法之间换算：色值（#rrggbb）、HSL（色相、饱和度、亮度）、HSV（色相、饱和度、明度）。
// 色相是 0～360，其余是 0～1。灰色（包括黑、白）没有色相，换出来的色相是 null，由用的地方自己留着上一次的。

const toHex = (channels) =>
  '#' +
  channels
    .map((value) =>
      Math.round(Math.min(1, Math.max(0, value)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const channelsOf = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);

export function hslToHex(hue, saturation, lightness) {
  const step = (n) => (n + hue / 30) % 12;
  const reach = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n) => lightness - reach * Math.max(-1, Math.min(step(n) - 3, 9 - step(n), 1));
  return toHex([channel(0), channel(8), channel(4)]);
}
export function hsvToHex(hue, saturation, value) {
  const channel = (n) => {
    const step = (n + hue / 60) % 6;
    return value - value * saturation * Math.max(0, Math.min(step, 4 - step, 1));
  };
  return toHex([channel(5), channel(3), channel(1)]);
}

function hueOf([red, green, blue], max, spread) {
  if (!spread) return null;
  const part =
    max === red
      ? ((green - blue) / spread) % 6
      : max === green
        ? (blue - red) / spread + 2
        : (red - green) / spread + 4;
  return (part * 60 + 360) % 360;
}
export function hexToHsl(hex) {
  const channels = channelsOf(hex);
  const max = Math.max(...channels);
  const min = Math.min(...channels);
  const lightness = (max + min) / 2;
  const spread = max - min;
  return {
    h: hueOf(channels, max, spread),
    s: spread ? spread / (1 - Math.abs(2 * lightness - 1)) : 0,
    l: lightness,
  };
}
export function hexToHsv(hex) {
  const channels = channelsOf(hex);
  const max = Math.max(...channels);
  const spread = max - Math.min(...channels);
  return { h: hueOf(channels, max, spread), s: max ? spread / max : 0, v: max };
}

// 输入框里写的色值：可以不写 #，可以写三位的，大小写都行。认得出返回 #rrggbb（小写），认不出返回空串。
export function readHex(text) {
  const raw = String(text ?? '')
    .trim()
    .replace(/^#/, '')
    .toLowerCase();
  if (/^[0-9a-f]{3}$/.test(raw)) return '#' + [...raw].map((char) => char + char).join('');
  return /^[0-9a-f]{6}$/.test(raw) ? '#' + raw : '';
}
