import RatingWorker from './worker.js?worker&inline';
import { appSettings, subscribeSettings } from '../../../settings.js';
import { predictionState as state } from './state.js';
import { loadSnapshot, readSnapshot, snapshotLifetime } from './data.js';
import {
  renderPrediction,
  clearPrediction,
  observePredictionTable,
  handleForCell,
  isOfficialStandingsRow,
} from './standings/render.js';
import { readScores, patchScores } from './standings/page-scores.js';
import { fetchUserRating } from '../../../api/codeforces.js';
import {
  newcomerStanding,
  actualBefore,
  displayedAfter,
  withFirstBonus,
} from './algorithm/newcomer.js';
import { subscribeStorageChanges } from '../../storage/cleanup.js';
import { fetchStandingsTable, applyStandingsTable } from './standings/table-sync.js';
import { enhancePageNow } from '../../page/observer.js';

let contestId = null,
  timer = null,
  requestController = null,
  rendering = null,
  started = false,
  generation = 0;

// 复用线程中的 FFT 缓存；取消昂贵任务时终止线程防止旧结果覆盖。
function workerRunner() {
  let worker = null,
    pending = null,
    serial = 0;
  const stop = () => {
    worker?.terminate();
    worker = null;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(new DOMException('Cancelled', 'AbortError'));
      pending = null;
    }
  };
  return {
    stop,
    run(payload) {
      if (pending) stop();
      if (!worker) {
        try {
          worker = new RatingWorker();
        } catch {
          throw new Error('predictionComputeError');
        }
        worker.onmessage = ({ data }) => {
          if (!pending || data.id !== pending.id) return;
          const task = pending;
          pending = null;
          clearTimeout(task.timer);
          data.error ? task.reject(new Error(data.error)) : task.resolve(data.result);
        };
        worker.onerror = () => {
          if (pending) pending.reject(new Error('predictionComputeError'));
          stop();
        };
      }
      return new Promise((resolve, reject) => {
        const id = ++serial;
        pending = {
          resolve,
          reject,
          id,
          timer: setTimeout(() => {
            reject(new Error('predictionComputeError'));
            stop();
          }, 30000),
        };
        worker.postMessage({ ...payload, id });
      });
    },
  };
}
// 取样曲线单独占一个线程：它比单次分析久，不能被每次输入触发的取消打断。
const baseRunner = workerRunner(),
  analysisRunner = workerRunner(),
  boundsRunner = workerRunner(),
  curveRunner = workerRunner(),
  newcomerRunner = workerRunner();
let modelKey = '',
  modelVersion = 0,
  analysisSerial = 0;
const analysisCache = new Map();
const analysisBoundsCache = new Map();
const analysisCurveCache = new Map();
let curvePending = null;
const enabled = () =>
  appSettings.contest.prediction.enabled || appSettings.contest.participationTags.enabled;
const rowsFor = (snapshot) =>
  snapshot?.participants.filter((p) => p.status === 'rated' && p.valid) || [];

/*
 * 单用户分析的新号修正（规则见 algorithm/newcomer.js）。
 * 分析面板里一切都按显示评级说话；算的时候把这个人换成实际评级，算完把赛后评级换回显示评级。
 * 榜单上的预测不动：那里每个人都只有显示评级。
 */
// 「比赛|账号」→ 查到的结论（不是新号记成 null）。没查成的不记，下次打开再查。
const newcomerCache = new Map();
let newcomerSerial = 0;
const correctionFor = (handle) => (state.newcomer?.handle === handle ? state.newcomer : null);
// 赛后的实际评级比显示评级高多少：这一场补完之后还没补的部分。
const shiftOf = (fix) => (fix ? fix.hidden - fix.bonus : 0);
const correctedRows = (snapshot, handle, fix) =>
  fix
    ? rowsFor(snapshot).map((row) =>
        row.handle === handle ? { ...row, rating: actualBefore(row.reportedRating, fix) } : row,
      )
    : rowsFor(snapshot);
