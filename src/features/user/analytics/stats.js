// 数据分析的纯计算：只接收数据集和查询函数，不读页面、不读存储，便于单元测试。
import { ROW } from './pack.js';

// 难度分按百位归档，两端收进这个范围：低于 800 记为 800，3500 及以上都记为 3500。
// 官方难度分最高 3500，只有 CList 分会出现更高的，所以用 CList 分时最高一档表示「不低于 3500」。
export const RATING_MIN = 800;
export const RATING_MAX = 3500;
export const RATING_STEP = 100;

// 这些判题结果不算一次尝试：编译失败、被跳过、还在评测。
const NOT_AN_ATTEMPT = new Set(['COMPILATION_ERROR', 'SKIPPED', 'TESTING', '']);

// 把难度分归到所在的档；没有难度分返回 null。
export function bucketRating(rating) {
  if (!Number.isFinite(rating) || rating <= 0) return null;
  return Math.min(RATING_MAX, Math.max(RATING_MIN, Math.floor(rating / RATING_STEP) * RATING_STEP));
}

// 提交时间落在本地时区的第几天，用来判断哪些天是连续的。
export function localDay(seconds) {
  const date = new Date(seconds * 1000);
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000);
}

// 按指定时区划分日期：offsetHours 是相对 UTC 的小时数（东八区为 8）。返回的函数用法同 localDay。
export function zoneDay(offsetHours) {
  return (seconds) => Math.floor((seconds + offsetHours * 3600) / 86400);
}

// 逐题汇总：每道题在首次通过前尝试了几次、是否通过、何时通过。
// 同一道题只算一次；并行场次的两道同名题题号不同，各算各的。
// repeats 另外记下「已经通过的题后来又通过」的每一次提交（{ key, time }），给热力图标出重做的日子。
export function collectProblems(dataset, { includeTeams = true, dayOf = localDay } = {}) {
  const problems = new Map();
  const acceptedDays = new Set();
  const repeats = [];
  const ok = dataset.verdicts.indexOf('OK');
  const ignored = new Set(
    dataset.verdicts.flatMap((verdict, index) => (NOT_AN_ATTEMPT.has(verdict) ? [index] : [])),
  );
  let submissions = 0;
  let accepted = 0;
  for (const row of dataset.rows) {
    if (!includeTeams && row[ROW.team]) continue;
    submissions++;
    const key = dataset.problems[row[ROW.problem]];
    let state = problems.get(key);
    if (!state) problems.set(key, (state = { key, tries: 0, solved: false, solvedAt: 0 }));
    const passed = row[ROW.verdict] === ok;
    if (passed) {
      accepted++;
      acceptedDays.add(dayOf(row[ROW.time]));
      if (state.solved) repeats.push({ key, time: row[ROW.time] });
    }
    if (state.solved || ignored.has(row[ROW.verdict])) continue;
    state.tries++;
    if (passed) {
      state.solved = true;
      state.solvedAt = row[ROW.time];
    }
  }
  return { problems, submissions, accepted, acceptedDays, repeats };
}

// 最长连续多少天都有通过的提交，以及这一段的起止日。有多段一样长时取最近的一段。
export function longestStreak(days) {
  const best = { length: 0, start: null, end: null };
  let run = 0;
  let previous = null;
  for (const day of [...days].sort((a, b) => a - b)) {
    run = previous !== null && day === previous + 1 ? run + 1 : 1;
    if (run >= best.length) Object.assign(best, { length: run, start: day - run + 1, end: day });
    previous = day;
  }
  return best;
}

const ratio = (part, whole) => (whole > 0 ? part / whole : null);

// 已通过的题覆盖了题库里的哪些题。
// 「已解决」按提交记录里的题号数，并行场次的两道同名题算两道；题库里这样的题只收录一个题号。
// 所以算覆盖时要先把通过的题号换成题库里对应的那个题号（canonical），两道同名题只覆盖题库里的一道，
// 否则「通过数」会超过「题库总数」。canonical(key) 返回题库里的题号，题库里没有对应的题时返回 null。
export function coveredProblems(collected, { problemset, canonical }) {
  const resolve = canonical || ((key) => (problemset.has(key) ? key : null));
  const covered = new Set();
  for (const state of collected.problems.values()) {
    if (!state.solved) continue;
    const key = resolve(state.key);
    if (key && problemset.has(key)) covered.add(key);
  }
  return covered;
}

