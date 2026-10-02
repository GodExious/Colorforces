// 与 Codeforces / Carrot 的评级档位一致；边界用于晋级判断，不用当前用户名颜色推算。
export const RATING_RANKS = [
  { name: 'Newbie', abbr: 'N', low: -Infinity, high: 1200, color: '#808080' },
  { name: 'Pupil', abbr: 'P', low: 1200, high: 1400, color: '#008000' },
  { name: 'Specialist', abbr: 'S', low: 1400, high: 1600, color: '#03a89e' },
  { name: 'Expert', abbr: 'E', low: 1600, high: 1900, color: '#0000ff' },
  { name: 'Candidate Master', abbr: 'CM', low: 1900, high: 2100, color: '#aa00aa' },
  { name: 'Master', abbr: 'M', low: 2100, high: 2300, color: '#ff8c00' },
  { name: 'International Master', abbr: 'IM', low: 2300, high: 2400, color: '#ff8c00' },
  { name: 'Grandmaster', abbr: 'GM', low: 2400, high: 2600, color: '#ff0000' },
  { name: 'International Grandmaster', abbr: 'IGM', low: 2600, high: 3000, color: '#ff0000' },
  {
    name: 'Legendary Grandmaster',
    abbr: 'LGM',
    low: 3000,
    high: 4000,
    color: '#ff0000',
    legendary: true,
  },
  { name: 'Tourist', abbr: 'T', low: 4000, high: Infinity, color: '#ff0000', legendary: true },
];
const unrated = { name: 'Unrated', abbr: 'U', color: '#808080', low: -Infinity, high: null };

// 根据数值查档位，缺少评级不能自动解释为 Newbie。
export function rankForRating(rating) {
  if (rating == null || Number.isNaN(rating)) return unrated;
  return RATING_RANKS.find((rank) => rating < rank.high) || RATING_RANKS.at(-1);
}

// 历史使用官方前后评级；实时只提示距下一档的门槛，不冒充已发生的晋级。
export function rankProgress(record, delta, phase) {
  if (record?.status !== 'rated') return null;
  const current = rankForRating(record.reportedRating);
  if (phase === 'final') {
    const after =
      record.newRating ??
      (Number.isFinite(record.reportedRating) && Number.isFinite(delta)
        ? record.reportedRating + delta
        : null);
    if (!Number.isFinite(after)) return null;
    const next = rankForRating(after);
    const direction = next === current ? 'same' : next.low > current.low ? 'up' : 'down';
    return { current, next, direction, before: record.reportedRating, after, final: true };
  }
  if (!Number.isFinite(record.rating)) return null;
  const effective = rankForRating(record.rating);
  const next = RATING_RANKS[RATING_RANKS.indexOf(effective) + 1];
  return {
    current,
    next: next || effective,
    direction: next ? 'up' : 'same',
    needed: next ? next.low - record.rating : null,
    final: false,
  };
}