/*
 * 计分队伍的成员也能开单用户分析。模型里的参赛者是他所在的队（一支队一个参赛者，评级是队伍评级），
 * 名次怎么变、涨跌多少全队共用；面板上的评级显示这个成员自己的。队伍评级和他自己的评级差的那一截（shift）
 * 在进出模型时换算，做法和新号修正一样。队伍的成员不查新号：团队计分的比赛都在新号规则之前。
 */
function teamMember(snapshot, handle) {
  for (const team of snapshot?.participants || []) {
    if (!team.memberRatings || team.status !== 'rated' || !team.valid) continue;
    const index = team.members.indexOf(handle);
    if (index < 0) continue;
    const before = team.memberRatings[index][0];
    return {
      unit: team.handle,
      shift: team.rating - before,
      before,
      teamRating: team.rating,
      size: team.members.length,
    };
  }
  return null;
}
// 面板打开、或者开着的时候榜单刷新了：这个人是队伍的成员就放进 state.member，返回是不是。
function loadMember(handle) {
  const found = teamMember(state.snapshot, handle);
  if (!found) {
    state.member = null;
    return false;
  }
  const result = state.results?.[found.unit];
  const current =
    result && Number.isInteger(result.rank) && Number.isFinite(result.delta)
      ? { rank: result.rank, rating: found.before + result.delta }
      : null;
  state.member = { handle, ...found, current };
  return true;
}
// 面板里这个人在模型里对应谁（unit）、显示的评级比模型里的低多少（shift）。fix 是新号修正，tag 用来区分缓存。
function subject(handle) {
  const member = state.member?.handle === handle ? state.member : null;
  if (member) return { unit: member.unit, shift: member.shift, fix: null, tag: 'team' };
  const fix = correctionFor(handle);
  return { unit: handle, shift: shiftOf(fix), fix, tag: fix?.played ?? null };
}
// 查一个人的评级记录。偶尔会撞上接口的频率限制，隔一会儿再试一次；还不行就算了，这一次不修正。
async function ratingHistory(handle) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetchUserRating(handle);
      const body = response.ok ? await response.json() : null;
      if (body?.status === 'OK' && Array.isArray(body.result)) return body.result;
    } catch {
      // 网络问题，按没查到处理。
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  return null;
}
/*
 * 面板打开、或者开着的时候榜单刷新了：确认这个人是不是新号，是的话算出修正后的当前结果，一起放进 state.newcomer。
 * 两样一起放，面板上的赛前评级、当前结果、标签同时换过去，不会有只换了一半的时候。
 * 首场账号不等查询：没有评级的人就是第一场，模型里本来就按实际评级 1400 算，换算一下显示评级就行，
 * 所以面板一打开就是修正后的样子（不然会先显示「1400 → …」，一秒后整个跳成「0 → …」）。查询照样发，用来核实。
 */
async function loadNewcomer(handle) {
  const serial = ++newcomerSerial;
  const snapshot = state.snapshot;
  const participant = snapshot?.participants.find((p) => p.handle === handle);
  if (!participant || participant.status !== 'rated' || !participant.valid) return;
  const stale = () =>
    serial !== newcomerSerial || state.openHandle !== handle || state.snapshot !== snapshot;
  const before = participant.reportedRating ?? 0;
  const result = state.results?.[handle];
  const rank = result?.rank;
  // 按 standing 修正，算出当前结果，放进 state.newcomer。不用另外重算的情况下这一步是同步的。
  const settle = async (standing) => {
    let current = null;
    if (Number.isInteger(rank)) {
      if (snapshot.phase === 'final' && Number.isFinite(participant.officialDelta))
        current = { rank, rating: before + participant.officialDelta };
      else if (actualBefore(participant.reportedRating, standing) === participant.rating) {
        // 模型里用的已经是实际评级（首场账号），模型算出的涨跌就是按实际评级算的（榜单上显示的补过分，用 modelDelta）。
        const delta = result.modelDelta ?? result.delta;
        if (Number.isFinite(delta))
          current = { rank, rating: displayedAfter(participant.rating + delta, standing) };
      } else if (!snapshot.warnings.includes('predictionIncompleteData')) {
        try {
          const own = await newcomerRunner.run({
            type: 'analyze',
            rows: correctedRows(snapshot, handle, standing),
            handle,
            mode: 'rank',
            value: rank,
          });
          current = { rank, rating: displayedAfter(own.rating, standing) };
        } catch {
          return;
        }
      }
    }
    if (stale()) return;
    state.newcomer = { handle, ...standing, before, current };
  };
  const key = contestId + '|' + handle;
  let standing = newcomerCache.get(key);
  if (standing === undefined) {
    const first = participant.initial ? newcomerStanding([], contestId) : null;
    if (first) settle(first);
    const history = await ratingHistory(handle);
    if (!history) return;
    standing = newcomerStanding(
      history,
      contestId,
      Number.isFinite(snapshot.startsAt) ? snapshot.startsAt / 1000 : Infinity,
    );
    newcomerCache.set(key, standing);
  }
  if (stale()) return;
  if (!standing) {
    // 先按首场账号算了、核实下来不是：撤掉。
    if (state.newcomer?.handle === handle) state.newcomer = null;
    return;
  }
  await settle(standing);
}

