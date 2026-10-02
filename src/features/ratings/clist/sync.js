import { appStorage } from '../../../storage/gm.js';
import { CLIST_STORAGE_KEY, CLIST_LAST_SYNC_KEY } from '../../../storage/keys.js';
import { sortProblemKeys } from '../../../utils/problem.js';
import { appSettings } from '../../../settings.js';
import { CLIST_SYNC_COOLDOWN } from '../../../config/cache-policy.js';
import { t } from '../../../i18n/index.js';
import { clistRequest } from '../../../api/clist.js';
import { refreshRatingsOnPage } from '../enhance.js';
import { createClistSyncEstimate } from './estimate.js';

// Clist 题目难度的内存映射。
export let clistProblemsCache = null;

// 读取 Clist 缓存并移除废弃名称别名。
export function getClistProblems() {
  if (clistProblemsCache) return clistProblemsCache;
  try {
    const parsed = appStorage.getJSON(CLIST_STORAGE_KEY, null);
    if (parsed) {
      // Auto-clean any legacy 'NAME:' keys from old cache
      let hasDirty = false;
      const cleaned = {};
      for (const k in parsed) {
        if (k.startsWith('NAME:')) {
          hasDirty = true;
        } else {
          cleaned[k] = parsed[k];
        }
      }
      if (hasDirty) {
        const sortedCleaned = sortProblemKeys(cleaned);
        appStorage.setJSON(CLIST_STORAGE_KEY, sortedCleaned);
        clistProblemsCache = sortedCleaned;
      } else {
        clistProblemsCache = parsed;
      }
    }
  } catch (e) {
    console.error('Colorforces: Failed to read Clist problems cache', e);
  }
  return clistProblemsCache;
}

// 排序并持久化最新 Clist 难度数据。
export function setClistProblems(data) {
  const sorted = sortProblemKeys(data);
  clistProblemsCache = sorted;
  try {
    appStorage.setJSON(CLIST_STORAGE_KEY, sorted);
  } catch (e) {
    console.error('Colorforces: Failed to write Clist problems cache', e);
  }
}

// 规范化用户输入的 Clist Authorization 值。
export function normalizeClistApiKey(rawKey) {
  if (!rawKey) return '';
  let k = rawKey.trim();
  if (k.toLowerCase().startsWith('authorization:')) {
    k = k.substring('authorization:'.length).trim();
  }
  if (k.toLowerCase().startsWith('apikey ')) {
    k = 'ApiKey ' + k.substring('apikey '.length).trim();
  } else {
    k = 'ApiKey ' + k;
  }
  return k;
}

// 计算距离下一次允许同步的剩余时间。
export function getClistCooldownRemaining() {
  const lastSync = parseInt(appStorage.getItem(CLIST_LAST_SYNC_KEY) || '0', 10);
  if (!lastSync) return 0;
  const elapsed = Date.now() - lastSync;
  return Math.max(0, CLIST_SYNC_COOLDOWN - elapsed);
}

// 标记是否已有 Clist 同步任务。
export let isClistSyncing = false;

// 供菜单恢复显示的最近同步进度。
export let currentClistSyncProgress = null;

// 订阅 Clist 进度的视图回调集合。
export const clistSyncListeners = new Set();

// 保存最新进度并通知已挂载视图。
export function notifyClistSyncProgress(progress) {
  currentClistSyncProgress = progress;
  clistSyncListeners.forEach((listener) => {
    try {
      listener(progress);
    } catch (e) {}
  });
}

