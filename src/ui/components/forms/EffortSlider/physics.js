// 强度条的手感：拖着时靠近档位被轻轻吸住，松手像弹簧一样弹到最近的档（甩得快会冲过头一点再回来）。
// 位置都按「第几档」算：0 是第一档，可以停在两档之间（拖着、弹着的时候）。参数照 Claude 的强度条调的。
const STIFFNESS = 920;
const DAMPING = 40;
// 松手前多久的移动算进甩出去的速度（毫秒），速度最大多少（档 / 秒）。
const SAMPLE_TIME = 90;
const MAX_SPEED = 8;

// 吸附：离某一档不到半档时往那一档拉一点，越近拉得越紧。
export function magnet(value) {
  const nearest = Math.round(value);
  const delta = value - nearest;
  const distance = Math.abs(delta);
  if (distance < 0.001 || distance > 0.5) return value;
  const t = 1 - distance / 0.5;
  return value - delta * (0.68 + 0.42 * t) * t * t;
}

// 弹簧走一小步：delta 是这一步的时长（秒）。返回新的 { position, velocity }。
export function springStep(position, velocity, target, delta) {
  const next = velocity + (-STIFFNESS * (position - target) - DAMPING * velocity) * delta;
  return { position: position + next * delta, velocity: next };
}
// 弹到了：离目标不到千分之一档，速度也很小了。
export const settled = (position, velocity, target) =>
  Math.abs(position - target) < 0.001 && Math.abs(velocity) < 0.01;

// 记下拖动的位置，只留最近这一小段：samples 是 [{ time, value }]，返回新的一份。
export const keepSamples = (samples, time, value) =>
  [...samples, { time, value }].filter((sample) => time - sample.time < SAMPLE_TIME).slice(-5);
// 松手时甩出去的速度（档 / 秒）：最近这一小段从头到尾走了多少。不够两个点时是 0。
export function releaseVelocity(samples) {
  if (samples.length < 2) return 0;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const speed = (last.value - first.value) / Math.max((last.time - first.time) / 1000, 0.016);
  return Math.min(MAX_SPEED, Math.max(-MAX_SPEED, speed));
}
