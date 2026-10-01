import RatingWorker from './worker.js?worker&inline';
import { appSettings, subscribeSettings } from '../../../settings.js';
import { predictionState as state } from './state.js';
import { loadSnapshot, readSnapshot, snapshotLifetime } from './data.js';
import { renderPrediction, clearPrediction, observePredictionTable } from './standings.js';
import { subscribeStorageChanges } from '../../storage/cleanup.js';

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
const baseRunner = workerRunner(),
  analysisRunner = workerRunner(),
  boundsRunner = workerRunner();
let modelKey = '',
  modelVersion = 0,
  analysisSerial = 0;
const analysisCache = new Map();
const analysisBoundsCache = new Map();
const enabled = () => appSettings.prediction.enabled || appSettings.participationTags.enabled;
const rowsFor = (snapshot) =>
  snapshot?.participants.filter((p) => p.status === 'rated' && p.valid) || [];

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
  if (close) state.openHandle = null;
}

// 单实例面板按需分析，避免每行挂载复杂组件。
export function openPredictionAnalysis(handle) {
  if (!appSettings.prediction.enabled || !appSettings.prediction.analysis) return;
  cancelPredictionAnalysis();
  state.openHandle = handle;
}

// 单用户弹窗的输入范围由同一份快照计算，避免主线程同步排序大榜单。
export async function getPredictionAnalysisBounds(handle) {
  const snapshot = state.snapshot;
  if (!snapshot || !handle) return null;
  const key = JSON.stringify([modelVersion, snapshot.fetchedAt, handle]);
  if (analysisBoundsCache.has(key)) return analysisBoundsCache.get(key);
  if (snapshot.warnings.includes('predictionIncompleteData'))
    throw new Error('predictionIncompleteData');
  const bounds = await boundsRunner.run({
    type: 'bounds',
    rows: rowsFor(snapshot),
    handle,
  });
  analysisBoundsCache.set(key, bounds);
  return bounds;
}

// 结果回传时核对快照和用户，过期计算不能覆盖新输入。
export async function runPredictionAnalysis(mode, value) {
  const snapshot = state.snapshot,
    handle = state.openHandle;
  if (!snapshot || !handle || !appSettings.prediction.enabled || !appSettings.prediction.analysis)
    return;
  cancelPredictionAnalysis();
  state.computing = true;
  const serial = analysisSerial,
    version = modelVersion;
  const cacheKey = JSON.stringify([handle, mode, value]);
  try {
    if (snapshot.warnings.includes('predictionIncompleteData'))
      throw new Error('predictionIncompleteData');
    const result =
      analysisCache.get(cacheKey) ||
      (await analysisRunner.run({
        type: mode === 'refine' ? 'refine' : 'analyze',
        rows: rowsFor(snapshot),
        handle,
        mode,
        value,
      }));
    if (version !== modelVersion || state.openHandle !== handle || serial !== analysisSerial)
      return;
    analysisCache.set(cacheKey, result);
    if (analysisCache.size > 20) analysisCache.delete(analysisCache.keys().next().value);
    state.analysisResult = { ...result, mode, fetchedAt: snapshot.fetchedAt };
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
  if (!appSettings.prediction.enabled) return {};
  let results = {};
  if (!snapshot.warnings.includes('predictionIncompleteData') && rowsFor(snapshot).length)
    results = await baseRunner.run({ type: 'predict', rows: rowsFor(snapshot) });
  if (token !== generation) return;
  if (snapshot.phase === 'final')
    for (const p of snapshot.participants)
      if (Number.isFinite(p.officialDelta))
        results[p.handle] = { ...results[p.handle], delta: p.officialDelta };
  return results;
}

// 合并正在进行的刷新，失败时保留旧数据及其真实时间。
export async function refreshPrediction(force = false) {
  if (!contestId || !enabled() || requestController || document.hidden) return;
  clearTimeout(timer);
  const controller = new AbortController();
  requestController = controller;
  const token = generation;
  state.loading = true;
  state.progress = 0;
  state.error = '';
  render();
  let failed = false;
  try {
    const snapshot = await loadSnapshot(contestId, {
      signal: controller.signal,
      force,
      progress: (n) => {
        state.progress = n;
        render();
      },
    });
    if (token !== generation) return;
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
    const results =
      !changed && Object.keys(state.results).length
        ? state.results
        : await calculate(snapshot, token);
    if (token !== generation) return;
    if (changed) {
      modelKey = key;
      modelVersion++;
      analysisCache.clear();
      analysisBoundsCache.clear();
      cancelPredictionAnalysis();
      if (state.openHandle) state.analysisError = 'predictionSnapshotChanged';
    }
    state.snapshot = snapshot;
    state.results = results || {};
    render();
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
  let language = appSettings.lang;
  let styleSignature = '';
  const settingsChanged = () => {
    const languageChanged = language !== appSettings.lang;
    language = appSettings.lang;
    const nextStyle = JSON.stringify([
      appSettings.colorRatings,
      appSettings.displayStyle,
      appSettings.tagFillCell,
    ]);
    const styleChanged = nextStyle !== styleSignature;
    styleSignature = nextStyle;
    const next = JSON.stringify([appSettings.prediction, appSettings.participationTags]);
    const presentationChanged = next !== signature;
    signature = next;
    // 只有预测计算或整个功能的启停才重启任务，外观开关仅更新同一批节点。
    const nextLifecycle = JSON.stringify([appSettings.prediction.enabled, enabled()]);
    if (nextLifecycle !== lifecycleSignature) {
      lifecycleSignature = nextLifecycle;
      reconcile();
    } else if ((presentationChanged || languageChanged || styleChanged) && enabled()) {
      if (!appSettings.prediction.analysis && state.openHandle) cancelPredictionAnalysis(true);
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
      rendering?.();
      unsubscribe();
      unsubscribeStorage();
      document.removeEventListener('visibilitychange', visibility);
    },
    { once: true },
  );
  settingsChanged();
}
