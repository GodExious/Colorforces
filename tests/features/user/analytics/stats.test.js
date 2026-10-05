import test from 'node:test';
import assert from 'node:assert/strict';
import { packSubmissions } from '../../../../src/features/user/analytics/pack.js';
import {
  bucketRating,
  collectProblems,
  coveredProblems,
  zoneDay,
  longestStreak,
  summarize,
  ratingDistribution,
  tagDistribution,
  tagTotals,
  solvedByDay,
  monthlyActivity,
  recentAverage,
  unsolvedProblems,
  languageDistribution,
  verdictDistribution,
  attemptsDistribution,
  participationDistribution,
  contestSpeed,
  hourlyActivity,
  zoneHour,
  zoneMonth,
  spanStart,
  tagWeakness,
  SPEED_BUCKETS,
  RATING_MIN,
  RATING_MAX,
} from '../../../../src/features/user/analytics/stats.js';
import { submission } from '../../../helpers/user-submissions.js';

const DAY = 86400;
// 测试里按协调世界时分天，结果不随运行机器的时区变化。
const dayOf = (seconds) => Math.floor(seconds / DAY);
const collect = (submissions, options = {}) =>
  collectProblems(packSubmissions('alice', submissions), { dayOf, ...options });

test('难度分按百位归档：低于 800 记为 800，3500 及以上都记为 3500', () => {
  assert.equal(bucketRating(1600), 1600);
  assert.equal(bucketRating(1699), 1600);
  assert.equal(bucketRating(1647.5), 1600);
  assert.equal(bucketRating(500), RATING_MIN);
  assert.equal(bucketRating(899), RATING_MIN);
  assert.equal(bucketRating(3500), RATING_MAX);
  assert.equal(bucketRating(3599), RATING_MAX);
  assert.equal(bucketRating(3600), RATING_MAX);
  assert.equal(bucketRating(4850), RATING_MAX);
  assert.equal(bucketRating(null), null);
  assert.equal(bucketRating(0), null);
  assert.equal(bucketRating(undefined), null);
});

test('同一道题多次通过只算一次，尝试次数只数到首次通过', () => {
  const collected = collect([
    submission({ id: 1, verdict: 'WRONG_ANSWER' }),
    submission({ id: 2, verdict: 'TIME_LIMIT_EXCEEDED' }),
    submission({ id: 3, verdict: 'OK' }),
    submission({ id: 4, verdict: 'WRONG_ANSWER' }),
    submission({ id: 5, verdict: 'OK' }),
  ]);
  assert.equal(collected.problems.size, 1);
  assert.deepEqual(collected.problems.get('1000A'), {
    key: '1000A',
    tries: 3,
    solved: true,
    solvedAt: 3,
  });
  assert.equal(collected.submissions, 5);
  assert.equal(collected.accepted, 2);
});

test('编译失败和被跳过的提交不算一次尝试', () => {
  const collected = collect([
    submission({ id: 1, verdict: 'COMPILATION_ERROR' }),
    submission({ id: 2, verdict: 'SKIPPED' }),
    submission({ id: 3, verdict: 'OK' }),
  ]);
  assert.equal(collected.problems.get('1000A').tries, 1);
  assert.equal(collected.submissions, 3);
});

test('并行场次的两道同名题题号不同：只过一道算一题，两道都过算两题', () => {
  const one = collect([submission({ id: 1, contestId: 2001, index: 'C', name: 'Same' })]);
  assert.equal([...one.problems.values()].filter((p) => p.solved).length, 1);
  const both = collect([
    submission({ id: 1, contestId: 2001, index: 'C', name: 'Same' }),
    submission({ id: 2, contestId: 2002, index: 'A', name: 'Same' }),
  ]);
  assert.equal([...both.problems.values()].filter((p) => p.solved).length, 2);
});

