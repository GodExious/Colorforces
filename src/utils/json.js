const WRAP = '\u0000';

// 把数据写成带缩进的 JSON 文字，其中纯数字的数组各写成一行，不让每个数字各占一行。
// 用于有大量小数组的数据（比如每条提交记录是七个数）：否则几万条记录会变成几十万行。
// 纯数字的数组先整个换成一段带记号的字符串，写完再把记号连同引号去掉，不必对整段文字逐个数组做匹配。
export function stringifyCompact(value) {
  const text = JSON.stringify(
    value,
    (_name, item) =>
      Array.isArray(item) && item.length && item.every(Number.isFinite)
        ? `${WRAP}[${item.join(', ')}]${WRAP}`
        : item,
    2,
  );
  return text === undefined ? text : text.replace(/"\\u0000(\[[^\]]*\])\\u0000"/g, '$1');
}

const isPlain = (item) => item === null || typeof item !== 'object';

// 给预览用的缩略版，让很大的数据也只需要写出一小段文字。原来的数据不动。
// 总共不多于 budget 个值（各层的数组项、对象的键都算）的数据原样返回，不截。
// 再多的：最外面两层的数组、对象各留开头 top 项，更里面的各留 nested 项；
// 整体也只留 budget 个值，留够了后面的全部省掉。
// 一条小记录（不多于 record 项、里面没有再套数组或对象）不拆开，要留就整条留。
// 被省掉的地方放一个 marker（数组里是一项，对象里是一个值为 true 的键），由查看器换成「已截断」的说明。
export function trimPreview(
  value,
  marker,
  { budget = 400, top = 30, nested = 8, record = 24 } = {},
) {
  // 对象的键只列一次：有几十万个键的对象，列一遍键就要几十毫秒。
  const listed = new Map();
  const keysOf = (node) => {
    if (!listed.has(node)) listed.set(node, Object.keys(node));
    return listed.get(node);
  };
  const sizeOf = (node) => (Array.isArray(node) ? node.length : keysOf(node).length);
  // 第几项的 [键, 值]。
  const entryAt = (node, index) =>
    Array.isArray(node) ? [index, node[index]] : [keysOf(node)[index], node[keysOf(node)[index]]];

  // 先数一数是不是多于 budget 个值；数够了就停，不把整份数据走一遍。
  let seen = 0;
  const pending = [value];
  while (pending.length && seen <= budget) {
    const node = pending.pop();
    if (isPlain(node)) continue;
    const size = sizeOf(node);
    seen += size;
    for (let index = 0; index < size && seen <= budget; index++)
      pending.push(entryAt(node, index)[1]);
  }
  if (seen <= budget) return value;

  let left = budget;
  const walk = (node, depth) => {
    if (isPlain(node)) return node;
    const list = Array.isArray(node);
    const size = sizeOf(node);
    const limit = depth <= 1 ? top : nested;
    let whole = size <= record;
    for (let index = 0; whole && index < size; index++) whole = isPlain(entryAt(node, index)[1]);
    const keep = whole ? size : Math.min(limit, size);
    const out = list ? [] : {};
    let kept = 0;
    while (kept < keep && left > 0) {
      const [key, item] = entryAt(node, kept++);
      left--;
      const next = walk(item, depth + 1);
      if (list) out.push(next);
      else out[key] = next;
    }
    if (kept < size) {
      if (list) out.push(marker);
      else out[marker] = true;
    }
    return out;
  };
  return walk(value, 0);
}
