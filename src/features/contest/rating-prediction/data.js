import {
  fetchContestStandings,
  fetchContestRatingChanges,
  fetchRatedUsers,
  fetchContestSubmissions,
} from '../../../api/codeforces.js';
import { appStorage } from '../../../storage/gm.js';
import {
  PREDICTION_CACHE_KEY,
  PREDICTION_RATINGS_KEY,
  PREDICTION_LOCK_KEY,
} from '../../../storage/keys.js';
import {
  PREDICTION_REFRESH,
  PREDICTION_PENDING_REFRESH,
  PREDICTION_FINAL_CACHE,
  PREDICTION_API_GAP,
} from '../../../config/cache-policy.js';

const owner = `prediction-${Math.random().toString(36).slice(2)}`;

// 等待时响应关闭开关或页面离开，不积累悬挂计时器。
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const stop = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(
      () => {
        signal.removeEventListener('abort', stop);
        resolve();
      },
      Math.max(0, ms),
    );
    signal.addEventListener('abort', stop, { once: true });
  });
}

// 按数据状态选择刷新时间，官方结果与实时榜单不共用短缓存。
export function snapshotLifetime(snapshot) {
  if (snapshot?.phase === 'unavailable') return 3600000;
  return ['final', 'unrated'].includes(snapshot?.phase)
    ? PREDICTION_FINAL_CACHE
    : snapshot?.phase === 'pending'
      ? PREDICTION_PENDING_REFRESH
      : PREDICTION_REFRESH;
}

// 只读取当前比赛的有效版本，过期结果可由界面带时间展示但不能冒充最新。
export function readSnapshot(contestId) {
  const cache = appStorage.getJSON(PREDICTION_CACHE_KEY, {}) || {};
  const snapshot = cache.version === 1 ? cache.contests?.[contestId] : null;
  // 「有首场账号」的提醒已停用；旧版本存下的快照里可能还带着，读取时去掉。
  if (Array.isArray(snapshot?.warnings))
    snapshot.warnings = snapshot.warnings.filter((key) => key !== 'predictionInitialRating');
  return snapshot &&
    (snapshot.phase !== 'final' || snapshot.ratingSource === 'official-rating-changes') &&
    Array.isArray(snapshot.participants) &&
    Array.isArray(snapshot.warnings) &&
    Number.isFinite(snapshot.fetchedAt) &&
    snapshot.participants.every((p) => typeof p.handle === 'string')
    ? snapshot
    : null;
}

// 全流程短租约防止多个标签页重复抓取大榜单；网络超时后其他页面可接管。
async function acquire(signal) {
  for (;;) {
    const lease = appStorage.getJSON(PREDICTION_LOCK_KEY, {});
    if (lease.owner && lease.until > Date.now()) {
      await wait(Math.min(800, lease.until - Date.now()), signal);
      continue;
    }
    appStorage.setJSON(PREDICTION_LOCK_KEY, {
      owner,
      until: Date.now() + 35000,
      nextAt: lease.nextAt || 0,
    });
    await wait(60 + Math.random() * 60, signal);
    if (appStorage.getJSON(PREDICTION_LOCK_KEY, {}).owner === owner) return;
  }
}

// 同一请求队列遵守最小间隔，并区分 HTTP、JSON 与 CF 业务错误。
async function request(fetcher, signal) {
  let lease = appStorage.getJSON(PREDICTION_LOCK_KEY, {});
  if (lease.owner !== owner) throw new Error('predictionLeaseLost');
  await wait((lease.nextAt || 0) - Date.now(), signal);
  lease = { owner, until: Date.now() + 35000, nextAt: Date.now() + PREDICTION_API_GAP };
  appStorage.setJSON(PREDICTION_LOCK_KEY, lease);
  const response = await fetcher(AbortSignal.any([signal, AbortSignal.timeout(25000)]));
  if (!response.ok) throw new Error('predictionNetworkError');
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error('predictionNetworkError');
  }
  if (body.status !== 'OK') {
    const error = new Error('predictionApiError');
    error.apiComment = body.comment || '';
    throw error;
  }
  return body.result;
}

