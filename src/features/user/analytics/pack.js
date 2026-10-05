// 把接口返回的提交记录压成只含图表所需字段的数据集，再存入缓存。
// 一条原始提交约 570 字节，压缩后约 30 字节：题号、语言、判题结果、参赛类型都改存序号，
// 题目名称、难度分和标签平时从本地题库查，只有题库里查不到的题才随数据集另存一份。
export const DATASET_VERSION = 1;

// 练习提交没有赛中时间，接口用这个数表示。
const NO_RELATIVE_TIME = 2147483647;

// 训练营的比赛编号从十万起；训练营不计入数据分析。
export const isGymContest = (contestId) => contestId >= 100000;

// 行内各列的位置。
export const ROW = { time: 0, problem: 1, verdict: 2, lang: 3, type: 4, relative: 5, team: 6 };

// known(key) 返回这道题在本地题库里是否查得到。行按提交时间从早到晚排列。
export function packSubmissions(
  handle,
  submissions,
  { fetchedAt = Date.now(), known = () => false } = {},
) {
  const tables = { problems: [], verdicts: [], langs: [], types: [] };
  const lookups = { problems: new Map(), verdicts: new Map(), langs: new Map(), types: new Map() };
  const indexOf = (table, value) => {
    let index = lookups[table].get(value);
    if (index === undefined) {
      index = tables[table].length;
      tables[table].push(value);
      lookups[table].set(value, index);
    }
    return index;
  };
  const extra = {};
  const rows = [];
  const ordered = submissions
    .filter((entry) => entry?.problem?.contestId && !isGymContest(entry.problem.contestId))
    .sort((a, b) => a.creationTimeSeconds - b.creationTimeSeconds || a.id - b.id);
  for (const entry of ordered) {
    const { problem, author = {} } = entry;
    const key = `${problem.contestId}${problem.index}`.toUpperCase();
    if (!known(key) && !extra[key])
      extra[key] = [problem.name || '', problem.rating || 0, problem.tags || []];
    const relative = entry.relativeTimeSeconds;
    rows.push([
      entry.creationTimeSeconds,
      indexOf('problems', key),
      indexOf('verdicts', entry.verdict || ''),
      indexOf('langs', entry.programmingLanguage || ''),
      indexOf('types', author.participantType || ''),
      Number.isFinite(relative) && relative !== NO_RELATIVE_TIME ? relative : -1,
      (author.members?.length || 0) > 1 ? 1 : 0,
    ]);
  }
  return { version: DATASET_VERSION, handle, fetchedAt, ...tables, extra, rows };
}

// 读缓存时检查结构，旧版本或残缺的数据一律当作没有。
export function isDataset(value) {
  return (
    value?.version === DATASET_VERSION &&
    typeof value.handle === 'string' &&
    Number.isFinite(value.fetchedAt) &&
    ['problems', 'verdicts', 'langs', 'types', 'rows'].every((field) =>
      Array.isArray(value[field]),
    ) &&
    typeof value.extra === 'object' &&
    value.extra !== null
  );
}
