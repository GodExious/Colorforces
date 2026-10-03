import { appStorage } from '../../storage/gm.js';
import { getRuntimeValue, setRuntimeValues } from '../../storage/runtime.js';
import { PARALLEL_CONTESTS_KEY, CACHE_KEY } from '../../storage/keys.js';
import { CACHE_EXPIRY } from '../../config/cache-policy.js';
import { sortProblemKeys } from '../../utils/problem.js';
import { fetchContestList, fetchProblemset } from '../../api/codeforces.js';

// 当前官方题目评分的内存映射。
export let latestRatingsMap = {};

// 同时间并行比赛的分组缓存。
export let parallelContestsCache = null;

// 比赛编号到并赛成员的索引。
export let contestToPeersMap = null;

// 按比赛编号组织的题目索引。
export let contestProblemsIndex = null;

// 由并赛分组建立反向查询索引。
export function buildParallelContestLookup(groups) {
  contestToPeersMap = new Map();
  if (!Array.isArray(groups)) return;
  for (const group of groups) {
    if (!Array.isArray(group) || group.length <= 1) continue;
    for (const cid of group) {
      const numCid = typeof cid === 'number' ? cid : parseInt(cid, 10);
      if (!isNaN(numCid)) {
        const peers = group
          .map((x) => (typeof x === 'number' ? x : parseInt(x, 10)))
          .filter((id) => id !== numCid && !isNaN(id));
        contestToPeersMap.set(numCid, peers);
      }
    }
  }
}

// 读取并复用持久化的并赛分组。
export function getParallelContests() {
  if (parallelContestsCache) return parallelContestsCache;
  try {
    parallelContestsCache = appStorage.getJSON(PARALLEL_CONTESTS_KEY, null) || [];
    buildParallelContestLookup(parallelContestsCache);
  } catch (e) {
    parallelContestsCache = [];
  }
  return parallelContestsCache;
}

// 返回指定比赛的并行场次。
export function getPeerContests(contestId) {
  if (!contestToPeersMap) {
    getParallelContests();
  }
  const numId = typeof contestId === 'number' ? contestId : parseInt(contestId, 10);
  return (contestToPeersMap && contestToPeersMap.get(numId)) || [];
}

// 评分缓存变化时使题目索引失效。
export function invalidateContestProblemsIndex() {
  contestProblemsIndex = null;
}

// 按比赛编号查找该场全部题目。
export function getProblemsByContest(cid) {
  if (!contestProblemsIndex) {
    contestProblemsIndex = new Map();
    const map = latestRatingsMap || {};
    for (const k in map) {
      const m = k.match(/^(\d+)/);
      if (m) {
        const c = parseInt(m[1], 10);
        if (!contestProblemsIndex.has(c)) {
          contestProblemsIndex.set(c, []);
        }
        contestProblemsIndex.get(c).push({
          key: k,
          item: map[k],
        });
      }
    }
  }
  const numId = typeof cid === 'number' ? cid : parseInt(cid, 10);
  return contestProblemsIndex.get(numId) || [];
}

