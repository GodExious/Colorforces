import {
  fetchContestStandings,
  fetchContestRatingChanges,
  fetchRatedUsers,
  fetchContestSubmissions,
  fetchUsersByHandle,
} from '../../../api/codeforces.js';
import { appStorage } from '../../../storage/gm.js';
import { appSettings } from '../../../settings.js';
import { PREDICTION_CACHE_CONTESTS } from '../../../config/defaults.js';
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
import {
  isJudged,
  settleTally,
  icpcResult,
  applySubmission,
  applyScoredSubmission,
  scoredResult,
} from './trusted.js';
import { officialParticipants, unratedContest } from './official.js';
import { readReply, noRatingChanges } from './api-reply.js';
import {
  LOOKUP_BATCH,
  resolveRating,
  pendingLookups,
  readLookups,
  unknownHandle,
} from './rating-lookup.js';

const owner = `prediction-${Math.random().toString(36).slice(2)}`;

// 保留最近几场比赛的数据，由设置决定；正在看的这一场总要留着，所以至少一场。
const cacheLimit = () =>
  Math.min(
    PREDICTION_CACHE_CONTESTS.max,
    Math.max(PREDICTION_CACHE_CONTESTS.min, appSettings.contest.prediction.cacheContests),
  );

// 所有比赛的快照存在一个键里，解析一遍要不少时间，而同一段同步代码里常常要用好几次
// （页面刚打开时先读一次来显示、紧接着刷新时又读；存之前查一次还在不在、存的时候又读）。
// 所以这一段里只解析一次；这段代码跑完后作废，别的标签页写进来的新内容下一次照样读得到。
let rememberedCache;
function readCache() {
  if (rememberedCache === undefined) {
    rememberedCache = appStorage.getJSON(PREDICTION_CACHE_KEY, {}) || {};
    queueMicrotask(() => {
      rememberedCache = undefined;
    });
  }
  return rememberedCache;
}

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

/*
 * 一份快照多久之后过期（过期了才重新请求，榜单页开着时也按这个间隔自动刷新）。
 * 比赛正在进行时用短间隔。比赛结束了、还没出分（包括公开 hack 阶段）的隔得久一些：
 * 这段时间榜单变化很少，不值得每分钟请求一次，但还得隔一阵看看官方出分了没有。已经出分的结果不会再变，隔得最久。
 * 还没开赛的等到开赛那一刻；不知道开赛时间（旧版本存的快照）时照旧用短间隔，免得开赛后一直不更新。
 */
export function snapshotLifetime(snapshot) {
  if (!snapshot || snapshot.phase === 'live') return PREDICTION_REFRESH;
  // 「未能确认」这个阶段已经不再产生（这类比赛现在直接认作不计分），存着的只可能是之前留下的：
  // 当它已经过期，下次打开就重新取一次换掉。它本来也只存一小时，不算为旧缓存多花请求。
  if (snapshot.phase === 'unavailable') return 0;
  if (snapshot.phase === 'before')
    return Number.isFinite(snapshot.startsAt)
      ? Math.min(
          PREDICTION_FINAL_CACHE,
          Math.max(PREDICTION_REFRESH, snapshot.startsAt - snapshot.fetchedAt),
        )
      : PREDICTION_REFRESH;
  return snapshot.phase === 'pending' ? PREDICTION_PENDING_REFRESH : PREDICTION_FINAL_CACHE;
}

// 只读取当前比赛的有效版本，过期结果可由界面带时间展示但不能冒充最新。
export function readSnapshot(contestId) {
  const cache = readCache();
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
  // 不先看 HTTP 状态：接口报业务错误时状态是 400，原因在正文里（见 api-reply.js）。
  let body = null;
  try {
    body = await response.json();
  } catch {
    // 正文读不出来，下面按网络错误算。
  }
  const reply = readReply(body);
  if (!reply.error) return reply.result;
  const error = new Error(reply.error);
  error.apiComment = reply.comment;
  throw error;
}

// 分离评级信息、提交情况与本场资格；未知不自动变成 unrated。
// 整场不计分的比赛（见 official.js 的 unratedContest）里，正式参赛的人一律是 unrated.
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
  if (unratedContest(contest, false)) return { status: 'unrated', reason: 'unratedContest' };
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