// 展示只消费已有快照，不因 DOM 重绘重新请求。
function render() {
  renderPrediction(state, {
    refresh: () => refreshPrediction(true),
    analyze: openPredictionAnalysis,
  });
}

// 新快照到达或面板关闭时取消旧的单用户任务。
export function cancelPredictionAnalysis(close = false) {
  analysisSerial++;
  analysisRunner.stop();
  boundsRunner.stop();
  state.computing = false;
  state.analysisResult = null;
  state.analysisError = '';
  if (close) {
    curveRunner.stop();
    newcomerSerial++;
    newcomerRunner.stop();
    state.openHandle = null;
    state.newcomer = null;
    state.member = null;
  }
}

// 单实例面板按需分析，避免每行挂载复杂组件。
export function openPredictionAnalysis(handle) {
  if (!appSettings.contest.prediction.enabled || !appSettings.contest.prediction.analysis) return;
  cancelPredictionAnalysis();
  state.newcomer = null;
  // 队伍的成员先认出来再打开面板，面板一出来就是他自己的评级。
  const member = loadMember(handle);
  state.openHandle = handle;
  if (!member) loadNewcomer(handle);
}

// 单用户弹窗的输入范围由同一份快照计算，避免主线程同步排序大榜单。
export async function getPredictionAnalysisBounds(handle) {
  const snapshot = state.snapshot;
  if (!snapshot || !handle) return null;
  const { unit, shift, fix, tag } = subject(handle);
  const key = JSON.stringify([modelVersion, snapshot.fetchedAt, handle, tag]);
  if (analysisBoundsCache.has(key)) return analysisBoundsCache.get(key);
  if (snapshot.warnings.includes('predictionIncompleteData'))
    throw new Error('predictionIncompleteData');
  const raw = await boundsRunner.run({
    type: 'bounds',
    rows: correctedRows(snapshot, handle, fix),
    handle: unit,
  });
  const bounds = {
    ...raw,
    ratingMin: raw.ratingMin - shift,
    ratingMax: raw.ratingMax - shift,
  };
  analysisBoundsCache.set(key, bounds);
  return bounds;
}

// 滑杆用的「名次 → 赛后评级」取样曲线，只依赖当前模型，快照刷新而模型未变时直接复用。
// 同一份曲线正在计算时不重复发起，避免快照刷新把算到一半的任务顶掉重来。
export function getPredictionAnalysisCurve(handle) {
  const snapshot = state.snapshot;
  if (!snapshot || !handle) return Promise.resolve(null);
  const { unit, shift, fix, tag } = subject(handle);
  const key = JSON.stringify([modelVersion, handle, tag]);
  if (analysisCurveCache.has(key)) return Promise.resolve(analysisCurveCache.get(key));
  if (snapshot.warnings.includes('predictionIncompleteData'))
    return Promise.reject(new Error('predictionIncompleteData'));
  if (curvePending?.key === key) return curvePending.promise;
  const promise = curveRunner
    .run({ type: 'curve', rows: correctedRows(snapshot, handle, fix), handle: unit })
    .then((raw) => {
      const curve = {
        ...raw,
        ratingMin: raw.ratingMin - shift,
        ratingMax: raw.ratingMax - shift,
        points: raw.points.map((point) => ({ ...point, rating: point.rating - shift })),
      };
      analysisCurveCache.set(key, curve);
      if (analysisCurveCache.size > 8)
        analysisCurveCache.delete(analysisCurveCache.keys().next().value);
      return curve;
    })
    .finally(() => {
      if (curvePending?.promise === promise) curvePending = null;
    });
  curvePending = { key, promise };
  return promise;
}

