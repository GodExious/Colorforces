import { Contestant, RatingCalculator, MIN_RATING_LIMIT, MAX_RATING_LIMIT } from './calculator.js';
import { sampleRanks } from './curve.js';

// 每次计算使用独立选手对象，防止原算法排序污染快照或页面次序。
function calculator(rows) {
  return new RatingCalculator(
    rows.map((row) => new Contestant(row.handle, row.points, row.penalty, row.rating)),
  );
}

// 计算完整榜单；返回按用户名映射的普通结果及内部结算名次。
export function calculateSnapshot(rows) {
  const calc = calculator(rows);
  calc.calculateDeltas(true);
  return Object.fromEntries(
    calc.contestants.map((c) => [
      c.handle,
      { delta: c.delta, performance: c.performance, rank: c.rank },
    ]),
  );
}

/*
 * 把一位选手放到指定的预估名次上，算他的结果。
 * 他自己的名次就是给定的那个整数，不受榜单上现有并列的限制（不然能取的名次只有各个并列组的那几个，没法连续变化）。
 * 其他人之间原来并列的仍然算并列，都取这一组的最后一名，和整场一起算时（reassignRanks）一样。
 * 不能把别人的并列也拆开一人一个名次：那样别人的名次整体变好、涨跌分整体变高，全场修正就会把每个人多压几分，
 * 这里的结果就和榜单上的预测对不上了（实测并列多的一场里统一低 2 分）。
 * 他正好接在自己实际成绩所在的那一组后面时，算作和这一组并列——这就是他现在的名次，结果要和榜单上的一样。
 */
function rankScenario(rows, handle, position) {
  const calc = calculator(rows);
  calc.calcSeed();
  const others = calc.contestants
    .filter((c) => c.handle !== handle)
    .sort((a, b) => b.points - a.points || a.penalty - b.penalty);
  const target = calc.contestants.find((c) => c.handle === handle);
  if (!target) throw new Error('predictionMissingUser');
  // others 里第 index 个人（从 0 数）排在第几位：在这位选手前面的不变，在他后面的往后挪一位。
  const placeOf = (index) => (index < position - 1 ? index + 1 : index + 2);
  const tied = (a, b) => a.points === b.points && a.penalty === b.penalty;
  let rank;
  for (let i = others.length - 1; i >= 0; i--) {
    if (i === others.length - 1 || !tied(others[i], others[i + 1]))
      rank = i === position - 2 && tied(others[i], target) ? position : placeOf(i);
    others[i].rank = rank;
  }
  target.rank = position;
  calc.calcDeltas();
  calc.adjustDeltas();
  return { rank: position, delta: target.delta, rating: target.effectiveRating + target.delta };
}

// 预估名次按整数位置处理，不受当前榜单并列组限制。
function rankPositions(rows, handle) {
  return Array.from({ length: rows.length }, (_, index) => index + 1);
}

// 目标输入提示使用首尾名次的可达结束 Rating，避免把模型不可达的低分当作正常目标。
export function targetBounds(rows, handle) {
  if (!rows.length) throw new Error('predictionMissingUser');
  const first = rankScenario(rows, handle, 1);
  const last = rankScenario(rows, handle, rows.length);
  return {
    rankMin: 1,
    rankMax: rows.length,
    ratingMin: Math.min(first.rating, last.rating),
    ratingMax: Math.max(first.rating, last.rating),
  };
}

// 沿名次取样，得到「名次 → 赛后评级」曲线，供滑杆着色和拖动时的即时估算。
// 首尾两点就是可达范围，与 targetBounds 的结果一致，所以一并返回。
export function targetCurve(rows, handle, count) {
  if (!rows.length) throw new Error('predictionMissingUser');
  const points = sampleRanks(rows.length, count).map((rank) => ({
    rank,
    rating: rankScenario(rows, handle, rank).rating,
  }));
  const first = points[0].rating;
  const last = points.at(-1).rating;
  return {
    rankMin: 1,
    rankMax: rows.length,
    ratingMin: Math.min(first, last),
    ratingMax: Math.max(first, last),
    points,
  };
}

// 反查目标评级对应的名次边界，并对返回边界进行完整结算复核。
export function analyzeTarget(rows, handle, mode, value) {
  if (!rows.length || !Number.isInteger(value)) throw new Error('predictionInvalidInput');
  if (mode === 'rank') {
    if (value < 1 || value > rows.length) throw new Error('predictionInvalidInput');
    return rankScenario(rows, handle, value);
  }
  if (value < MIN_RATING_LIMIT || value >= MAX_RATING_LIMIT)
    throw new Error('predictionInvalidInput');
  const positions = rankPositions(rows, handle);
  const cache = new Map();
  const at = (index) => {
    if (!cache.has(index)) cache.set(index, rankScenario(rows, handle, positions[index]));
    return cache.get(index);
  };
  const first = at(0);
  const last = at(positions.length - 1);
  const minimum = Math.min(first.rating, last.rating);
  const maximum = Math.max(first.rating, last.rating);
  if (value < minimum || value > maximum) throw new Error('predictionTargetOutOfRange');
  let low = 0,
    high = positions.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (at(mid).rating >= value) low = mid;
    else high = mid - 1;
  }
  // 相邻整数边界异常时拒绝给出精确目标，不伪装为可靠单调解。
  for (let i = Math.max(0, low - 3); i < Math.min(positions.length - 1, low + 3); i++)
    if (at(i).rating < at(i + 1).rating) throw new Error('predictionBoundaryUncertain');
  return { ...at(low), target: value };
}