/*
 * 提交按 ID 增量扫描；初次必须完整覆盖，不能用零分或第一页缺席判断未提交。
 *
 * tallyKind 不为空时（'ICPC' 或 'CF'，算得出成绩的两种赛制）同时记下每个正式参赛者逐题的统计，用来算不在官方榜单里的人的成绩：
 * - 返回的 activity.tally 是「到 lastId 为止」的统计，随快照存下来，下次接着往上记，不用重扫整场。
 * - view 是当前的统计，只用来算这一次的成绩，不存。两者怎么算见 trusted.js 的 settleTally。
 *
 * 统计只有从这场的第一条提交记起才是全的。上一次留下的记录里没有 tally（旧版本存的，那时只记了谁交过题）时，
 * 自动刷新不为了补上它重扫整场：这一场照旧只接着记谁交过题，不算成绩，也不存 tally。
 * 用户自己点了「刷新预测」（rebuild 为真）才从头扫一遍、开始记；这场的缓存没了（被挤掉或清空）之后也一样。
 */
async function submissions(contest, previous, signal, progress, tallyKind = null, rebuild = false) {
  // 这一场要不要记逐题的统计、按哪种赛制记。上一次留下的统计不是这种赛制的（不该出现）就当没有。
  const wantTally = Boolean(tallyKind);
  const apply = tallyKind === 'CF' ? applyScoredSubmission : applySubmission;
  if (previous?.tally && (previous.tallyKind || 'ICPC') !== tallyKind)
    previous = { ...previous, tally: undefined };
  const stale = wantTally && Boolean(previous?.complete) && !previous.tally;
  const resume = previous?.complete && !(stale && rebuild) ? previous : null;
  const tallying = wantTally && (!resume || Boolean(resume.tally));
  const handles = new Set(resume ? resume.handles : []);
  const unofficial = new Set(resume ? resume.unofficial || [] : []);
  const priorId = resume ? resume.lastId : 0;
  let lastId = priorId;
  // 这一次新扫到的正式提交，按提交编号记着：翻页期间有新提交进来，同一条可能出现在两页里。
  const fresh = new Map();
  let pendingId = Infinity;
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
      const seen = priorId && entry.id <= priorId;
      if (seen) reached = true;
      else if (!isJudged(entry.verdict)) pendingId = Math.min(pendingId, entry.id);
      if (entry.author?.participantType && entry.author.participantType !== 'CONTESTANT')
        for (const member of entry.author.members || []) unofficial.add(member.handle);
      if (
        entry.relativeTimeSeconds >= 0 &&
        entry.relativeTimeSeconds <= contest.durationSeconds &&
        entry.author?.participantType === 'CONTESTANT' &&
        !entry.author.ghost
      ) {
        const members = entry.author.members || [];
        for (const member of members) handles.add(member.handle);
        if (tallying && !seen && members.length === 1 && entry.problem?.index)
          fresh.set(entry.id, {
            id: entry.id,
            handle: members[0].handle,
            index: entry.problem.index,
            verdict: entry.verdict,
            passed: entry.passedTestCount || 0,
            seconds: entry.relativeTimeSeconds,
          });
      }
    }
    scanned += list.length;
    progress(scanned);
    if (reached || list.length < 10000) {
      const activity = { complete: true, handles: [...handles], unofficial: [...unofficial] };
      if (!tallying) return { activity: { ...activity, lastId }, view: null };
      const { settledId, tally, view } = settleTally(
        resume?.tally,
        fresh.values(),
        { priorId, newestId: lastId, pendingId },
        apply,
      );
      return { activity: { ...activity, lastId: settledId, tally, tallyKind }, view };
    }
  }
  throw new Error('predictionIncompleteData');
}

// 保存少量比赛快照，评级来源独立存储；禁止增长成无上限的历史数据库。
function saveSnapshot(snapshot) {
  const cache = readCache();
  const contests = cache.version === 1 ? cache.contests || {} : {};
  // 下面要写进新内容，记着的那一份不再作数。
  rememberedCache = undefined;
  contests[snapshot.id] = snapshot;
  const keep = Object.values(contests)
    .sort((a, b) => b.fetchedAt - a.fetchedAt)
    .slice(0, cacheLimit());
  appStorage.setJSON(PREDICTION_CACHE_KEY, {
    version: 1,
    contests: Object.fromEntries(keep.map((c) => [c.id, c])),
  });
}