test('关闭「计入队伍提交」后，队伍的提交完全不参与', () => {
  const submissions = [
    submission({ id: 1, index: 'A', members: ['alice', 'bob'] }),
    submission({ id: 2, index: 'B' }),
  ];
  assert.equal(collect(submissions).problems.size, 2);
  const solo = collect(submissions, { includeTeams: false });
  assert.deepEqual([...solo.problems.keys()], ['1000B']);
  assert.equal(solo.submissions, 1);
  assert.equal(solo.accepted, 1);
});

test('最长连续按天计算并给出起止日，同一天多次通过只算一天', () => {
  assert.deepEqual(longestStreak(new Set()), { length: 0, start: null, end: null });
  assert.deepEqual(longestStreak(new Set([5])), { length: 1, start: 5, end: 5 });
  assert.deepEqual(longestStreak(new Set([1, 2, 3, 7, 8])), { length: 3, start: 1, end: 3 });
  assert.deepEqual(longestStreak(new Set([10, 3, 2, 1, 9, 8, 7])), {
    length: 4,
    start: 7,
    end: 10,
  });
  // 两段一样长时取最近的一段。
  assert.deepEqual(longestStreak(new Set([1, 2, 5, 6])), { length: 2, start: 5, end: 6 });
  const collected = collect([
    submission({ id: 1, time: DAY * 10 + 5, index: 'A' }),
    submission({ id: 2, time: DAY * 10 + 900, index: 'B' }),
    submission({ id: 3, time: DAY * 11 + 5, index: 'C' }),
    submission({ id: 4, time: DAY * 12 + 5, index: 'D', verdict: 'WRONG_ANSWER' }),
    submission({ id: 5, time: DAY * 13 + 5, index: 'E' }),
  ]);
  assert.deepEqual(longestStreak(collected.acceptedDays), { length: 2, start: 10, end: 11 });
});

test('按指定时区划分日期：同一批提交换个时区，连续天数可能不同', () => {
  // 协调世界时 1 月 2 日 20:00 和 1 月 4 日 02:00 各通过一题。
  const first = Date.UTC(2026, 0, 2, 20) / 1000;
  const second = Date.UTC(2026, 0, 4, 2) / 1000;
  assert.equal(zoneDay(0)(first), Math.floor(first / DAY));
  assert.equal(zoneDay(8)(first), Math.floor(first / DAY) + 1);
  assert.equal(zoneDay(-5)(second), Math.floor(second / DAY) - 1);
  const streakIn = (zone) =>
    longestStreak(
      collectProblems(
        packSubmissions('alice', [
          submission({ id: 1, time: first, index: 'A' }),
          submission({ id: 2, time: second, index: 'B' }),
        ]),
        { dayOf: zoneDay(zone) },
      ).acceptedDays,
    );
  // 协调世界时下是 2 日和 4 日，中间隔了一天。
  assert.deepEqual(streakIn(0), {
    length: 1,
    start: Math.floor(second / DAY),
    end: Math.floor(second / DAY),
  });
  // 东八区下是 3 日 04:00 和 4 日 10:00，连续两天。
  assert.equal(streakIn(8).length, 2);
  // 西五区下是 2 日 15:00 和 3 日 21:00，也是连续两天。
  assert.equal(streakIn(-5).length, 2);
});

