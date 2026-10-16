// 强度条上的像素：一格一格的小方块（5px，中间留 1px 缝），只画在滑块左边填过的那段（到最后一档是整条）。
// progress 是滑块走了多远（0～1）：越大冒出来的格子越多（第二档稀稀落落，最后一档全满）、越紫、越不透明，
// 一闪一闪的劲越足，往右流的亮带越明显。每格按自己的节奏一闪一闪，再叠一道往右流的亮带。
// 照 Claude 的强度条最高一档那片像素的意思重写，改成一档比一档浓；颜色是幻彩弹窗的长春花紫。
// 只做计算和画，不管什么时候画（见 EffortSlider.vue）。

// 紫色的几种深浅（重复的多，取到的机会大），左边最淡的灰，亮一下时的颜色，最亮时的颜色。
const TONES = [
  [141, 124, 210],
  [141, 124, 210],
  [150, 134, 216],
  [150, 134, 216],
  [160, 146, 222],
  [160, 146, 222],
  [160, 146, 222],
  [172, 160, 228],
  [172, 160, 228],
  [184, 174, 232],
  [196, 188, 236],
];
const LEFT = [224, 225, 238];
const LIGHT = [226, 222, 246];
const PEAK = [242, 240, 252];
const CELL = 5;
const GAP = 1;
// 滑块圆心离两头多远（和档位点一样）：滑块宽 24px，滑条两边各留 1px。
export const EDGE = 13;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const smoothstep = (from, to, value) => {
  const t = clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};
// 每一格固定的几个「随机数」（0～1），同一格每次算出来都一样。
const hash = (a, b, k1, k2, k3) => Math.abs(Math.sin(a * k1 + b * k2) * k3) % 1;
const mixColor = (from, to, amount) =>
  from.map((channel, i) => channel + (to[i] - channel) * amount);

// 一格画成什么样：{ alpha, color: [r, g, b] }；这一格不画时 alpha 是 0。
// x 是这一格的中心离左边多远（像素），end 是填过的那段画到哪，width 是整条宽；
// elapsed 是动了多久（毫秒，各格的闪按它），flow 是亮带往右挪了多少（一圈是 1）。
export function pixelAt({ column, row, x, end, width, progress, elapsed, flow }) {
  const along = x / end;
  const keep = hash(column, row, 3.71, 91.37, 31337.17);
  // 冒出来的格子占多少：第二档四成多，往上越来越多，最后一档全满；快到门槛的先淡淡地出来，拖着时不会一下子蹦出来。
  const density = 0.22 + 0.78 * progress;
  const appear = smoothstep(density, density - 0.06, keep);
  if (appear <= 0.002) return { alpha: 0, color: LEFT };
  const strength = 0.3 + 0.7 * progress;
  const base = hash(column, row, 12.9898, 78.233, 43758.5453);
  const tempo = hash(column, row, 7.13, 19.41, 19341.731);
  const phase = hash(column, row, 31.17, 11.93, 28437.123);
  // 各自一闪：每格一个周期（0.5～2 秒），周期里某个时刻亮一下。
  const period = 500 + tempo * 1500;
  const local = elapsed + phase * period;
  const cycle = Math.floor(local / period);
  const step = (local % period) / period;
  const luck = hash(column + cycle, row, 17.17, 41.73, 24634.6345);
  const pulse =
    Math.exp(-(((step - (0.2 + luck * 0.55)) / 0.12) ** 2) * 1.45) *
    (luck > 0.12 ? 1 : 0.26) *
    strength;
  // 往右流的亮带：一道道余弦波，随 flow 往右挪。
  const wave =
    Math.pow(0.5 + 0.5 * Math.cos((x / width - flow + row * 0.06 + base * 0.02) * Math.PI * 2), 5) *
    0.62 *
    strength;
  const light = Math.max(pulse * (0.48 + wave * 0.58), wave * (0.38 + base * 0.28));
  const tonePosition =
    (((base * 0.28 + smoothstep(0.35, 0.95, along) * 0.28 + step * 0.38 + luck * 0.2) % 1) + 1) % 1;
  const tone = TONES[Math.floor(tonePosition * TONES.length)];
  const colored = mixColor(LEFT, tone, smoothstep(0.05, 0.95, along) * strength);
  const hot = light > 0.68 && pulse > 0.3 && luck > 0.48;
  const lit = hot
    ? 0.95
    : light > 0.4 && pulse > 0.16
      ? 0.9
      : clamp(light * (0.44 + luck * 0.3), 0, 0.64);
  const color = mixColor(colored, hot ? PEAK : LIGHT, lit).map(Math.round);
  const alpha =
    appear * smoothstep(0, 0.35, along) * strength * clamp(0.7 + base * 0.2 + light * 0.12, 0, 1);
  return { alpha, color };
}

// 把一整条画到画布上。context 已经按设备像素比缩放好，width、height 是 CSS 像素。
export function paintPixels(context, { width, height, progress, elapsed, flow }) {
  context.clearRect(0, 0, width, height);
  const p = clamp(progress, 0, 1);
  if (p <= 0.001 || !width) return;
  const end = p >= 0.999 ? width : EDGE + (width - EDGE * 2) * p;
  for (let row = 0; row * CELL < height; row += 1)
    for (let column = 0; column * CELL < end; column += 1) {
      const cell = pixelAt({
        column,
        row,
        x: column * CELL + CELL / 2,
        end,
        width,
        progress: p,
        elapsed,
        flow,
      });
      if (cell.alpha <= 0) continue;
      context.globalAlpha = cell.alpha;
      context.fillStyle = `rgb(${cell.color[0]} ${cell.color[1]} ${cell.color[2]})`;
      context.fillRect(column * CELL + GAP / 2, row * CELL + GAP / 2, CELL - GAP, CELL - GAP);
    }
  context.globalAlpha = 1;
}