// 读取有效评分缓存，必要时请求官方题库并关联并赛数据。
export async function getRatings() {
  const cached = appStorage.getJSON(CACHE_KEY, null);
  const cachedTime = Number(getRuntimeValue('ratingsTime')) || 0;
  // 标记已成功拉取的题库语言，旧版无标记缓存会在后台更新。
  const hasEnglishCache = getRuntimeValue('ratingsLocale') === 'en';
  const now = Date.now();

  // Check if cached data already contains the 'name' field and parallel contest data exists
  const sampleKey = cached ? Object.keys(cached)[0] : null;
  const hasNameField = sampleKey && cached[sampleKey] && typeof cached[sampleKey].name === 'string';
  const hasParallelContests = !!appStorage.getItem(PARALLEL_CONTESTS_KEY);

  // Use cache if it's fresh and has required name and parallel contest fields
  if (
    cached &&
    cachedTime &&
    hasEnglishCache &&
    now - cachedTime < CACHE_EXPIRY &&
    hasNameField &&
    hasParallelContests
  ) {
    // Auto-clean any legacy 'NAME:' keys from old cache
    let hasDirty = false;
    const cleaned = {};
    for (const k in cached) {
      if (k.startsWith('NAME:')) {
        hasDirty = true;
      } else {
        cleaned[k] = cached[k];
      }
    }
    if (hasDirty) {
      const sortedCleaned = sortProblemKeys(cleaned);
      appStorage.setJSON(CACHE_KEY, sortedCleaned);
      latestRatingsMap = sortedCleaned;
      getParallelContests();
      return sortedCleaned;
    }
    latestRatingsMap = cached;
    getParallelContests();
    return cached;
  }

  // Fetch new ratings: Request 1 (contest.list) & Request 2 (problemset.problems)
  try {
    console.log('Codeforces Rating Helper: Fetching contest list and problem ratings...');
    const [contestListRes, problemsRes] = await Promise.all([
      fetchContestList().catch((e) => {
        console.warn('Codeforces Rating Helper: Failed to fetch contest.list', e);
        return null;
      }),
      fetchProblemset().catch((e) => {
        console.warn('Codeforces Rating Helper: Failed to fetch problemset.problems', e);
        return null;
      }),
    ]);

    // 1. Process Request 1: Group concurrent contests by startTimeSeconds
    if (contestListRes && contestListRes.ok) {
      try {
        const contestData = await contestListRes.json();
        if (contestData.status === 'OK' && Array.isArray(contestData.result)) {
          const byTime = {};
          for (const c of contestData.result) {
            if (c && c.id && c.startTimeSeconds) {
              if (!byTime[c.startTimeSeconds]) {
                byTime[c.startTimeSeconds] = [];
              }
              byTime[c.startTimeSeconds].push(c.id);
            }
          }
          const parallelGroups = Object.values(byTime)
            .filter((g) => g.length > 1)
            .map((g) => g.sort((a, b) => a - b))
            .sort((a, b) => a[0] - b[0]);

          appStorage.setJSON(PARALLEL_CONTESTS_KEY, parallelGroups);
          parallelContestsCache = parallelGroups;
          buildParallelContestLookup(parallelGroups);
          console.log(
            `Codeforces Rating Helper: Grouped ${parallelGroups.length} parallel contest sets.`,
          );
        }
      } catch (cErr) {
        console.warn('Codeforces Rating Helper: Error parsing contest.list', cErr);
      }
    } else {
      getParallelContests();
    }

    // 2. Process Request 2: Problemset problems and statistics
    if (problemsRes && problemsRes.ok) {
      const data = await problemsRes.json();
      if (data.status === 'OK' && Array.isArray(data.result?.problems)) {
        const statsMap = {};
        if (Array.isArray(data.result.problemStatistics)) {
          for (const s of data.result.problemStatistics) {
            if (s && s.contestId && s.index) {
              statsMap[`${s.contestId}${s.index}`.toUpperCase()] = s.solvedCount || 0;
            }
          }
        }

        // Preserve existing cached items so dynamically matched parallel items are retained
        // 语言迁移时重建名称索引，避免未覆盖的旧俄文条目继续残留。
        const ratingsMap = Object.assign({}, hasEnglishCache ? cached || {} : {});
        if (Array.isArray(data.result.problems)) {
          for (const p of data.result.problems) {
            if (!p || !p.contestId || !p.index) continue;
            const key = `${p.contestId}${p.index}`.toUpperCase();
            ratingsMap[key] = {
              name: p.name || '',
              rating: typeof p.rating === 'number' ? p.rating : null,
              tags: Array.isArray(p.tags) ? p.tags : [],
              solvedCount: statsMap[key] || 0,
            };
          }
        }

        // Save to appStorage sorted by key
        const sortedRatingsMap = sortProblemKeys(ratingsMap);
        appStorage.setJSON(CACHE_KEY, sortedRatingsMap);
        setRuntimeValues({ ratingsTime: now, ratingsLocale: 'en' });
        latestRatingsMap = sortedRatingsMap;
        invalidateContestProblemsIndex();

        console.log(
          'Codeforces Rating Helper: Ratings and problem names fetched and cached successfully.',
        );
        return sortedRatingsMap;
      } else {
        console.error(
          'Codeforces Rating Helper: API returned status',
          data ? data.status : 'unknown',
        );
      }
    }
  } catch (e) {
    console.error('Codeforces Rating Helper: Failed to fetch ratings API', e);
  }

  // Fallback to cached if fetch failed but we have something
  if (cached) {
    latestRatingsMap = cached;
    getParallelContests();
    return cached;
  }

  return {};
}
// 清理评分内存缓存，避免磁盘删除后仍显示旧值。
export function clearRatingsMemory() {
  latestRatingsMap = {};
  parallelContestsCache = null;
  contestToPeersMap = null;
  invalidateContestProblemsIndex();
}
