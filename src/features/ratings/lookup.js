import { appSettings } from '../../settings.js';
import { getClistProblems } from './clist/sync.js';
import { latestRatingsMap, getPeerContests, getProblemsByContest } from './data.js';
import { cleanProblemTitle } from '../../utils/problem.js';

// 结合官方、Clist 和并赛题目查找难度。clist 传 false 时不看 Clist，只按官方分和并赛题目查找。
export function getProblemRating(hrefOrKey, probName, { clist = true } = {}) {
  if (!hrefOrKey) return null;
  const clistEnabled = clist && !!(appSettings.ratings.clist && appSettings.ratings.clist.enabled);
  const clistData = clistEnabled ? getClistProblems() : null;
  const safeRatingsMap = latestRatingsMap || {};

  let key = '';
  let contestId = null;
  let index = '';
  if (typeof hrefOrKey === 'string' && hrefOrKey.includes('/')) {
    const regexes = [
      /\/contest\/(\d+)\/problem\/([A-Za-z0-9_]+)/i,
      /\/problemset\/problem\/(\d+)\/([A-Za-z0-9_]+)/i,
      /\/gym\/(\d+)\/problem\/([A-Za-z0-9_]+)/i,
    ];
    for (const regex of regexes) {
      const match = hrefOrKey.match(regex);
      if (match) {
        contestId = parseInt(match[1], 10);
        index = match[2].toUpperCase();
        key = `${match[1]}${match[2]}`.toUpperCase();
        break;
      }
    }
  } else if (typeof hrefOrKey === 'string') {
    key = hrefOrKey.toUpperCase();
    const match = key.match(/^(\d+)([A-Za-z0-9_]+)$/);
    if (match) {
      contestId = parseInt(match[1], 10);
      index = match[2];
    }
  }

  if (!key) return null;

  // 1. PRIORITY: When Clist is enabled, check direct Clist hit with key
  if (clistEnabled && clistData && clistData[key]) {
    const clistItem = clistData[key];
    const clistRating =
      typeof clistItem === 'number'
        ? clistItem
        : clistItem && typeof clistItem.rating === 'number'
          ? clistItem.rating
          : null;
    if (typeof clistRating === 'number') {
      return clistRating;
    }
  }

  // 2. FALLBACK: Codeforces official problem rating
  // 2.1 Direct hit by key (e.g. 2202A)
  const officialItem = safeRatingsMap[key] || safeRatingsMap[key.toLowerCase()];
  if (officialItem !== undefined && officialItem !== null) {
    const officialRating =
      typeof officialItem === 'number'
        ? officialItem
        : typeof officialItem.rating === 'number'
          ? officialItem.rating
          : null;
    if (typeof officialRating === 'number') {
      return officialRating;
    }
  }

  // 2.2 Parallel contest fallback: find peer contests in the same concurrent group and match by problem name
  if (contestId) {
    const peers = getPeerContests(contestId);
    if (peers && peers.length > 0) {
      let targetName = '';
      if (probName && typeof probName === 'string') {
        targetName = cleanProblemTitle(probName);
      }
      if (!targetName && officialItem && officialItem.name) {
        targetName = cleanProblemTitle(officialItem.name);
      }

      if (targetName) {
        const lowerTarget = targetName.toLowerCase();
        for (const peerId of peers) {
          const peerProblems = getProblemsByContest(peerId);
          for (const pEntry of peerProblems) {
            const pItem = pEntry.item;
            if (pItem && pItem.name) {
              const peerName = cleanProblemTitle(pItem.name).toLowerCase();
              if (peerName === lowerTarget) {
                const peerRating =
                  typeof pItem.rating === 'number'
                    ? pItem.rating
                    : typeof pItem === 'number'
                      ? pItem
                      : null;
                if (typeof peerRating === 'number') {
                  return peerRating;
                }
              }
            }
          }
        }
      }
    }
  }

  return null;
}

// 解析题目链接并返回对应难度信息。
export function getProblemRatingFromHref(href, title) {
  if (!href) return null;
  const regexes = [
    /\/contest\/(\d+)\/problem\/([A-Za-z0-9_]+)/i,
    /\/problemset\/problem\/(\d+)\/([A-Za-z0-9_]+)/i,
    /\/gym\/(\d+)\/problem\/([A-Za-z0-9_]+)/i,
  ];
  for (const regex of regexes) {
    const match = href.match(regex);
    if (match) {
      const rating = getProblemRating(href, title);
      return { contestId: match[1], index: match[2], rating: rating };
    }
  }
  return null;
}