// 结果回传时核对快照和用户，过期计算不能覆盖新输入。
export async function runPredictionAnalysis(mode, value) {
  const snapshot = state.snapshot,
    handle = state.openHandle;
  if (
    !snapshot ||
    !handle ||
    !appSettings.contest.prediction.enabled ||
    !appSettings.contest.prediction.analysis
  )
    return;
  cancelPredictionAnalysis();
  state.computing = true;
  const serial = analysisSerial,
    version = modelVersion;
  const { unit, shift, fix, tag } = subject(handle);
  const cacheKey = JSON.stringify([handle, mode, value, tag]);
  try {
    if (snapshot.warnings.includes('predictionIncompleteData'))
      throw new Error('predictionIncompleteData');
    const result =
      analysisCache.get(cacheKey) ||
      (await analysisRunner.run({
        type: 'analyze',
        rows: correctedRows(snapshot, handle, fix),
        handle: unit,
        mode,
        // 面板里给的目标评级是显示评级，换成实际评级去算。
        value: mode === 'rating' ? value + shift : value,
      }));
    if (version !== modelVersion || state.openHandle !== handle || serial !== analysisSerial)
      return;
    analysisCache.set(cacheKey, result);
    if (analysisCache.size > 20) analysisCache.delete(analysisCache.keys().next().value);
    state.analysisResult = {
      ...result,
      rating: result.rating - shift,
      mode,
      fetchedAt: snapshot.fetchedAt,
    };
  } catch (error) {
    if (error.name !== 'AbortError' && serial === analysisSerial)
      state.analysisError = error.message;
  } finally {
    if (serial === analysisSerial) state.computing = false;
  }
}

// 从快照时间计算下次刷新，不重复叠加缓存时长。
function schedule(delay) {
  clearTimeout(timer);
  if (!enabled() || document.hidden) return;
  timer = setTimeout(
    () => refreshPrediction(),
    delay ??
      Math.max(
        1500,
        (state.snapshot?.fetchedAt || 0) + snapshotLifetime(state.snapshot) - Date.now(),
      ),
  );
}

// 官方 Δ 不依赖重算；残缺人群不生成貌似精确的表现分。
async function calculate(snapshot, token) {
  if (!appSettings.contest.prediction.enabled) return {};
  let results = {};
  if (!snapshot.warnings.includes('predictionIncompleteData') && rowsFor(snapshot).length)
    results = await baseRunner.run({ type: 'predict', rows: rowsFor(snapshot) });
  if (token !== generation) return;
  // 首场新号的涨跌补上第一场的补分，和原站出分时显示的一样。
  results = withFirstBonus(results, snapshot.participants, contestId);
  if (snapshot.phase === 'final')
    for (const p of snapshot.participants)
      if (Number.isFinite(p.officialDelta))
        results[p.handle] = { ...results[p.handle], delta: p.officialDelta };
  return results;
}

// 页面打开后这么久之内，页面上的榜单表格算是新的。
const FRESH_PAGE = 8000;
// 页面上的榜单表格是什么时候的：起初是页面打开的时刻，之后每换一次表格，记成取那张表格的时刻。
let tableAt = performance.timeOrigin;
// 页面上的表格比快照早取不超过这么久，仍然算不比快照旧（接口的成绩本身最多旧一分钟）。
const TABLE_LEAD = 10000;

/*
 * 把快照里的成绩补到和页面一致（原因见 page-scores.js）。fresh 是这一次刚取来、准备换上去的表格；
 * 没有的话就看页面上现有的表格，但只在它不比快照旧时才用——同步榜单关着、页面开了很久的时候，
 * 页面上的成绩反而是旧的，不能拿来盖掉接口的。只管还没出分的比赛，出分后用的是官方结果。
 */