test('统计摘要：通过率、一次通过率、最高与平均难度、覆盖率', () => {
  const collected = collect([
    submission({ id: 1, time: DAY, index: 'A' }),
    submission({ id: 2, time: DAY * 2, index: 'B', verdict: 'WRONG_ANSWER' }),
    submission({ id: 3, time: DAY * 2 + 1, index: 'B' }),
    submission({ id: 4, time: DAY * 3, index: 'C', verdict: 'WRONG_ANSWER' }),
    submission({ id: 5, time: DAY * 4, contestId: 3000, index: 'A' }),
  ]);
  const ratings = { '1000A': 800, '1000B': 1500 };
  const summary = summarize(collected, {
    ratingOf: (key) => ratings[key] ?? null,
    problemset: new Set(['1000A', '1000B', '1000C', '1000D']),
  });
  assert.equal(summary.submissions, 5);
  assert.equal(summary.accepted, 3);
  assert.equal(summary.acceptRate, 0.6);
  assert.equal(summary.tried, 4);
  assert.equal(summary.solved, 3);
  // 三道已解决的题里，A 和 3000A 是一次通过。按题算的一次通过率可以高于按提交算的通过率。
  assert.equal(summary.firstTry, 2);
  assert.equal(summary.firstTryRate, 2 / 3);
  assert.equal(summary.maxRating, 1500);
  assert.equal(summary.averageRating, 1150);
  assert.equal(summary.streak, 2);
  assert.equal(summary.streakStart, 1);
  assert.equal(summary.streakEnd, 2);
  // 3000A 不在题库里，不计入覆盖。
  assert.equal(summary.covered, 2);
  assert.equal(summary.problemsetSize, 4);
  assert.equal(summary.coverage, 0.5);
});

test('没有任何提交时，比率为空而不是除零', () => {
  const summary = summarize(collect([]), { ratingOf: () => null, problemset: new Set() });
  assert.equal(summary.acceptRate, null);
  assert.equal(summary.firstTryRate, null);
  assert.equal(summary.coverage, null);
  assert.equal(summary.maxRating, null);
  assert.equal(summary.averageRating, null);
  assert.equal(summary.streak, 0);
  assert.equal(summary.streakStart, null);
});

test('难度分布：每档的通过数与题库总数，3500 及以上并入最高一档，没有难度分的单独一栏', () => {
  const collected = collect([
    submission({ id: 1, index: 'A' }),
    submission({ id: 2, index: 'B' }),
    submission({ id: 3, index: 'C' }),
    submission({ id: 4, index: 'D', verdict: 'WRONG_ANSWER' }),
    submission({ id: 5, index: 'E' }),
    submission({ id: 6, index: 'G' }),
  ]);
  const ratings = {
    '1000A': 1600,
    '1000B': 1650,
    '1000C': 500,
    '1000D': 1600,
    '1000F': 1690,
    '1000G': 3720,
    '1000H': 3600,
  };
  const { buckets, unrated } = ratingDistribution(collected, {
    ratingOf: (key) => ratings[key] ?? null,
    problemset: new Set(['1000A', '1000B', '1000C', '1000D', '1000E', '1000F', '1000G', '1000H']),
  });
  assert.equal(buckets.length, (RATING_MAX - RATING_MIN) / 100 + 1);
  assert.deepEqual(
    buckets.find((bucket) => bucket.rating === 1600),
    { rating: 1600, solved: 2, covered: 2, total: 4 },
  );
  assert.deepEqual(buckets[0], { rating: RATING_MIN, solved: 1, covered: 1, total: 1 });
  // 3720 和 3600 都并入 3500 这一档。
  assert.deepEqual(buckets.at(-1), { rating: RATING_MAX, solved: 1, covered: 1, total: 2 });
  assert.deepEqual(unrated, { solved: 1, covered: 1, total: 1 });
});

test('覆盖率按题库里的题算：并行场次的两道同名题只覆盖题库里的一道，不会超过题库总数', () => {
  // 题库只收录了 2001C；2002A 是它在并行场次里的同名题，题库里没有这个题号。
  const collected = collect([
    submission({ id: 1, contestId: 2001, index: 'C', name: 'Same' }),
    submission({ id: 2, contestId: 2002, index: 'A', name: 'Same' }),
    submission({ id: 3, contestId: 2002, index: 'B', name: 'Only here' }),
  ]);
  const problemset = new Set(['2001C']);
  const options = {
    ratingOf: (key) => ({ '2001C': 1600, '2002A': 1600 })[key] ?? null,
    problemset,
    canonical: (key) => (key === '2002A' ? '2001C' : problemset.has(key) ? key : null),
  };
  assert.deepEqual([...coveredProblems(collected, options)], ['2001C']);
  const summary = summarize(collected, options);
  assert.equal(summary.solved, 3);
  assert.equal(summary.covered, 1);
  assert.equal(summary.coverage, 1);
  const { buckets } = ratingDistribution(collected, options);
  assert.deepEqual(
    buckets.find((bucket) => bucket.rating === 1600),
    { rating: 1600, solved: 2, covered: 1, total: 1 },
  );
  // 只通过了并行场次里没被收录的那一道，题库里的那道同样算已覆盖。
  const twinOnly = collect([submission({ id: 1, contestId: 2002, index: 'A', name: 'Same' })]);
  assert.equal(summarize(twinOnly, options).covered, 1);
});

