// 右键菜单名片上的经验条和名字的颜色。只做计算，不碰页面。
// 经验条按现在的评分算（不是到过的最高分）：在这一档里走到了哪、离下一档还差多少。
import { RATING_RANKS, rankForRating } from '../../contest/rating-prediction/algorithm/ranks.js';

// 4000 分以上：原站用这个人自己的名字当段位名（tourist、jiangly），名字全黑（.user-4000；
// 原站样式表里写了首字母红，但名字是行内的、首字母没有单独包起来，实际是全黑）。
export const TOP_RATING = 4000;
// 全黑的名字（4000 分以上、管理员）用的颜色，和插件里别处画管理员的一样。
export const BLACK_INK = 'var(--cf-gray-900)';

// 名字（和名字下面那一行）用的颜色：4000 分以上全黑，其余照段位的颜色；未评级、还没读到的是 null（用默认的字色）。
export function nameInk(rating) {
  if (!Number.isFinite(rating)) return null;
  return rating >= TOP_RATING ? BLACK_INK : rankForRating(rating).color;
}
// 3000～3999 分：和原站一样第一个字是黑的（4000 分以上整个是黑的，不算）。
export const blackFirstLetter = (rating) =>
  Number.isFinite(rating) && rating < TOP_RATING && Boolean(rankForRating(rating).legendary);

// 经验条：
//   { kind: 'rank', share, gap, next, from, to }：share 这一档走了几成（0～1），gap 离下一档还差几分，
//     next 下一档的段位名，from、to 这一档和下一档的颜色（条从 from 渐变到 to）；
//   { kind: 'legend', share, gap, from, to }：3000～3999 分，下一档是 4000 分，段位名是这个人自己的名字，to 是黑的；
//   { kind: 'top' }：4000 分以上，整条黑；{ kind: 'admin' }：管理员不参加评分；{ kind: 'unrated' }：还没有评分。
export function ratingProgress(rating, admin = false) {
  if (admin) return { kind: 'admin' };
  if (!Number.isFinite(rating)) return { kind: 'unrated' };
  if (rating >= TOP_RATING) return { kind: 'top' };
  const rank = rankForRating(rating);
  const next = RATING_RANKS[RATING_RANKS.indexOf(rank) + 1];
  // 最低一档的下边按 0 分算（低于 0 的算 0）。
  const low = Number.isFinite(rank.low) ? rank.low : 0;
  const share = Math.min(1, Math.max(0, (rating - low) / (rank.high - low)));
  const gap = rank.high - rating;
  if (rank.high === TOP_RATING)
    return { kind: 'legend', share, gap, from: rank.color, to: BLACK_INK };
  return { kind: 'rank', share, gap, next: next.name, from: rank.color, to: next.color };
}