function withPageScores(snapshot, fresh) {
  if (!['live', 'pending'].includes(snapshot.phase)) return snapshot;
  const table =
    fresh ||
    (tableAt >= snapshot.fetchedAt - TABLE_LEAD ? document.querySelector('table.standings') : null);
  if (!table) return snapshot;
  return patchScores(
    snapshot,
    readScores(table, { handleOf: handleForCell, isOfficial: isOfficialStandingsRow }),
  );
}

// 合并正在进行的刷新，失败时保留旧数据及其真实时间。
export async function refreshPrediction(force = false) {
  if (!contestId || !enabled() || requestController || document.hidden) return;
  clearTimeout(timer);
  const controller = new AbortController();
  requestController = controller;
  const token = generation;
  state.loading = true;
  state.stage = '';
  state.progress = 0;
  state.error = '';
  render();
  let failed = false;
  // 这一次是不是真的向原站要了数据（直接用了缓存的不算）。
  let fetched = false;
  // 页面上的榜单表格在向接口要成绩的那一刻就去取，等预测算完再换上去（见 table-sync.js）。
  // 已经知道结果固定了的比赛不取。页面刚打开、还没有过快照时，页面上的表格本来就是新的，也不取。
  const known = state.snapshot?.phase;
  const pageIsFresh = !known && performance.now() < FRESH_PAGE;
  const syncing = () => appSettings.contest.prediction.syncStandings && !pageIsFresh;
  let table = null;
  let requestedAt = 0;
  const requestTable = () => {
    requestedAt = Date.now();
    table = fetchStandingsTable(controller.signal);
  };
  try {
    const loaded = await loadSnapshot(contestId, {
      signal: controller.signal,
      force,
      stage: (id) => {
        fetched = true;
        if (
          id === 'standings' &&
          !table &&
          syncing() &&
          (!known || ['live', 'pending'].includes(known))
        )
          requestTable();
        state.stage = id;
        render();
      },
      progress: (n) => {
        state.progress = n;
        render();
      },
    });
    if (token !== generation) return;
    const open = ['live', 'pending'].includes(loaded.phase);
    // 上面没取（比如上一份快照还是开赛前的）就现在取。
    if (!table && fetched && syncing() && open) requestTable();
    const fresh = open && table ? await table : null;
    if (token !== generation) return;
    const snapshot = withPageScores(loaded, fresh);
    const key = JSON.stringify([
      snapshot.phase,
      snapshot.warnings.includes('predictionIncompleteData'),
      snapshot.participants.map((p) => [
        p.handle,
        p.points,
        p.penalty,
        p.rating,
        p.status,
        p.valid,
        p.officialDelta,
      ]),
    ]);
    const changed = key !== modelKey;
    const reuse = !changed && Object.keys(state.results).length;
    // 数据是这次请求来的才显示「计算」这一段；直接用了缓存时不显示进度。
    if (!reuse && state.stage) {
      state.stage = 'compute';
      render();
    }
    const results = reuse ? state.results : await calculate(snapshot, token);
    if (token !== generation) return;
    if (changed) {
      modelKey = key;
      modelVersion++;
      analysisCache.clear();
      analysisBoundsCache.clear();
      analysisCurveCache.clear();
      cancelPredictionAnalysis();
      if (state.openHandle) state.analysisError = 'predictionSnapshotChanged';
    }
    // 上一份快照里各人的名次：榜单换完之后，新进这一页的行靠它判断是从上面还是下面来的。
    const previousRanks = new Map(
      (state.snapshot?.participants || [])
        .filter((p) => Number.isFinite(p.rank))
        .map((p) => [p.handle.toLowerCase(), p.rank]),
    );
    state.snapshot = snapshot;
    state.results = results || {};
    // 面板开着：新号修正后的当前结果跟着新榜单重算。算好之前先留着原来的，免得数字来回跳。
    if (state.openHandle && !loadMember(state.openHandle)) loadNewcomer(state.openHandle);
    render();
    // 比赛没出分时，页面上的榜单表格也跟着换成最新的，不然预测是按新成绩算的，表格里还是旧的人和旧的名次。
    // 换完马上把页面增强和预测的各列补到新的行上，再做过渡。
    if (open && table) {
      const applied = await applyStandingsTable(fresh, {
        previousRanks,
        nextRanks: new Map(
          snapshot.participants
            .filter((p) => Number.isFinite(p.rank))
            .map((p) => [p.handle.toLowerCase(), p.rank]),
        ),
        settle: () => {
          if (token !== generation) return;
          enhancePageNow();
          render();
        },
      });
      if (applied) tableAt = requestedAt;
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      failed = true;
      state.error = error.message?.startsWith('prediction')
        ? error.message
        : 'predictionNetworkError';
    }
  } finally {
    if (requestController === controller) requestController = null;
    if (token === generation) {
      state.loading = false;
      render();
      schedule(failed ? 60000 : undefined);
    }
  }
}