test('标签分布：只统计通过的题，数量多的在前，相同按名称排', () => {
  const collected = collect([
    submission({ id: 1, index: 'A' }),
    submission({ id: 2, index: 'B' }),
    submission({ id: 3, index: 'C', verdict: 'WRONG_ANSWER' }),
  ]);
  const tagsByKey = {
    '1000A': ['math', 'dp'],
    '1000B': ['greedy', 'dp'],
    '1000C': ['graphs'],
  };
  // 题库里还有一道没做过的 D，带 dp 和 math。
  tagsByKey['1000D'] = ['dp', 'math'];
  const tagsOf = (key) => tagsByKey[key] || [];
  const problemset = new Set(['1000A', '1000B', '1000C', '1000D']);
  assert.deepEqual([...tagTotals(problemset, tagsOf)].sort(), [
    ['dp', 3],
    ['graphs', 1],
    ['greedy', 1],
    ['math', 2],
  ]);
  assert.deepEqual(tagDistribution(collected, { tagsOf, problemset }), [
    { tag: 'dp', count: 2, covered: 2, total: 3 },
    { tag: 'greedy', count: 1, covered: 1, total: 1 },
    { tag: 'math', count: 1, covered: 1, total: 2 },
  ]);
});

test('标签分布的覆盖数按题库里的题算：并行场次的同名题只覆盖一道', () => {
  const collected = collect([
    submission({ id: 1, contestId: 2001, index: 'C', name: 'Same' }),
    submission({ id: 2, contestId: 2002, index: 'A', name: 'Same' }),
  ]);
  const problemset = new Set(['2001C']);
  const [dp] = tagDistribution(collected, {
    tagsOf: () => ['dp'],
    problemset,
    canonical: (key) => (key === '2002A' ? '2001C' : problemset.has(key) ? key : null),
  });
  assert.deepEqual(dp, { tag: 'dp', count: 2, covered: 1, total: 1 });
});

const ratings = { '1000A': 1200, '1000B': 2400, '1000C': 800, '1001A': 1900 };
const ratingOf = (key) => ratings[key] ?? null;

test('按天汇总通过的题：记在首次通过的那天，当天最高难度单独给出，未评级的排在最后', () => {
  const collected = collect([
    submission({ id: 1, time: 10, index: 'A' }),
    submission({ id: 2, time: 20, index: 'B' }),
    submission({ id: 3, time: 30, index: 'Z' }),
    // 首次通过的当天又交了一次，不算重做。
    submission({ id: 4, time: 40, index: 'A' }),
    // 第二天又通过了两次已经通过的题：不算新通过，另外列为重做，同一天只列一次。
    submission({ id: 5, time: DAY + 5, index: 'A' }),
    submission({ id: 6, time: DAY + 6, index: 'A' }),
    submission({ id: 7, time: DAY + 7, index: 'C' }),
    // 第三天只通过了一道没有难度分的题。
    submission({ id: 8, time: DAY * 2 + 1, index: 'Y' }),
    // 没通过的题不出现。
    submission({ id: 9, time: DAY * 2 + 2, index: 'X', verdict: 'WRONG_ANSWER' }),
    // 第四天只有重做：难度高的排前面，最高难度为空。
    submission({ id: 10, time: DAY * 3 + 1, index: 'C' }),
    submission({ id: 11, time: DAY * 3 + 2, index: 'B' }),
  ]);
  const days = solvedByDay(collected, { ratingOf, dayOf });
  assert.deepEqual([...days.keys()].sort(), [0, 1, 2, 3]);
  assert.deepEqual(days.get(0), {
    top: 2400,
    problems: [
      { key: '1000B', rating: 2400 },
      { key: '1000A', rating: 1200 },
      { key: '1000Z', rating: null },
    ],
    repeats: [],
  });
  assert.deepEqual(days.get(1), {
    top: 800,
    problems: [{ key: '1000C', rating: 800 }],
    repeats: [{ key: '1000A', rating: 1200 }],
  });
  assert.deepEqual(days.get(2), {
    top: null,
    problems: [{ key: '1000Y', rating: null }],
    repeats: [],
  });
  assert.deepEqual(days.get(3), {
    top: null,
    problems: [],
    repeats: [
      { key: '1000B', rating: 2400 },
      { key: '1000C', rating: 800 },
    ],
  });
});

