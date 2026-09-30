import { fetchUserStatus } from '../../api/codeforces.js';
import { appStorage } from '../../storage/gm.js';
import { sortProblemIds, extractProblemKey } from '../../utils/problem.js';
import { applyProblemTagsVisibility } from '../appearance/problem-tags.js';

// 当前账号已解决题目的内存副本。
export let userSolvedCache = null;

// 防止同一时刻重复请求已解决题目。
export let isFetchingUserSolved = false;

// 从页头登录链接识别当前账号。
export function getCurrentUserHandle() {
  const userLink = document.querySelector(
    '#header .lang-chooser a[href^="/profile/"], #header a[href^="/profile/"]',
  );
  return userLink ? userLink.textContent.trim() : null;
}

// 读取当前账号的已解决集合，优先复用内存。
export function getUserSolvedProblems() {
  const handle = getCurrentUserHandle();
  if (!handle) return new Set();
  if (userSolvedCache && userSolvedCache.handle === handle.toLowerCase()) {
    return userSolvedCache.set;
  }
  const storageKey = 'cf_user_solved_' + handle.toLowerCase();
  const cached = appStorage.getJSON(storageKey, null);
  if (cached && Array.isArray(cached.solved)) {
    userSolvedCache = {
      handle: handle.toLowerCase(),
      time: cached.time || 0,
      set: new Set(cached.solved),
    };
    return userSolvedCache.set;
  }
  return new Set();
}

// 按题号自然顺序保存已解决题目和缓存时间。
export function saveUserSolvedProblems(handle, solvedSet) {
  if (!handle) return;
  const storageKey = 'cf_user_solved_' + handle.toLowerCase();
  const solvedArr = sortProblemIds(Array.from(solvedSet));
  appStorage.setJSON(storageKey, {
    time: Date.now(),
    solved: solvedArr,
  });
  userSolvedCache = {
    handle: handle.toLowerCase(),
    time: Date.now(),
    set: new Set(solvedArr),
  };
}

// 缓存过期时拉取提交记录，更新已解决题目集合。
export function checkAndFetchUserSolved() {
  const handle = getCurrentUserHandle();
  if (!handle || isFetchingUserSolved) return;

  const storageKey = 'cf_user_solved_' + handle.toLowerCase();
  const cached = appStorage.getJSON(storageKey, null);
  const now = Date.now();
  // 15 minutes TTL
  if (cached && cached.time && now - cached.time < 15 * 60 * 1000 && Array.isArray(cached.solved)) {
    return;
  }

  isFetchingUserSolved = true;
  fetchUserStatus(handle)
    .then((res) => res.json())
    .then((data) => {
      if (data && data.status === 'OK' && Array.isArray(data.result)) {
        const solvedSet = getUserSolvedProblems();
        data.result.forEach((sub) => {
          if (sub.verdict === 'OK' && sub.problem && sub.problem.contestId && sub.problem.index) {
            solvedSet.add(`${sub.problem.contestId}${sub.problem.index}`.toUpperCase());
          }
        });
        saveUserSolvedProblems(handle, solvedSet);
        applyProblemTagsVisibility();
      }
    })
    .catch((err) => {
      console.warn('Failed to fetch user solved status:', err);
    })
    .finally(() => {
      isFetchingUserSolved = false;
    });
}

// 结合页面状态和已解决缓存判断当前题目是否通过。
export function isCurrentPageProblemAccepted() {
  const curKey = extractProblemKey(window.location.href);

  // 1. Direct DOM checks for accepted problem on this page
  const acceptedRows = document.querySelectorAll(
    'table.problems tr.accepted-problem, #sidebar tr.accepted-problem',
  );
  for (const row of acceptedRows) {
    const links = row.querySelectorAll('a[href*="/problem/"]');
    for (const link of links) {
      const linkKey = extractProblemKey(link.href);
      if (linkKey && curKey && linkKey === curKey) {
        return true;
      }
    }
  }

  // 2. Check sidebar or status table submissions specific to current problem
  const verdictEls = document.querySelectorAll('.verdict-accepted, span.verdict-accepted');
  for (const v of verdictEls) {
    const tr = v.closest('tr');
    if (tr) {
      const links = tr.querySelectorAll('a[href*="/problem/"]');
      for (const link of links) {
        const linkKey = extractProblemKey(link.href);
        if (linkKey && curKey && linkKey === curKey) {
          return true;
        }
      }
    }
  }

  // 3. Check cached solved set
  if (curKey) {
    const solvedSet = getUserSolvedProblems();
    if (solvedSet && solvedSet.has(curKey)) {
      return true;
    }
  }

  return false;
}
// 清理各用户的已解决题目内存缓存。
export function clearSolvedMemory() {
  userSolvedCache = null;
}
