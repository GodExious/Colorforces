// 「名次 → 赛后评级」曲线的取样与估算。只做纯计算：
// 分析线程按这里给出的名次取样，界面在拖动滑杆时用取样点即时估算另一头的数值。

// 沿对数间距取若干名次，首尾必含；参赛人数不超过取样数时每个名次都取。
// 靠前的名次之间评级差得多，取得密；靠后的名次差得少，取得疏。
export function sampleRanks(total, count = 48) {
  if (!Number.isInteger(total) || total < 1) return [];
  if (total <= count) return Array.from({ length: total }, (_, index) => index + 1);
  const ranks = new Set([1, total]);
  for (let i = 1; i < count - 1; i++)
    ranks.add(Math.round(Math.exp((Math.log(total) * i) / (count - 1))));
  return [...ranks].sort((a, b) => a - b);
}

// 按名次升序整理取样点；同一名次以后写入的为准。
// 名次越靠后评级不应更高，个别因整数修正造成的回升按前一点压平，保证估算时单调。
export function normalizeCurve(points) {
  const byRank = new Map();
  for (const point of points)
    if (Number.isFinite(point?.rank) && Number.isFinite(point?.rating))
      byRank.set(point.rank, point.rating);
  let ceiling = Infinity;
  return [...byRank]
    .sort((a, b) => a[0] - b[0])
    .map(([rank, rating]) => {
      ceiling = Math.min(ceiling, rating);
      return { rank, rating: ceiling };
    });
}

// 估算某个名次的赛后评级：相邻两点之间按名次的对数线性插值。超出取样范围时返回 null。
export function estimateRating(points, rank) {
  if (!points.length || rank < points[0].rank || rank > points.at(-1).rank) return null;
  let index = 0;
  while (index < points.length - 1 && points[index + 1].rank <= rank) index++;
  const near = points[index];
  const far = points[index + 1];
  if (!far || near.rank === rank) return near.rating;
  const share = (Math.log(rank) - Math.log(near.rank)) / (Math.log(far.rank) - Math.log(near.rank));
  return Math.round(near.rating + (far.rating - near.rating) * share);
}

// 估算达到某个评级最靠后可以排到第几名。
// 评级高于第一名能拿到的评级时返回 null；不高于最后一名的评级时返回最后一名。
export function estimateRank(points, rating) {
  if (!points.length || rating > points[0].rating) return null;
  let index = 0;
  while (index < points.length - 1 && points[index + 1].rating >= rating) index++;
  const near = points[index];
  const far = points[index + 1];
  if (!far) return near.rank;
  const share = (near.rating - rating) / (near.rating - far.rating);
  const rank = Math.floor(
    Math.exp(Math.log(near.rank) + share * (Math.log(far.rank) - Math.log(near.rank))),
  );
  return Math.max(near.rank, Math.min(far.rank - 1, rank));
}