test('月度活跃度：逐月列出提交数与新通过的题数，中间空着的月份也在', () => {
  const monthOf = (seconds) => Math.floor(seconds / 100);
  const submissions = [
    submission({ id: 1, time: 110, index: 'A', verdict: 'WRONG_ANSWER' }),
    submission({ id: 2, time: 120, index: 'A' }),
    submission({ id: 3, time: 130, index: 'B' }),
    // 隔了一个月：再交一次已通过的题只算提交，不算新通过。
    submission({ id: 4, time: 310, index: 'A' }),
    submission({ id: 5, time: 320, index: 'C', members: ['alice', 'bob'] }),
  ];
  const dataset = packSubmissions('alice', submissions);
  const months = monthlyActivity(dataset, collectProblems(dataset, { dayOf }), { monthOf });
  assert.deepEqual(months, [
    { month: 1, submissions: 3, solved: 2 },
    { month: 2, submissions: 0, solved: 0 },
    { month: 3, submissions: 2, solved: 1 },
  ]);
  // 不计入队伍提交时，队伍交的那一发不算提交，题也不算通过。
  const solo = monthlyActivity(dataset, collectProblems(dataset, { dayOf, includeTeams: false }), {
    monthOf,
    includeTeams: false,
  });
  assert.deepEqual(solo.at(-1), { month: 3, submissions: 1, solved: 0 });
  assert.deepEqual(monthlyActivity(packSubmissions('alice', []), collect([]), { monthOf }), []);
});

test('按指定时区算月份：月初前后几个小时归到哪个月随时区变', () => {
  // 2026-03-01 02:00 UTC。
  const at = Date.UTC(2026, 2, 1, 2) / 1000;
  assert.equal(zoneMonth(0)(at), 2026 * 12 + 2);
  assert.equal(zoneMonth(8)(at), 2026 * 12 + 2);
  // 西五区还是二月的最后一天。
  assert.equal(zoneMonth(-5)(at), 2026 * 12 + 1);
  // 2025-12-31 20:00 UTC，东八区已经是下一年的一月。
  const eve = Date.UTC(2025, 11, 31, 20) / 1000;
  assert.equal(zoneMonth(0)(eve), 2025 * 12 + 11);
  assert.equal(zoneMonth(8)(eve), 2026 * 12);
});