// 分离评级信息、提交情况与本场资格；未知不自动变成 unrated。
export function classifyParticipant(row, contest, rating, submitted, officialHandles = null) {
  const party = row.party || {};
  const handle = party.members?.[0]?.handle;
  if (party.ghost || (party.participantType && party.participantType !== 'CONTESTANT'))
    return { status: 'unrated', reason: 'unofficial' };
  if (officialHandles)
    return {
      status:
        officialHandles.has(handle) || officialHandles.has(handle?.toLowerCase())
          ? 'rated'
          : 'unrated',
      reason:
        officialHandles.has(handle) || officialHandles.has(handle?.toLowerCase())
          ? 'official'
          : 'notOfficial',
    };
  if (
    contest.isRated === false ||
    /unrated|april fools|marathon|q#|kotlin heroes/i.test(contest.name || '')
  )
    return { status: 'unrated', reason: 'unratedContest' };
  if (
    contest.phase === 'FINISHED' &&
    Date.now() / 1000 - contest.startTimeSeconds - contest.durationSeconds > 3 * 86400
  )
    return { status: 'unknown', reason: 'missingData' };
  if (
    party.ghost ||
    party.teamId ||
    party.members?.length !== 1 ||
    !['CF', 'ICPC'].includes(contest.type)
  )
    return { status: 'unknown', reason: 'unsupported' };
  if (submitted === false) return { status: 'unrated', reason: 'noSubmission' };
  if (submitted !== true || party.participantType !== 'CONTESTANT')
    return { status: 'unknown', reason: 'missingData' };
  const limit = Number.isFinite(contest.ratingUpperBound)
    ? contest.ratingUpperBound
    : /educational/i.test(contest.name || '')
      ? 2100
      : null;
  if (limit !== null && rating !== null && rating >= limit)
    return { status: 'unrated', reason: 'ratingLimit' };
  if (
    contest.isRated !== true &&
    !/codeforces.*round|educational.*round|global round/i.test(contest.name || '')
  )
    return { status: 'unknown', reason: 'unsupported' };
  return { status: 'rated', reason: 'contestRules' };
}

// 提交按 ID 增量扫描；初次必须完整覆盖，不能用零分或第一页缺席判断未提交。
async function submissions(contest, previous, signal, progress) {
  const handles = new Set(previous?.complete ? previous.handles : []);
  const unofficial = new Set(previous?.complete ? previous.unofficial || [] : []);
  const priorId = previous?.complete ? previous.lastId : 0;
  let lastId = priorId;
  let scanned = 0;
  for (let page = 0; page < 50; page++) {
    const list = await request(
      (s) => fetchContestSubmissions(contest.id, page * 10000 + 1, s),
      signal,
    );
    if (!Array.isArray(list)) throw new Error('predictionIncompleteData');
    let reached = false;
    for (const entry of list) {
      lastId = Math.max(lastId, entry.id || 0);
      if (priorId && entry.id <= priorId) reached = true;
      if (entry.author?.participantType && entry.author.participantType !== 'CONTESTANT')
        for (const member of entry.author.members || []) unofficial.add(member.handle);
      if (
        entry.relativeTimeSeconds >= 0 &&
        entry.relativeTimeSeconds <= contest.durationSeconds &&
        entry.author?.participantType === 'CONTESTANT' &&
        !entry.author.ghost
      ) {
        for (const member of entry.author.members || []) handles.add(member.handle);
      }
    }
    scanned += list.length;
    progress(scanned);
    if (reached || list.length < 10000)
      return { complete: true, lastId, handles: [...handles], unofficial: [...unofficial] };
  }
  throw new Error('predictionIncompleteData');
}