// 分页同步 Clist 难度，保留请求间隔、限流与重试策略。
export async function syncClistRatings(tFunc, onStatusChange) {
  if (isClistSyncing) {
    openSyncProgress?.();
    return;
  }

  const getLang = () =>
    (typeof appSettings !== 'undefined' && appSettings && appSettings.lang) || 'zh';

  const cooldownRemaining = getClistCooldownRemaining();
  if (cooldownRemaining > 0) {
    // Disabled in cooldown: silent return, no alert prompt
    return;
  }

  const authMode =
    (appSettings.clist && appSettings.clist.authMode) ||
    (appSettings.clist && appSettings.clist.apiKey ? 'api' : 'cookie');
  const rawKey = (appSettings.clist && appSettings.clist.apiKey) || '';

  if (authMode === 'api' && !rawKey) {
    const l = getLang();
    confirmSync({
      title: t('clistSyncTitle', l),
      type: 'warning',
      message: t('syncNeedApiKey', l),
      note: t('syncApiKeyMissingNote', l),
      confirmText: t('popGotItBtn', l),
      lang: l,
    });
    return;
  }

  const normalizedKey = authMode === 'api' && rawKey ? normalizeClistApiKey(rawKey) : '';

  isClistSyncing = true;
  let modal = openSyncProgress(getLang());
  const intervalSeconds = 8;
  const estimate = createClistSyncEstimate({ intervalSeconds });
  const progress = { percent: 0, pulled: 0, total: 0 };

  const updateProgress = (info = {}) => {
    modal.update({ ...info, etaSeconds: estimate.seconds() });
    for (const key of ['percent', 'pulled', 'total'])
      if (info[key] !== undefined) progress[key] = info[key];
    notifyClistSyncProgress({
      ...progress,
      eta: modal.getEtaText ? modal.getEtaText() : '',
    });
  };

  const limit = 1000;
  let offset = 0;
  let totalContests = 2150;
  let estimatedTotalProblems = 13500;
  const problemMap = {};
  let page = 1;
  let uniqueProblemsPulled = 0;

  updateProgress({
    statusType: 'connecting',
    percent: 0,
    pulled: 0,
    total: estimatedTotalProblems,
  });

  const executeSync = async () => {
    isClistSyncing = true;
    estimate.restart();
    const etaTimer = setInterval(() => updateProgress(), 1000);
    try {
      while (true) {
        const totalPages = Math.max(1, Math.ceil(totalContests / limit));
        const remainingPagesEstimate = Math.max(1, Math.ceil((totalContests - offset) / limit));
        estimate.request(remainingPagesEstimate);

        updateProgress({
          statusType: 'fetching',
          statusData: { page, totalPages },
          percent: Math.min(96, Math.round((offset / totalContests) * 100)),
          pulled: uniqueProblemsPulled,
          total: Math.max(uniqueProblemsPulled, estimatedTotalProblems),
        });

        const headers = {};
        if (normalizedKey) {
          headers['Authorization'] = normalizedKey;
        }

        const url = `https://clist.by/api/v4/contest/?resource=codeforces.com&limit=${limit}&offset=${offset}&with_problems=true&total_count=true`;
        let res;
        const requestStarted = performance.now();
        try {
          res = await clistRequest(url, headers);
        } catch (netErr) {
          throw new Error(t('syncNetworkError', getLang()));
        }

        if (res.status === 401 || res.status === 403) {
          if (authMode === 'api') {
            throw new Error(t('syncApiKeyInvalid', getLang()));
          } else {
            throw new Error(t('syncLoginRequired', getLang()));
          }
        }
        if (res.status === 429) {
          estimate.wait(60, remainingPagesEstimate);
          for (let s = 60; s > 0; s--) {
            updateProgress({
              statusType: 'rate_limited',
              statusData: { seconds: s },
            });
            await new Promise((r) => setTimeout(r, 1000));
          }
          continue;
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        estimate.response(performance.now() - requestStarted);

        if (data.meta && typeof data.meta.total_count === 'number') {
          totalContests = data.meta.total_count;
          estimatedTotalProblems = Math.max(
            estimatedTotalProblems,
            Math.round(totalContests * 6.3),
          );
        }

        const contests = data.objects || [];
        for (const c of contests) {
          if (!c.problems || !Array.isArray(c.problems)) continue;
          for (const p of c.problems) {
            let contestId = null;
            let index = '';
            let key = '';

            if (p.url) {
              const match = p.url.match(
                /(?:contest|gym|problemset\/problem)\/(\d+)(?:\/problem)?\/([a-zA-Z0-9_]+)/i,
              );
              if (match) {
                contestId = parseInt(match[1], 10);
                index = match[2].toUpperCase();
                key = `${match[1]}${match[2]}`.toUpperCase();
              }
            }
            if (!key && c.href && p.short) {
              const matchC = c.href.match(/(?:contest|contests|gym)\/(\d+)/i);
              if (matchC) {
                contestId = parseInt(matchC[1], 10);
                index = p.short.toUpperCase();
                key = `${matchC[1]}${p.short}`.toUpperCase();
              }
            }
            if (key) {
              const item = {
                contestId: isNaN(contestId) ? contestId : contestId,
                index: index,
                name: p.name || '',
                rating: typeof p.rating === 'number' ? p.rating : null,
                n_accepted: p.n_accepted || 0,
                n_total: p.n_total || p.n_teams || 0,
                id: p.id || p.code || key,
              };
              if (!problemMap[key]) {
                uniqueProblemsPulled++;
              }
              problemMap[key] = item;

              if (p.code && typeof p.code === 'string') {
                const altKey = p.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (altKey && !problemMap[altKey]) {
                  uniqueProblemsPulled++;
                  problemMap[altKey] = item;
                }
              }
            }
          }
        }

        const hasNext = data.meta?.next && contests.length >= limit;
        const remainingPages = Math.max(
          1,
          Math.ceil((totalContests - offset - contests.length) / limit),
        );
        if (hasNext) estimate.wait(intervalSeconds, remainingPages);

        updateProgress({
          pulled: uniqueProblemsPulled,
          total: Math.max(uniqueProblemsPulled, estimatedTotalProblems),
          percent: Math.min(99, Math.round(((offset + contests.length) / totalContests) * 100)),
        });

        if (!hasNext) {
          break;
        }

        offset += contests.length;
        page++;

        // 分页间隔保持原值，只统一剩余时间的估算口径。
        for (let s = intervalSeconds; s > 0; s--) {
          updateProgress({
            statusType: 'waiting',
            statusData: { seconds: s },
            percent: Math.min(98, Math.round((offset / totalContests) * 100)),
            pulled: uniqueProblemsPulled,
            total: Math.max(uniqueProblemsPulled, estimatedTotalProblems),
          });
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      // 100% COMPLETE SUCCESS
      const sortedProblemMap = sortProblemKeys(problemMap);
      const finalCount = Object.keys(sortedProblemMap).length;
      setClistProblems(sortedProblemMap);

      const now = Date.now();
      appStorage.setItem(CLIST_LAST_SYNC_KEY, String(now));

      modal.setSuccess(finalCount);

      if (onStatusChange) onStatusChange();

      // Dynamically re-evaluate ratings on the entire page
      refreshRatingsOnPage();
    } catch (err) {
      console.error('Colorforces: Clist sync error', err);
      modal.setError(err.message || String(err), () => {
        executeSync();
      });
    } finally {
      clearInterval(etaTimer);
      isClistSyncing = false;
      notifyClistSyncProgress(null);
      if (onStatusChange) onStatusChange();
    }
  };

  executeSync();
}

let confirmSync;
let openSyncProgress;
// 连接同步任务的提示与进度视图，不在业务模块创建 DOM。
export function configureClistUI(confirm, openProgress) {
  confirmSync = confirm;
  openSyncProgress = openProgress;
}
// 删除已失效的 Clist 内存副本。
export function clearClistMemory() {
  clistProblemsCache = null;
}
// 订阅同步任务状态；菜单关闭不取消后台同步。
export function subscribeClistProgress(listener) {
  clistSyncListeners.add(listener);
  return () => clistSyncListeners.delete(listener);
}