test('近期平均难度：只取最近通过的几道评级题，按通过时间排，未评级的不参与', () => {
  const collected = collect([
    submission({ id: 1, time: 10, index: 'A' }),
    submission({ id: 2, time: 20, index: 'B' }),
    // 未评级的题不占名额。
    submission({ id: 3, time: 30, index: 'Z' }),
    submission({ id: 4, time: 40, index: 'C' }),
    submission({ id: 5, time: 50, contestId: 1001, index: 'A' }),
    // 之后再交一次早就通过的题，不改变它的通过时间。
    submission({ id: 6, time: 60, index: 'A' }),
  ]);
  const recent = recentAverage(collected, { ratingOf, count: 2 });
  assert.deepEqual(recent.problems, [
    { key: '1000C', rating: 800, time: 40 },
    { key: '1001A', rating: 1900, time: 50 },
  ]);
  assert.equal(recent.average, 1350);
  // 题数不够时有几道算几道。
  const wide = recentAverage(collected, { ratingOf, count: 20 });
  assert.deepEqual(
    wide.problems.map((problem) => problem.key),
    ['1000A', '1000B', '1000C', '1001A'],
  );
  assert.equal(wide.average, Math.round((1200 + 2400 + 800 + 1900) / 4));
  // 按时间取：这一刻及以后通过的全部，不看题数。
  const since = recentAverage(collected, { ratingOf, count: 1, since: 40 });
  assert.deepEqual(
    since.problems.map((problem) => problem.key),
    ['1000C', '1001A'],
  );
  assert.equal(since.average, 1350);
  assert.deepEqual(recentAverage(collected, { ratingOf, since: 9999 }), {
    problems: [],
    average: null,
  });
  // 没有评级题、数量无效时都不出错。
  assert.deepEqual(recentAverage(collect([]), { ratingOf, count: 0 }), {
    problems: [],
    average: null,
  });
});

test('未解决的题：尝试过但没通过，难度从高到低，只有编译失败的不算', () => {
  const collected = collect([
    submission({ id: 1, index: 'A', verdict: 'WRONG_ANSWER' }),
    submission({ id: 2, index: 'A', verdict: 'TIME_LIMIT_EXCEEDED' }),
    submission({ id: 3, index: 'B', verdict: 'WRONG_ANSWER' }),
    submission({ id: 4, index: 'Z', verdict: 'RUNTIME_ERROR' }),
    // 通过了的题、只编译失败过的题都不列入。
    submission({ id: 5, index: 'C', verdict: 'WRONG_ANSWER' }),
    submission({ id: 6, index: 'C' }),
    submission({ id: 7, index: 'D', verdict: 'COMPILATION_ERROR' }),
  ]);
  assert.deepEqual(unsolvedProblems(collected, { ratingOf }), [
    { key: '1000B', tries: 1, rating: 2400 },
    { key: '1000A', tries: 2, rating: 1200 },
    { key: '1000Z', tries: 1, rating: null },
  ]);
});

const pack = (submissions) => packSubmissions('alice', submissions);

test('语言分布：每道题按首次通过时的语言计一次，可以把不同版本并成一种', () => {
  const dataset = pack([
    submission({ id: 1, index: 'A', lang: 'GNU C++17', verdict: 'WRONG_ANSWER' }),
    submission({ id: 2, index: 'A', lang: 'PyPy 3-64' }),
    // 已经通过的题换一种语言再过一次，不重复计入。
    submission({ id: 3, index: 'A', lang: 'GNU C++17' }),
    submission({ id: 4, index: 'B', lang: 'GNU C++17' }),
    submission({ id: 5, index: 'C', lang: 'C++20 (GCC 13-64)' }),
    submission({ id: 6, index: 'D', lang: 'Java 21', members: ['alice', 'bob'] }),
  ]);
  assert.deepEqual(languageDistribution(dataset), [
    { language: 'C++20 (GCC 13-64)', count: 1 },
    { language: 'GNU C++17', count: 1 },
    { language: 'Java 21', count: 1 },
    { language: 'PyPy 3-64', count: 1 },
  ]);
  const familyOf = (name) => (name.includes('C++') ? 'C++' : name);
  assert.deepEqual(languageDistribution(dataset, { familyOf, includeTeams: false }), [
    { language: 'C++', count: 2 },
    { language: 'PyPy 3-64', count: 1 },
  ]);
});