// 关闭功能停止请求和新增节点，保留设置与缓存。
function reconcile() {
  generation++;
  clearTimeout(timer);
  requestController?.abort();
  requestController = null;
  baseRunner.stop();
  cancelPredictionAnalysis(true);
  state.loading = false;
  if (!enabled()) {
    rendering?.();
    rendering = null;
    state.results = {};
    clearPrediction();
    return;
  }
  if (!rendering) rendering = observePredictionTable(render);
  render();
  refreshPrediction();
}

// 仅在公开比赛榜单启动网络和表格增强。
export function startPredictionFeature() {
  if (started) return;
  const segments = location.pathname.split('/');
  if (
    segments[1] !== 'contest' ||
    segments[3] !== 'standings' ||
    !Number.isInteger(Number(segments[2]))
  )
    return;
  started = true;
  contestId = Number(segments[2]);
  state.snapshot = enabled() ? readSnapshot(contestId) : null;
  let signature = '';
  let lifecycleSignature = '';
  let language = appSettings.general.lang;
  let styleSignature = '';
  const settingsChanged = () => {
    const languageChanged = language !== appSettings.general.lang;
    language = appSettings.general.lang;
    const nextStyle = JSON.stringify([
      appSettings.ratings.enabled,
      appSettings.ratings.style,
      appSettings.ratings.tagFillCell,
    ]);
    const styleChanged = nextStyle !== styleSignature;
    styleSignature = nextStyle;
    const next = JSON.stringify([
      appSettings.contest.prediction,
      appSettings.contest.participationTags,
    ]);
    const presentationChanged = next !== signature;
    signature = next;
    // 只有预测计算或整个功能的启停才重启任务，外观开关仅更新同一批节点。
    const nextLifecycle = JSON.stringify([appSettings.contest.prediction.enabled, enabled()]);
    if (nextLifecycle !== lifecycleSignature) {
      lifecycleSignature = nextLifecycle;
      reconcile();
    } else if ((presentationChanged || languageChanged || styleChanged) && enabled()) {
      if (!appSettings.contest.prediction.analysis && state.openHandle)
        cancelPredictionAnalysis(true);
      render();
    }
  };
  const unsubscribe = subscribeSettings(settingsChanged);
  const unsubscribeStorage = subscribeStorageChanges((group) => {
    if (group === 'prediction' || group === 'all') {
      generation++;
      requestController?.abort();
      requestController = null;
      clearTimeout(timer);
      baseRunner.stop();
      cancelPredictionAnalysis(true);
      modelKey = '';
      modelVersion++;
      analysisCache.clear();
      analysisBoundsCache.clear();
      analysisCurveCache.clear();
      state.loading = false;
      state.error = '';
      state.snapshot = null;
      state.results = {};
      if (enabled()) {
        render();
        schedule(30000);
      } else clearPrediction();
    }
  });
  const visibility = () => {
    if (document.hidden) {
      clearTimeout(timer);
      requestController?.abort();
    } else refreshPrediction();
  };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener(
    'pagehide',
    () => {
      generation++;
      clearTimeout(timer);
      requestController?.abort();
      baseRunner.stop();
      analysisRunner.stop();
      curveRunner.stop();
      rendering?.();
      unsubscribe();
      unsubscribeStorage();
      document.removeEventListener('visibilitychange', visibility);
    },
    { once: true },
  );
  settingsChanged();
}
