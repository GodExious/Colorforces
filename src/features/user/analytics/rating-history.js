// 评级历史：把接口返回的评级变化压成图表所需的字段，供「评级曲线对比」和「参赛排名曲线对比」画线。
// 每场比赛一行，全是数字；比赛名称另放一张表，和各行一一对应。

// 行内各列的位置：评级更新的时刻（秒）、比赛编号、名次、赛前评级、赛后评级。
export const HISTORY = { time: 0, contest: 1, rank: 2, old: 3, rating: 4 };

// 行按时间从早到晚排列。账号名取接口返回的写法（大小写以原站为准），接口没给时用传进来的。
export function packRatingHistory(handle, changes, { fetchedAt = Date.now() } = {}) {
  const ordered = changes
    .filter((entry) => Number.isFinite(entry?.ratingUpdateTimeSeconds))
    .sort((a, b) => a.ratingUpdateTimeSeconds - b.ratingUpdateTimeSeconds);
  return {
    handle: ordered.at(-1)?.handle || handle,
    fetchedAt,
    rows: ordered.map((entry) => [
      entry.ratingUpdateTimeSeconds,
      entry.contestId || 0,
      entry.rank || 0,
      entry.oldRating || 0,
      entry.newRating || 0,
    ]),
    contests: ordered.map((entry) => entry.contestName || ''),
  };
}

// 读缓存时检查结构，残缺的一律当作没有。
export function isRatingHistory(value) {
  return (
    typeof value?.handle === 'string' &&
    Number.isFinite(value.fetchedAt) &&
    Array.isArray(value.rows) &&
    Array.isArray(value.contests)
  );
}

// 一场比赛归到哪一类：div1 到 div4，其余都是 other。
// 名称里只写了一个级别的归到那一级（「Educational … (Rated for Div. 2)」算 div2）。
// 同时写了几个级别的合并场（「Div. 1 + Div. 2」）按账号赛前的评级归到其中一级：
// 评级够得上哪一级就算哪一级，和分开办的场次里他会去的那一场一致；还没有评级的新账号算最低的那一级。
// 没写级别的（Global Round 等）归到 other。rating 是这个账号赛前的评级。
// 各级别面向的评级：1900 及以上是 Div. 1，1600 及以上是 Div. 2，1400 及以上是 Div. 3，再往下是 Div. 4。
const levelOfRating = (rating) =>
  rating >= 1900 ? 1 : rating >= 1600 ? 2 : rating >= 1400 ? 3 : 4;
export function divisionOf(name, rating = 0) {
  const levels = Array.from(String(name).matchAll(/Div\.?\s*([1-4])/gi), ([, level]) =>
    Number(level),
  );
  if (!levels.length) return 'other';
  // 按评级该去的那一级，收在这一场开设的级别之内。
  const level = Math.min(Math.max(levelOfRating(rating), Math.min(...levels)), Math.max(...levels));
  return `div${level}`;
}

// 某一类比赛的那些场，供「参赛排名曲线对比」画线：division 为 all 时是全部。没有名次的场不要。
// 返回的 rows 和 names（比赛名称）一一对应。
export function rowsOfDivision(history, division = 'all') {
  const rows = [];
  const names = [];
  history.rows.forEach((row, index) => {
    if (row[HISTORY.rank] < 1) return;
    if (division !== 'all' && divisionOf(history.contests[index], row[HISTORY.old]) !== division)
      return;
    rows.push(row);
    names.push(history.contests[index]);
  });
  return { rows, names };
}

// 名次轴上标哪些名次。名次轴是对数的（第 1 名和第 10 名之间，跟第 100 名和第 1000 名之间一样宽），
// 所以刻度取 1、2、5、10、20、50…… 这样的数；范围很宽、这样标太密时，换成 1、3、10、30…… 或只标 10 的整数次方。
// 范围很窄、里面没有几个这样的数时，改成等间隔的整数。best 和 worst 是轴两头的名次（best 较小）。
export function rankTicks(best, worst) {
  const low = Math.max(1, Math.ceil(best));
  const high = Math.max(low, Math.floor(worst));
  const pick = (steps) => {
    const ticks = [];
    for (let power = 1; power <= high; power *= 10)
      for (const step of steps)
        if (step * power >= low && step * power <= high) ticks.push(step * power);
    return ticks;
  };
  const dense = pick([1, 2, 5]);
  if (dense.length >= 3)
    return [dense, pick([1, 3]), pick([1])].find((ticks) => ticks.length <= 8) ?? pick([1]);
  // 等间隔：间隔取 1、2、5 乘以 10 的整数次方，分成四段左右。
  const rough = (high - low) / 4;
  const power = 10 ** Math.floor(Math.log10(Math.max(1, rough)));
  const lead = rough / power;
  const step = Math.max(1, (lead < 1.5 ? 1 : lead < 3.5 ? 2 : lead < 7.5 ? 5 : 10) * power);
  const ticks = [];
  for (let value = Math.ceil(low / step) * step; value <= high; value += step) ticks.push(value);
  return ticks.length ? ticks : [low];
}

// 离某一时刻（秒）最近的是第几场比赛；一场都没有时返回 -1。
export function nearestIndex(rows, time) {
  if (!rows.length) return -1;
  let low = 0;
  let high = rows.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (rows[middle][HISTORY.time] < time) low = middle + 1;
    else high = middle;
  }
  // low 是第一场不早于这一时刻的比赛，再和它前面那一场比一比谁更近。
  const before = low - 1;
  if (before >= 0 && time - rows[before][HISTORY.time] <= rows[low][HISTORY.time] - time)
    return before;
  return low;
}
