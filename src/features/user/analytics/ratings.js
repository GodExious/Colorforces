import { latestRatingsMap, getPeerContests, getProblemsByContest } from '../../ratings/data.js';
import { cleanProblemTitle } from '../../../utils/problem.js';
import { getProblemRating } from '../../ratings/enhance.js';
import { isGymContest } from './pack.js';

// 题目信息优先取本地题库，题库里没有的取随数据集保存的那一份。
export function problemInfo(dataset, key) {
  const local = latestRatingsMap?.[key];
  if (local) return { name: local.name || '', tags: local.tags || [] };
  const [name = '', , tags = []] = dataset.extra[key] || [];
  return { name, tags };
}

// 生成「题号 → 难度分」的查询。
// follow 为真时沿用「难度分」面板的来源：开了 CList 就用 CList 分，查不到再退回官方分。
// follow 为假时只用官方分，CList 开没开都一样。
// 官方分的查法两种情况完全相同（含并行场次同名题的沿用），题库查不到时退回提交记录里自带的官方分。
export function createRatingLookup(dataset, follow) {
  return (key) => {
    const local = latestRatingsMap?.[key];
    const [name = '', bundled = 0] = dataset.extra[key] || [];
    const rating = getProblemRating(key, local?.name || name, { clist: follow });
    if (typeof rating === 'number') return rating;
    return bundled > 0 ? bundled : null;
  };
}

// 生成「提交记录里的题号 → 题库里对应的题号」的查询，用于计算覆盖率。
// 题库对并行场次的同名题只收录一个题号。通过的是没被收录的那一个时，换成并行场次里同名的那一个；
// 题库里找不到对应的题时返回 null。
export function createCanonicalLookup(dataset) {
  return (key) => {
    if (latestRatingsMap?.[key]) return key;
    const contestId = parseInt(key, 10);
    const name = cleanProblemTitle(dataset.extra[key]?.[0] || '').toLowerCase();
    if (!name || !Number.isFinite(contestId)) return null;
    for (const peer of getPeerContests(contestId)) {
      for (const entry of getProblemsByContest(peer)) {
        if (cleanProblemTitle(entry.item?.name || '').toLowerCase() === name) return entry.key;
      }
    }
    return null;
  };
}

// 本地题库里的全部题号（不含训练营），用于计算覆盖率。
export function problemsetKeys() {
  const keys = new Set();
  for (const key of Object.keys(latestRatingsMap || {})) {
    const match = key.match(/^(\d+)[A-Z]/);
    if (match && !isGymContest(Number(match[1]))) keys.add(key);
  }
  return keys;
}