test('提交结果分布：全部提交按判题结果计数，从多到少', () => {
  const dataset = pack([
    submission({ id: 1, verdict: 'WRONG_ANSWER' }),
    submission({ id: 2, verdict: 'WRONG_ANSWER' }),
    submission({ id: 3 }),
    submission({ id: 4, verdict: 'COMPILATION_ERROR', members: ['alice', 'bob'] }),
    submission({ id: 5, verdict: undefined }),
  ]);
  dataset.rows[4][2] = dataset.verdicts.push('') - 1;
  assert.deepEqual(verdictDistribution(dataset), [
    { verdict: 'WRONG_ANSWER', count: 2 },
    { verdict: 'COMPILATION_ERROR', count: 1 },
    { verdict: 'OK', count: 1 },
    { verdict: 'TESTING', count: 1 },
  ]);
  assert.deepEqual(
    verdictDistribution(dataset, { includeTeams: false }).map((item) => item.verdict),
    ['WRONG_ANSWER', 'OK', 'TESTING'],
  );
});

test('尝试次数分布：已通过的题按首次通过前交的次数分成四档', () => {
  const tries = (index, wrong) => [
    ...Array.from({ length: wrong }, () => submission({ index, verdict: 'WRONG_ANSWER' })),
    submission({ index }),
  ];
  const collected = collect([
    ...tries('A', 0),
    ...tries('B', 0),
    ...tries('C', 1),
    ...tries('D', 2),
    ...tries('E', 4),
    ...tries('F', 5),
    ...tries('G', 9),
    // 没通过的题不算。
    submission({ index: 'H', verdict: 'WRONG_ANSWER' }),
  ]);
  assert.deepEqual(attemptsDistribution(collected), [
    { id: '1', count: 2 },
    { id: '2', count: 1 },
    { id: '3-5', count: 2 },
    { id: '6+', count: 2 },
  ]);
});

test('参赛类型分布：常见的四种固定在前，没有的记 0，其余有才列出', () => {
  const dataset = pack([
    submission({ id: 1, type: 'PRACTICE' }),
    submission({ id: 2, type: 'PRACTICE' }),
    submission({ id: 3, type: 'CONTESTANT' }),
    submission({ id: 4, type: 'MANAGER' }),
  ]);
  assert.deepEqual(participationDistribution(dataset), [
    { type: 'CONTESTANT', count: 1 },
    { type: 'VIRTUAL', count: 0 },
    { type: 'OUT_OF_COMPETITION', count: 0 },
    { type: 'PRACTICE', count: 2 },
    { type: 'MANAGER', count: 1 },
  ]);
});

test('比赛速度：赛中提交按分钟分段，通过数只算每题赛中的首次通过', () => {
  const inContest = (id, index, minutes, verdict = 'OK') =>
    submission({ id, index, type: 'CONTESTANT', relative: minutes * 60, verdict });
  const dataset = pack([
    inContest(1, 'A', 3),
    inContest(2, 'B', 9, 'WRONG_ANSWER'),
    inContest(3, 'B', 10),
    // 同一道题赛中再过一次不重复算，但仍是一次提交。
    inContest(4, 'A', 50),
    inContest(5, 'C', 200),
    // 练习提交没有赛中时间，不在其中。
    submission({ id: 6, index: 'D' }),
  ]);
  const buckets = contestSpeed(dataset);
  assert.deepEqual(
    buckets.map((bucket) => bucket.from),
    SPEED_BUCKETS,
  );
  assert.equal(buckets.at(-1).to, null);
  const brief = buckets
    .filter((bucket) => bucket.submissions)
    .map(({ from, to, submissions, solved }) => [from, to, submissions, solved]);
  assert.deepEqual(brief, [
    [0, 10, 2, 1],
    [10, 20, 1, 1],
    [45, 60, 1, 0],
    [180, null, 1, 1],
  ]);
});