// 保存少量比赛快照，评级来源独立存储；禁止增长成无上限的历史数据库。
function saveSnapshot(snapshot) {
  const cache = appStorage.getJSON(PREDICTION_CACHE_KEY, {});
  const contests = cache.version === 1 ? cache.contests || {} : {};
  contests[snapshot.id] = snapshot;
  const keep = Object.values(contests)
    .sort((a, b) => b.fetchedAt - a.fetchedAt)
    .slice(0, 3);
  appStorage.setJSON(PREDICTION_CACHE_KEY, {
    version: 1,
    contests: Object.fromEntries(keep.map((c) => [c.id, c])),
  });
}

// 以比赛为边界获取一致输入；官方已出分时不下载现在的用户 Rating。
export async function loadSnapshot(contestId, { signal, force = false, progress = () => {} }) {
  let previous = readSnapshot(contestId);
  if (!force && previous && Date.now() - previous.fetchedAt < snapshotLifetime(previous))
    return previous;
  try {
    await acquire(signal);
    previous = readSnapshot(contestId);
    if (!force && previous && Date.now() - previous.fetchedAt < snapshotLifetime(previous))
      return previous;
    const standing = await request((s) => fetchContestStandings(contestId, s), signal);
    const { contest, rows } = standing;
    if (!contest || !Array.isArray(rows) || Number(contest.id) !== Number(contestId))
      throw new Error('predictionIncompleteData');
    const standingsAt = Date.now();
    let changes = null;
    if (contest.phase === 'FINISHED') {
      try {
        const data = await request((s) => fetchContestRatingChanges(contestId, s), signal);
        if (Array.isArray(data) && data.length) changes = data;
      } catch (error) {
        if (
          !/rating changes are unavailable|rating changes.*not available/i.test(
            error.apiComment || '',
          )
        )
          throw error;
      }
    }
    const declaredUnrated =
      contest.isRated === false ||
      /unrated|april fools|marathon|q#|kotlin heroes/i.test(contest.name || '');
    const supported =
      contest.isRated === true ||
      /codeforces.*round|educational.*round|global round/i.test(contest.name || '');
    let ratingSource = null,
      activity = null;
    const warnings = [];
    const historicalUnknown =
      !changes &&
      !declaredUnrated &&
      contest.phase === 'FINISHED' &&
      Date.now() / 1000 - contest.startTimeSeconds - contest.durationSeconds > 3 * 86400;
    if (
      !changes &&
      !declaredUnrated &&
      !historicalUnknown &&
      supported &&
      (contest.phase !== 'BEFORE' ||
        (contest.startTimeSeconds * 1000 - Date.now() < 3600000 && rows.length))
    ) {
      const sourceCache = appStorage.getJSON(PREDICTION_RATINGS_KEY, {}) || {};
      const sources = sourceCache.contests || {};
      ratingSource = sources[contestId] || null;
      const start = contest.startTimeSeconds * 1000;
      const known = new Set((previous?.participants || []).map((p) => p.handle));
      const newParticipant = rows.some(
        (r) =>
          r.party?.participantType === 'CONTESTANT' && !known.has(r.party.members?.[0]?.handle),
      );
      if (
        !ratingSource ||
        newParticipant ||
        (!previous?.ratingSourceAt && ratingSource.fetchedAt < start - 3600000)
      ) {
        const users = await request((s) => fetchRatedUsers(contestId, s), signal);
        if (!Array.isArray(users)) throw new Error('predictionIncompleteData');
        ratingSource = {
          contestId,
          fetchedAt: Date.now(),
          ratings: Object.fromEntries(
            users.filter((u) => Number.isInteger(u.rating)).map((u) => [u.handle, u.rating]),
          ),
        };
        sources[contestId] = ratingSource;
        const keep = Object.values(sources)
          .sort((a, b) => b.fetchedAt - a.fetchedAt)
          .slice(0, 3);
        appStorage.setJSON(PREDICTION_RATINGS_KEY, {
          version: 1,
          contests: Object.fromEntries(keep.map((s) => [s.contestId, s])),
        });
      }
      if (contest.phase !== 'BEFORE')
        activity = await submissions(contest, previous?.activity, signal, progress);
      if (ratingSource?.fetchedAt > start) warnings.push('predictionLateRatings');
    }
    const officialHandles = changes ? new Set(changes.map((c) => c.handle.toLowerCase())) : null;
    const submitted = new Set(activity?.handles || []);
    const previousRows = new Map((previous?.participants || []).map((r) => [r.handle, r]));
    const participants = [];
    // 历史评级记录才是完整计评级人群；官方名次保留排序与并列，不依赖榜单是否漏人。
    if (changes) {
      for (const change of changes) {
        const initial = contestId >= 1360 && change.oldRating === 0;
        const rating = initial ? 1400 : change.oldRating;
        participants.push({
          handle: change.handle,
          points: -change.rank,
          penalty: 0,
          rank: change.rank,
          rating,
          reportedRating: change.oldRating,
          newRating: change.newRating,
          initial,
          submitted: true,
          status: 'rated',
          reason: 'official',
          valid:
            Number.isInteger(rating) &&
            rating >= -500 &&
            rating < 6000 &&
            Number.isInteger(change.rank) &&
            change.rank > 0 &&
            Number.isInteger(change.newRating),
          officialDelta: change.newRating - change.oldRating,
        });
      }
    }
    for (const row of rows) {
      const handle = row.party?.members?.[0]?.handle;
      if (!handle) continue;
      if (officialHandles?.has(handle.toLowerCase())) continue;
      const prior = previousRows.get(handle);
      const reportedRating = prior
        ? prior.reportedRating
        : (ratingSource?.ratings?.[handle] ?? null);
      const initial = changes ? contestId >= 1360 && reportedRating === 0 : reportedRating === null;
      const rating = initial ? 1400 : reportedRating;
      const hasSubmitted = changes
        ? row.problemResults?.some(
            (p) =>
              p.points > 0 || p.rejectedAttemptCount > 0 || p.bestSubmissionTimeSeconds != null,
          )
          ? true
          : null
        : activity?.complete
          ? submitted.has(handle)
          : null;
      const eligibility = classifyParticipant(
        row,
        contest,
        reportedRating,
        hasSubmitted,
        officialHandles,
      );
      const valid =
        Number.isInteger(rating) &&
        rating >= -500 &&
        rating < 6000 &&
        Number.isFinite(row.points) &&
        Number.isFinite(row.penalty);
      participants.push({
        handle,
        points: row.points,
        penalty: row.penalty,
        rank: row.rank,
        rating,
        reportedRating,
        initial,
        submitted: hasSubmitted,
        ...eligibility,
        valid,
        officialDelta: null,
      });
    }
    if (
      participants.some((p) => p.status === 'rated' && !p.valid) ||
      participants.some((p) => p.status === 'unknown')
    )
      warnings.push('predictionIncompleteData');
    const snapshot = {
      id: contestId,
      name: contest.name,
      phase: changes
        ? 'final'
        : declaredUnrated
          ? 'unrated'
          : historicalUnknown
            ? 'unavailable'
            : contest.phase === 'FINISHED'
              ? 'pending'
              : contest.phase === 'BEFORE'
                ? 'before'
                : 'live',
      contestPhase: contest.phase,
      ratingSource: changes ? 'official-rating-changes' : 'standings',
      fetchedAt: standingsAt,
      checkedAt: Date.now(),
      ratingSourceAt: previous?.ratingSourceAt || ratingSource?.fetchedAt || null,
      participants,
      activity,
      warnings: [...new Set(warnings)],
    };
    signal.throwIfAborted();
    saveSnapshot(snapshot);
    return snapshot;
  } finally {
    const lease = appStorage.getJSON(PREDICTION_LOCK_KEY, {});
    if (lease.owner === owner)
      appStorage.setJSON(PREDICTION_LOCK_KEY, { until: 0, nextAt: lease.nextAt || 0 });
  }
}