// 以比赛为边界获取一致输入；官方已出分时不下载现在的用户 Rating。
// stage(段名) 在每一段开始请求前调用，progress(条数) 在核对提交记录时每扫完一页调用。
export async function loadSnapshot(
  contestId,
  { signal, force = false, stage = () => {}, progress = () => {} },
) {
  let previous = readSnapshot(contestId);
  if (!force && previous && Date.now() - previous.fetchedAt < snapshotLifetime(previous))
    return previous;
  try {
    await acquire(signal);
    previous = readSnapshot(contestId);
    if (!force && previous && Date.now() - previous.fetchedAt < snapshotLifetime(previous))
      return previous;
    stage('standings');
    const standing = await request((s) => fetchContestStandings(contestId, s), signal);
    const { contest, rows } = standing;
    if (!contest || !Array.isArray(rows) || Number(contest.id) !== Number(contestId))
      throw new Error('predictionIncompleteData');
    const standingsAt = Date.now();
    let changes = null;
    if (contest.phase === 'FINISHED') {
      stage('ratings');
      try {
        const data = await request((s) => fetchContestRatingChanges(contestId, s), signal);
        if (Array.isArray(data) && data.length) changes = data;
      } catch (error) {
        if (!noRatingChanges(error.apiComment)) throw error;
      }
    }
    // 没有评级变化记录的比赛：名字里写明不计分的、或者结束三天以上的，都是不计分。
    const declaredUnrated = unratedContest(contest, Boolean(changes));
    const supported =
      contest.isRated === true ||
      /codeforces.*round|educational.*round|global round/i.test(contest.name || '');
    // 官方榜单里缺的计分参赛者要从提交记录里补出来（见 trusted.js）。成绩只会按 ICPC 赛制算，
    // 所以只有这种赛制的比赛才记逐题的统计；不按比赛的名字认，Educational 也在其中。
    // 按分数算的赛制要知道每道题的满分（榜单接口里带着）；有哪道题没给满分就算不了，这一场只标标签。
    const maxPoints = Object.fromEntries(
      (standing.problems || []).map((problem) => [problem.index, problem.points]),
    );
    const scored =
      contest.type === 'CF' &&
      Object.keys(maxPoints).length > 0 &&
      Object.values(maxPoints).every((points) => points > 0);
    const wantTally = contest.type === 'ICPC' ? 'ICPC' : scored ? 'CF' : null;
    let ratingSource = null,
      activity = null,
      tallyView = null;
    const warnings = [];
    const previousRows = new Map((previous?.participants || []).map((r) => [r.handle, r]));
    if (
      !changes &&
      !declaredUnrated &&
      supported &&
      (contest.phase !== 'BEFORE' ||
        (contest.startTimeSeconds * 1000 - Date.now() < 3600000 && rows.length))
    ) {
      const sourceCache = appStorage.getJSON(PREDICTION_RATINGS_KEY, {}) || {};
      const sources = sourceCache.contests || {};
      ratingSource = sources[contestId] || null;
      const saveSources = () => {
        sources[contestId] = ratingSource;
        const keep = Object.values(sources)
          .sort((a, b) => b.fetchedAt - a.fetchedAt)
          .slice(0, cacheLimit());
        appStorage.setJSON(PREDICTION_RATINGS_KEY, {
          version: 1,
          contests: Object.fromEntries(keep.map((s) => [s.contestId, s])),
        });
      };
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
        stage('ratings');
        const users = await request((s) => fetchRatedUsers(contestId, s), signal);
        if (!Array.isArray(users)) throw new Error('predictionIncompleteData');
        ratingSource = {
          contestId,
          fetchedAt: Date.now(),
          ratings: Object.fromEntries(
            users.filter((u) => Number.isInteger(u.rating)).map((u) => [u.handle, u.rating]),
          ),
          // 按账号查过的结果跟着留下，名单重新取了也不用再查。
          looked: ratingSource?.looked || {},
        };
        saveSources();
      }
      /*
       * 评级名单不全，名单里没有的人按账号再查一遍（见 rating-lookup.js）。
       * announce：要查时先报「评级」这一段。榜单上的人在核对提交记录之前查，这时报；
       * 核对提交记录之后才知道的人（不在官方榜单里的）接着在那一段里查，不再报，免得进度往回跳。
       */
      const lookUp = async (handles, announce) => {
        let pending = pendingLookups(handles, ratingSource, previousRows);
        if (!pending.length) return;
        if (announce) stage('ratings');
        const looked = { ...ratingSource.looked };
        // 有账号查不到时整批报错：去掉它重查，最多这么几次。
        let retries = 3;
        while (pending.length) {
          const batch = pending.slice(0, LOOKUP_BATCH);
          try {
            const users = await request((s) => fetchUsersByHandle(batch, s), signal);
            Object.assign(looked, readLookups(batch, users));
            pending = pending.slice(batch.length);
          } catch (error) {
            const missing =
              error.message === 'predictionApiError' ? unknownHandle(error.apiComment) : null;
            if (missing && batch.includes(missing) && retries-- > 0) {
              looked[missing] = null;
              pending = pending.filter((handle) => handle !== missing);
              continue;
            }
            // 查不到不算整份预测失败：这些人这一次照旧按首场账号算，下一次刷新再查。
            if (!['predictionApiError', 'predictionNetworkError'].includes(error.message))
              throw error;
            break;
          }
        }
        ratingSource.looked = looked;
        saveSources();
      };
      // 还没开赛时榜单上是报名的人，不查。
      if (contest.phase !== 'BEFORE') {
        await lookUp(
          rows
            .filter((r) => r.party?.participantType === 'CONTESTANT')
            .map((r) => r.party.members?.[0]?.handle),
          true,
        );
        stage('submissions');
        const scan = await submissions(
          contest,
          previous?.activity,
          signal,
          progress,
          wantTally,
          force,
        );
        activity = scan.activity;
        tallyView = scan.view;
        await lookUp(Object.keys(tallyView || {}), false);
      }
      if (ratingSource?.fetchedAt > start) warnings.push('predictionLateRatings');
    }
    const officialHandles = changes ? new Set(changes.map((c) => c.handle.toLowerCase())) : null;
    const submitted = new Set(activity?.handles || []);
    // 历史评级记录才是完整计评级人群；官方名次保留排序与并列，不依赖榜单是否漏人。
    // 团队计分的比赛里一支队合成一个参赛者（见 official.js）。
    const participants = changes ? officialParticipants(changes, rows, contestId) : [];
    for (const row of rows) {
      const handle = row.party?.members?.[0]?.handle;
      if (!handle) continue;
      if (officialHandles?.has(handle.toLowerCase())) continue;
      // 队伍的行带上全部队员的账号，榜单上那一格里有好几个账号，靠它对上。
      const members = (row.party.members || []).map((member) => member.handle).filter(Boolean);
      const reportedRating = resolveRating(handle, previousRows.get(handle), ratingSource);
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
        ...(members.length > 1 ? { members } : {}),
      });
    }
    /*
     * 非可信参赛者：正式交过题、却不在官方榜单里的人。成绩从提交记录里算出来，和榜单里的人一起进计分人群。
     * 评级沿用上一次快照里记下的（赛前的），没有就取评级数据里的；都没有的按首场账号算，和榜单里的人一样。
     * 报名时选了不计分的人在接口里看不出来，会被一起算进去；公开 hack 阶段被 hack 掉的提交这里也看不到，
     * 仍按通过算——两样都等官方出分后以官方数据为准。
     */
    if (tallyView) {
      const listed = new Set(rows.map((row) => row.party?.members?.[0]?.handle).filter(Boolean));
      for (const [handle, problems] of Object.entries(tallyView)) {
        if (listed.has(handle)) continue;
        const reportedRating = resolveRating(handle, previousRows.get(handle), ratingSource);
        const initial = reportedRating === null;
        const rating = initial ? 1400 : reportedRating;
        participants.push({
          handle,
          ...(wantTally === 'CF'
            ? scoredResult(problems, maxPoints, contest.durationSeconds)
            : icpcResult(problems)),
          rank: null,
          rating,
          reportedRating,
          initial,
          submitted: true,
          status: 'rated',
          reason: 'untrusted',
          untrusted: true,
          valid: Number.isInteger(rating) && rating >= -500 && rating < 6000,
          officialDelta: null,
        });
      }
      // 榜单里有的人用不着逐题统计，只把不在榜单里的存下来。
      for (const handle of Object.keys(activity.tally))
        if (listed.has(handle)) delete activity.tally[handle];
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
          : contest.phase === 'FINISHED'
            ? 'pending'
            : contest.phase === 'BEFORE'
              ? 'before'
              : 'live',
      contestPhase: contest.phase,
      // 赛制（ICPC、CF、IOI）。榜单上据此说明不在官方榜单内的人为什么没有预测。
      scoring: contest.type || null,
      // 开赛的时刻（毫秒）。还没开赛的快照靠它决定什么时候再刷新。
      startsAt: Number.isFinite(contest.startTimeSeconds) ? contest.startTimeSeconds * 1000 : null,
      ratingSource: changes ? 'official-rating-changes' : 'standings',
      fetchedAt: standingsAt,
      checkedAt: Date.now(),
      ratingSourceAt: previous?.ratingSourceAt || ratingSource?.fetchedAt || null,
      participants,
      activity,
      warnings: [...new Set(warnings)],
    };
    signal.throwIfAborted();
    // 请求途中这场的缓存被清空了（用户在存储页清的）：这一份是接着被清掉的旧记录算的，不存回去，
    // 不然刚清掉的旧记录又原样回来了。下一次刷新没有缓存，会从头来。
    if (previous && !readSnapshot(contestId)) return snapshot;
    saveSnapshot(snapshot);
    return snapshot;
  } finally {
    const lease = appStorage.getJSON(PREDICTION_LOCK_KEY, {});
    if (lease.owner === owner)
      appStorage.setJSON(PREDICTION_LOCK_KEY, { until: 0, nextAt: lease.nextAt || 0 });
  }
}