// 统计摘要。ratingOf(key) 给出题目的难度分；problemset 是本地题库里全部题号的集合。
export function summarize(collected, { ratingOf, problemset, canonical }) {
  let solved = 0;
  let firstTry = 0;
  const covered = coveredProblems(collected, { problemset, canonical }).size;
  let rated = 0;
  let ratingSum = 0;
  let maxRating = null;
  for (const state of collected.problems.values()) {
    if (!state.solved) continue;
    solved++;
    if (state.tries === 1) firstTry++;
    const rating = ratingOf(state.key);
    if (!Number.isFinite(rating) || rating <= 0) continue;
    rated++;
    ratingSum += rating;
    if (maxRating === null || rating > maxRating) maxRating = rating;
  }
  const streak = longestStreak(collected.acceptedDays);
  return {
    submissions: collected.submissions,
    accepted: collected.accepted,
    // 提交通过率按提交算：通过的提交 ÷ 全部提交。
    acceptRate: ratio(collected.accepted, collected.submissions),
    tried: collected.problems.size,
    solved,
    // 一次通过率按题算：第一次提交就通过的题 ÷ 已解决的题。
    firstTry,
    firstTryRate: ratio(firstTry, solved),
    maxRating,
    averageRating: rated ? Math.round(ratingSum / rated) : null,
    streak: streak.length,
    streakStart: streak.start,
    streakEnd: streak.end,
    covered,
    problemsetSize: problemset.size,
    coverage: ratio(covered, problemset.size),
  };
}

// 难度分布：每一档通过了多少题（solved）、覆盖了题库里的多少题（covered）、题库里共有多少题（total）。
// 没有难度分的归入 unrated。covered 不会超过 total，算法见 coveredProblems。
export function ratingDistribution(collected, { ratingOf, problemset, canonical }) {
  const buckets = [];
  const byRating = new Map();
  for (let rating = RATING_MIN; rating <= RATING_MAX; rating += RATING_STEP) {
    const bucket = { rating, solved: 0, covered: 0, total: 0 };
    buckets.push(bucket);
    byRating.set(rating, bucket);
  }
  const unrated = { solved: 0, covered: 0, total: 0 };
  const bucketOf = (key) => byRating.get(bucketRating(ratingOf(key))) || unrated;
  for (const key of problemset) bucketOf(key).total++;
  for (const state of collected.problems.values()) if (state.solved) bucketOf(state.key).solved++;
  for (const key of coveredProblems(collected, { problemset, canonical })) bucketOf(key).covered++;
  return { buckets, unrated };
}

// 题库里每个标签各有多少题。它只跟题库有关，算一次可以反复用。
export function tagTotals(problemset, tagsOf) {
  const totals = new Map();
  for (const key of problemset)
    for (const tag of tagsOf(key)) totals.set(tag, (totals.get(tag) || 0) + 1);
  return totals;
}

