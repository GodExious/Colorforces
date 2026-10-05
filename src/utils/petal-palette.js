// 菜单的主题色取自标志上的八片花瓣。页签不一定正好八个，
// 所以把八片花瓣首尾相接看成一个色环，各页在环上均分取色，页数变了颜色自动重新分配。

// 标志的八片花瓣颜色，从正上方起顺时针，与 colorforces.svg 中的顺序一致。
export const PETAL_COLORS = [
  '#e45b96',
  '#ef8875',
  '#e8bd58',
  '#85bc75',
  '#43b8af',
  '#62a9d5',
  '#8681d5',
  '#bc7bc5',
];

// 第 index 页在色环上的位置，单位是「第几片花瓣」，可以是小数。
export function petalPosition(index, count) {
  if (!Number.isFinite(index) || !(count > 0) || index < 0) return 0;
  return (index / count) * PETAL_COLORS.length;
}

const channels = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
const toHex = (values) =>
  '#' +
  values
    .map((value) =>
      Math.round(Math.min(1, Math.max(0, value)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const toLinear = (value) =>
  value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
const fromLinear = (value) =>
  value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;

// 转到 Oklab 再混色：两种颜色之间过渡得均匀，中间不会发灰。
function toOklab(hex) {
  const [r, g, b] = channels(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function fromOklab([lightness, a, b]) {
  const l = Math.pow(lightness + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(lightness - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(lightness - 0.0894841775 * a - 1.291485548 * b, 3);
  return toHex(
    [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map(fromLinear),
  );
}

// 色环上某个位置的颜色：落在两片花瓣之间时，按距离在两者之间取色。
export function petalColor(position) {
  const size = PETAL_COLORS.length;
  const place = (((Number.isFinite(position) ? position : 0) % size) + size) % size;
  const from = Math.floor(place);
  const share = place - from;
  if (share < 1e-6) return PETAL_COLORS[from];
  const start = toOklab(PETAL_COLORS[from]);
  const end = toOklab(PETAL_COLORS[(from + 1) % size]);
  return fromOklab(start.map((value, at) => value + (end[at] - value) * share));
}

// 只保留色相，换成指定的明度与彩度：一组颜色深浅一致，放在一起不会有的偏亮、有的偏灰。
export function petalTone(hex, lightness, chroma) {
  const [, a, b] = toOklab(hex);
  const scale = chroma / (Math.hypot(a, b) || 1);
  return fromOklab([lightness, a * scale, b * scale]);
}

// 同一颜色的浅色版本，用作图标的点缀色：与白色按比例相混。
export function petalTint(hex, share = 0.6) {
  return toHex(channels(hex).map((value) => value * share + (1 - share)));
}