test('刷题作息：全部提交按钟点计数，另记其中通过的次数', () => {
  const HOUR = 3600;
  const dataset = pack([
    submission({ id: 1, time: 5 * HOUR + 10 }),
    submission({ id: 2, time: 5 * HOUR + 20, verdict: 'WRONG_ANSWER' }),
    submission({ id: 3, time: 23 * HOUR + 59 }),
    submission({ id: 4, time: 24 * HOUR + 5 * HOUR }),
  ]);
  const hourOf = (seconds) => Math.floor(seconds / HOUR) % 24;
  const hours = hourlyActivity(dataset, { hourOf });
  assert.equal(hours.length, 24);
  assert.deepEqual(hours[5], { hour: 5, submissions: 3, accepted: 2 });
  assert.deepEqual(hours[23], { hour: 23, submissions: 1, accepted: 1 });
  assert.deepEqual(hours[0], { hour: 0, submissions: 0, accepted: 0 });
});

test('刷题作息可以只统计最近一段时间：从终点往前数若干天，不限时从头算', () => {
  const HOUR = 3600;
  const until = 400 * DAY;
  assert.equal(spanStart('all', until * 1000), 0);
  assert.equal(spanStart('unknown', until * 1000), 0);
  assert.equal(spanStart('year', until * 1000), 35 * DAY);
  assert.equal(spanStart('quarter', until * 1000), 310 * DAY);
  assert.equal(spanStart('month', until * 1000 + 999), 370 * DAY);
  assert.equal(spanStart('week', until * 1000), 393 * DAY);
  const dataset = packSubmissions('alice', [
    submission({ time: 100 * DAY + 3 * HOUR }),
    submission({ time: 370 * DAY - 1 }),
    submission({ time: 370 * DAY, verdict: 'WRONG_ANSWER' }),
    submission({ time: 399 * DAY + 3 * HOUR }),
  ]);
  const hourOf = (seconds) => Math.floor(seconds / HOUR) % 24;
  const total = (hours) => hours.reduce((sum, item) => sum + item.submissions, 0);
  assert.equal(total(hourlyActivity(dataset, { hourOf })), 4);
  const month = hourlyActivity(dataset, { hourOf, since: spanStart('month', until * 1000) });
  assert.equal(total(month), 2);
  assert.deepEqual(month[0], { hour: 0, submissions: 1, accepted: 0 });
  assert.deepEqual(month[3], { hour: 3, submissions: 1, accepted: 1 });
  const year = hourlyActivity(dataset, { hourOf, since: spanStart('year', until * 1000) });
  assert.equal(total(year), 4);
});

test('标签弱项：各标签下已通过的题平均交了几次，通过题数不够的标签不参与', () => {
  const tagMap = { A: ['dp'], B: ['dp', 'math'], C: ['math'], D: ['greedy'] };
  const tagsOf = (key) => tagMap[key.slice(-1)] || [];
  const collected = collect([
    submission({ index: 'A', verdict: 'WRONG_ANSWER' }),
    submission({ index: 'A', verdict: 'WRONG_ANSWER' }),
    submission({ index: 'A' }),
    submission({ index: 'B' }),
    submission({ index: 'C', verdict: 'WRONG_ANSWER' }),
    submission({ index: 'C' }),
    submission({ index: 'D' }),
    // 没通过的题不算。
    submission({ index: 'E', verdict: 'WRONG_ANSWER' }),
  ]);
  assert.deepEqual(tagWeakness(collected, { tagsOf, minSolved: 2 }), [
    { tag: 'dp', solved: 2, tries: 4, average: 2 },
    { tag: 'math', solved: 2, tries: 3, average: 1.5 },
  ]);
  assert.deepEqual(tagWeakness(collected, { tagsOf, minSolved: 3 }), []);
});

test('按指定时区算钟点：跨过零点时回到 0 到 23 之间', () => {
  const HOUR = 3600;
  const at = 20 * HOUR + 15 * 60;
  assert.equal(zoneHour(0)(at), 20);
  assert.equal(zoneHour(8)(at), 4);
  assert.equal(zoneHour(-5)(at), 15);
  assert.equal(zoneHour(-11)(2 * HOUR), 15);
  const dataset = packSubmissions('alice', [submission({ id: 1, time: at })]);
  assert.equal(hourlyActivity(dataset, { hourOf: zoneHour(8) })[4].submissions, 1);
});
