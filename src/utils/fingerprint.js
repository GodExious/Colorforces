// 开头、结尾各取这么多个字符，中间再均匀抽这么多个。
const EDGE = 256;
const SAMPLES = 1024;

// 一段文字的指纹：长度，加上开头、结尾各一段和中间均匀抽的一些字符混算出来的一个数。
// 用来判断「和上次那一段是不是同一段」而不必把上次那一段留着；文字再长也只读这一千多个字符。
// 不是绝对可靠：长度相同、被读到的字符也都相同的两段不同文字，指纹一样。
export function textFingerprint(text) {
  const length = text.length;
  let hash = 2166136261;
  const mix = (index) => {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  };
  if (length <= EDGE * 2 + SAMPLES) for (let index = 0; index < length; index++) mix(index);
  else {
    for (let index = 0; index < EDGE; index++) mix(index);
    const step = (length - EDGE * 2) / SAMPLES;
    for (let index = 0; index < SAMPLES; index++) mix(EDGE + Math.floor(index * step));
    for (let index = length - EDGE; index < length; index++) mix(index);
  }
  return `${length}:${hash >>> 0}`;
}