// 标签分布：每个标签通过了多少题（count）、覆盖了题库里带这个标签的多少题（covered）、
// 题库里带这个标签的共有多少题（total）。按通过数从多到少排，数量相同按名称排。
// 只列出通过过的标签。covered 的算法见 coveredProblems，不会超过 total。
export function tagDistribution(collected, { tagsOf, problemset, canonical, totals }) {
  const counts = new Map();
  for (const state of collected.problems.values()) {
    if (!state.solved) continue;
    for (const tag of tagsOf(state.key)) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  const covered = new Map();
  for (const key of coveredProblems(collected, { problemset, canonical }))
    for (const tag of tagsOf(key)) covered.set(tag, (covered.get(tag) || 0) + 1);
  const all = totals || tagTotals(problemset, tagsOf);
  return [...counts]
    .map(([tag, count]) => ({
      tag,
      count,
      covered: covered.get(tag) || 0,
      total: all.get(tag) || 0,
    }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

// 有难度分时返回它，没有时返回 null。
const ratedValue = (rating) => (Number.isFinite(rating) && rating > 0 ? rating : null);
// 题号的排序：先比场次编号的数值，再比题目序号（1000A 排在 1000B、999F 之后）。
const byKey = (a, b) => a.key.localeCompare(b.key, 'en', { numeric: true });
// 难度从高到低，没有难度分的排在最后，难度相同按题号排。
const byRatingDown = (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || byKey(a, b);

// 按天汇总通过的题，给难度热力图用。每道题记在它首次通过的那一天。
// 返回「第几天 → { problems, repeats, top }」：problems 是当天首次通过的题（难度从高到低）；
// repeats 是以前就通过了、当天又通过了一次的题（同一天多次只列一次，首次通过的当天不算重做）；
// top 是当天首次通过的题里最高的难度分，当天只有未评级的题或只有重做的题时为 null。
export function solvedByDay(collected, { ratingOf, dayOf = localDay }) {
  const days = new Map();
  const at = (day) => {
    let entry = days.get(day);
    if (!entry) days.set(day, (entry = { problems: [], repeats: [], top: null }));
    return entry;
  };
  for (const state of collected.problems.values()) {
    if (!state.solved) continue;
    const entry = at(dayOf(state.solvedAt));
    const rating = ratedValue(ratingOf(state.key));
    entry.problems.push({ key: state.key, rating });
    if (rating !== null && (entry.top === null || rating > entry.top)) entry.top = rating;
  }
  for (const { key, time } of collected.repeats || []) {
    const day = dayOf(time);
    if (day === dayOf(collected.problems.get(key).solvedAt)) continue;
    const entry = at(day);
    if (entry.repeats.some((problem) => problem.key === key)) continue;
    entry.repeats.push({ key, rating: ratedValue(ratingOf(key)) });
  }
  for (const entry of days.values()) {
    entry.problems.sort(byRatingDown);
    entry.repeats.sort(byRatingDown);
  }
  return days;
}

// 提交时间落在本地时区的哪个月：年 × 12 + 月（月从 0 起）。相邻的月份相差 1。
export function localMonth(seconds) {
  const date = new Date(seconds * 1000);
  return date.getFullYear() * 12 + date.getMonth();
}
// 按指定时区算月份：offsetHours 是相对 UTC 的小时数（东八区为 8）。返回的函数用法同 localMonth。
export function zoneMonth(offsetHours) {
  return (seconds) => {
    const date = new Date((seconds + offsetHours * 3600) * 1000);
    return date.getUTCFullYear() * 12 + date.getUTCMonth();
  };
}

// 月度活跃度：每个月的提交数（submissions）和新通过的题数（solved，记在首次通过的那个月）。
// 从有提交的第一个月到最后一个月逐月列出，中间没有提交的月份也在，数字为 0。
export function monthlyActivity(
  dataset,
  collected,
  { includeTeams = true, monthOf = localMonth } = {},
) {
  const months = new Map();
  const at = (month) => {
    let entry = months.get(month);
    if (!entry) months.set(month, (entry = { month, submissions: 0, solved: 0 }));
    return entry;
  };
  for (const row of dataset.rows) {
    if (!includeTeams && row[ROW.team]) continue;
    at(monthOf(row[ROW.time])).submissions++;
  }
  for (const state of collected.problems.values()) {
    if (state.solved) at(monthOf(state.solvedAt)).solved++;
  }
  if (!months.size) return [];
  let first = Infinity;
  let last = -Infinity;
  for (const month of months.keys()) {
    first = Math.min(first, month);
    last = Math.max(last, month);
  }
  return Array.from(
    { length: last - first + 1 },
    (_, offset) =>
      months.get(first + offset) || { month: first + offset, submissions: 0, solved: 0 },
  );
}

// 近期通过题目的平均难度。只看有难度分的已通过题目，取最近通过的 count 道；不满 count 道时有几道算几道。
// 给了 since（秒）时改为按时间取：这一刻及以后通过的全部，不看 count。
// 返回 { problems: [{ key, rating, time }], average }：problems 按通过时间从早到晚排，最后一个是最近通过的；
// average 是这几道题难度分的平均值，没有评级题时为 null。
export function recentAverage(collected, { ratingOf, count = 20, since = 0 }) {
  const span = Math.max(1, Math.floor(count) || 1);
  const solved = [];
  for (const state of collected.problems.values()) {
    if (!state.solved) continue;
    const rating = ratedValue(ratingOf(state.key));
    if (rating !== null) solved.push({ key: state.key, rating, time: state.solvedAt });
  }
  solved.sort((a, b) => a.time - b.time || byKey(a, b));
  const problems =
    since > 0 ? solved.filter((problem) => problem.time >= since) : solved.slice(-span);
  const sum = problems.reduce((total, problem) => total + problem.rating, 0);
  return { problems, average: problems.length ? Math.round(sum / problems.length) : null };
}

// 未解决的题：尝试过但至今没有通过。只交过编译失败这类不算尝试的提交的题不列入。
// 难度从高到低排，没有难度分的排在最后。
export function unsolvedProblems(collected, { ratingOf }) {
  const list = [];
  for (const state of collected.problems.values()) {
    if (state.solved || !state.tries) continue;
    list.push({ key: state.key, tries: state.tries, rating: ratedValue(ratingOf(state.key)) });
  }
  return list.sort(byRatingDown);
}

// 逐条看提交记录，跳过不计入的队伍提交。很多分布都只需要这样过一遍。
function eachRow(dataset, includeTeams, visit) {
  for (const row of dataset.rows) {
    if (!includeTeams && row[ROW.team]) continue;
    visit(row);
  }
}
// 把「名称 → 数量」排成列表：数量从多到少，数量相同按名称排。
const ranked = (counts, field) =>
  [...counts]
    .map(([name, count]) => ({ [field]: name, count }))
    .sort((a, b) => b.count - a.count || String(a[field]).localeCompare(String(b[field])));

// 语言分布：每道已通过的题，按首次通过时用的语言计数。
// familyOf(name) 把同一种语言的不同版本、不同编译器并成一类；不给时按原站的名称各算各的。
// 返回 [{ language, count }]，从多到少。
export function languageDistribution(
  dataset,
  { includeTeams = true, familyOf = (name) => name } = {},
) {
  const ok = dataset.verdicts.indexOf('OK');
  const solved = new Set();
  const counts = new Map();
  eachRow(dataset, includeTeams, (row) => {
    if (row[ROW.verdict] !== ok || solved.has(row[ROW.problem])) return;
    solved.add(row[ROW.problem]);
    const language = familyOf(dataset.langs[row[ROW.lang]]);
    counts.set(language, (counts.get(language) || 0) + 1);
  });
  return ranked(counts, 'language');
}

// 提交结果分布：全部提交按判题结果计数。返回 [{ verdict, count }]，从多到少；
// verdict 是接口里的写法（OK、WRONG_ANSWER……），还在评测、没有结果的记为 TESTING。
export function verdictDistribution(dataset, { includeTeams = true } = {}) {
  const counts = new Map();
  eachRow(dataset, includeTeams, (row) => {
    const verdict = dataset.verdicts[row[ROW.verdict]] || 'TESTING';
    counts.set(verdict, (counts.get(verdict) || 0) + 1);
  });
  return ranked(counts, 'verdict');
}

// 尝试次数分布：每道已通过的题，到首次通过为止交了几次（编译失败这类不算尝试的不计）。
// 分成四档：一次、两次、三到五次、六次及以上。返回 [{ id, count }]，顺序固定，没有题的档也在。
export const ATTEMPT_BUCKETS = [
  { id: '1', min: 1, max: 1 },
  { id: '2', min: 2, max: 2 },
  { id: '3-5', min: 3, max: 5 },
  { id: '6+', min: 6, max: Infinity },
];
export function attemptsDistribution(collected) {
  const buckets = ATTEMPT_BUCKETS.map(({ id }) => ({ id, count: 0 }));
  for (const state of collected.problems.values()) {
    if (!state.solved) continue;
    const at = ATTEMPT_BUCKETS.findIndex(
      ({ min, max }) => state.tries >= min && state.tries <= max,
    );
    if (at >= 0) buckets[at].count++;
  }
  return buckets;
}

// 参赛类型分布：全部提交按提交时的参赛身份计数。
// 常见的四种按固定顺序排在前面（正式参赛、虚拟参赛、未评级参赛、练习），没有的记 0；其余的身份有才列出。
export const PARTICIPATION_TYPES = ['CONTESTANT', 'VIRTUAL', 'OUT_OF_COMPETITION', 'PRACTICE'];
export function participationDistribution(dataset, { includeTeams = true } = {}) {
  const counts = new Map(PARTICIPATION_TYPES.map((type) => [type, 0]));
  eachRow(dataset, includeTeams, (row) => {
    const type = dataset.types[row[ROW.type]] || 'PRACTICE';
    counts.set(type, (counts.get(type) || 0) + 1);
  });
  return [...counts].map(([type, count]) => ({ type, count }));
}

// 比赛速度：赛中的提交按「开赛后第几分钟」分段。每段的提交数（submissions）和通过数（solved）；
// 通过数只算每道题在赛中的首次通过，同一道题赛后或虚拟参赛时再过不重复算。
// 练习提交没有赛中时间，不在其中。各段是左闭右开的分钟数，最后一段没有上限。
export const SPEED_BUCKETS = [0, 10, 20, 30, 45, 60, 90, 120, 180];
export function contestSpeed(dataset, { includeTeams = true } = {}) {
  const ok = dataset.verdicts.indexOf('OK');
  const buckets = SPEED_BUCKETS.map((from, index) => ({
    from,
    to: SPEED_BUCKETS[index + 1] ?? null,
    submissions: 0,
    solved: 0,
  }));
  const solved = new Set();
  eachRow(dataset, includeTeams, (row) => {
    const relative = row[ROW.relative];
    if (!(relative >= 0)) return;
    const minutes = relative / 60;
    let at = buckets.length - 1;
    while (at > 0 && minutes < buckets[at].from) at--;
    buckets[at].submissions++;
    if (row[ROW.verdict] !== ok || solved.has(row[ROW.problem])) return;
    solved.add(row[ROW.problem]);
    buckets[at].solved++;
  });
  return buckets;
}

// 提交时间落在本地时区的几点（0 到 23）。
export const localHour = (seconds) => new Date(seconds * 1000).getHours();
// 按指定时区算钟点：offsetHours 是相对 UTC 的小时数（东八区为 8）。返回的函数用法同 localHour。
export function zoneHour(offsetHours) {
  return (seconds) => (((Math.floor(seconds / 3600) + offsetHours) % 24) + 24) % 24;
}

// 图表上可以选的时间跨度：只看最近多少天以内的；all 不限。刷题作息和近期平均难度各取其中几档。
export const ACTIVITY_SPANS = { all: 0, year: 365, quarter: 90, month: 30, week: 7 };
// 某个跨度从哪一刻算起（秒）；不限时是 0。until 是这段时间的终点（毫秒时间戳），一般取数据的刷新时间。
export function spanStart(span, until) {
  const days = ACTIVITY_SPANS[span] || 0;
  return days ? Math.floor(until / 1000) - days * 86400 : 0;
}

// 刷题作息：提交按一天里的钟点计数。返回 24 项 { hour, submissions, accepted }，accepted 是其中通过的提交数。
// since 是只统计这一刻（秒）及以后的提交；不给就是全部。
export function hourlyActivity(
  dataset,
  { includeTeams = true, hourOf = localHour, since = 0 } = {},
) {
  const ok = dataset.verdicts.indexOf('OK');
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, submissions: 0, accepted: 0 }));
  eachRow(dataset, includeTeams, (row) => {
    if (row[ROW.time] < since) return;
    const entry = hours[hourOf(row[ROW.time])];
    if (!entry) return;
    entry.submissions++;
    if (row[ROW.verdict] === ok) entry.accepted++;
  });
  return hours;
}

// 标签弱项：每个标签下已通过的题，到首次通过为止平均交了几次。平均次数越多，这类题越费劲。
// 通过题数不到 minSolved 的标签不参与，否则只做过一两题的标签会因为偶然的几次失败排到最前。
// 返回 [{ tag, solved, tries, average }]，平均次数从多到少，相同时通过题数多的在前。
export function tagWeakness(collected, { tagsOf, minSolved = 5 }) {
  const tags = new Map();
  for (const state of collected.problems.values()) {
    if (!state.solved) continue;
    for (const tag of tagsOf(state.key)) {
      let entry = tags.get(tag);
      if (!entry) tags.set(tag, (entry = { tag, solved: 0, tries: 0 }));
      entry.solved++;
      entry.tries += state.tries;
    }
  }
  return [...tags.values()]
    .filter((entry) => entry.solved >= minSolved)
    .map((entry) => ({ ...entry, average: entry.tries / entry.solved }))
    .sort((a, b) => b.average - a.average || b.solved - a.solved || a.tag.localeCompare(b.tag));
}
