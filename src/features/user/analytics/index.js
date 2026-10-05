// 个人主页的数据分析：决定面板放在哪、何时加载。面板本身由 Vue 组件绘制。
import { nextTick } from 'vue';
import { appSettings, subscribeSettings } from '../../../settings.js';
import { analyticsState as state } from './state.js';
import { fetchDataset, readDataset, saveDataset, isFresh, pruneDatasets } from './data.js';

const HOST_ID = 'cf-analytics-host';

// 只认「/profile/账号」这一种地址。
function profileHandle() {
  const match = window.location.pathname.match(/^\/profile\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
}

// 面板放在原站活跃度模块的后面；找不到时放到主页内容区的末尾。
function mountHost() {
  const content = document.querySelector('#pageContent');
  if (!content) return null;
  const host = document.createElement('div');
  host.id = HOST_ID;
  const activity = content.querySelector('._UserActivityFrame_frame');
  if (activity) activity.after(host);
  else content.appendChild(host);
  return host;
}

// 从主页的个人信息框读出用户名、评级样式类和头像，面板标题旁照着显示。
// 样式类只留原站评级用的那几种（rated-user、user-xxx），不带入别处加上的类。
function readProfile() {
  const link = document.querySelector('.userbox .main-info h1 a, .userbox h1 a');
  const photo = document.querySelector('.userbox .title-photo img');
  return {
    profileName: link?.textContent.trim() || '',
    rankClass: [...(link?.classList || [])]
      .filter((name) => name === 'rated-user' || name.startsWith('user-'))
      .join(' '),
    avatar: photo?.src || '',
  };
}

// 时区的取值范围：UTC-12 到 UTC+14。
export const ZONE_MIN = -12;
export const ZONE_MAX = 14;

// 换上一份数据集，并取出随它保存的时区设置。
function adopt(dataset) {
  state.dataset = dataset;
  state.streakZone = Number.isInteger(dataset.streakZone) ? dataset.streakZone : null;
}

// 时区改动写回这个账号的缓存。连续点几下时只在停下后写一次：各个账号的缓存合存在一个键里，
// 写一次就是把整个键重写一遍，不必每点一下都写。
let zoneSaveTimer = 0;
function flushZoneSave() {
  if (!zoneSaveTimer) return;
  clearTimeout(zoneSaveTimer);
  zoneSaveTimer = 0;
  if (state.dataset) saveDataset(state.dataset);
}

// 设置计算「最长连续」用的时区。只对当前这个账号生效，存在它的缓存里；缓存被清掉后回到查看者自己的时区。
export function setStreakZone(zone) {
  if (!state.dataset || !Number.isInteger(zone)) return;
  const next = Math.min(ZONE_MAX, Math.max(ZONE_MIN, zone));
  if (next === state.streakZone) return;
  state.streakZone = next;
  state.dataset.streakZone = next;
  clearTimeout(zoneSaveTimer);
  zoneSaveTimer = setTimeout(flushZoneSave, 500);
}

// 加载分析数据。有缓存时先显示缓存；缓存过期或要求刷新时再请求，新数据到了替换旧图。
export async function loadAnalytics({ force = false } = {}) {
  if (!state.host || state.loading) return;
  state.started = true;
  state.error = '';
  state.errorComment = '';
  // 还没写回的时区改动先落盘，重新请求后才能沿用。
  flushZoneSave();
  const cached = readDataset(state.handle);
  if (cached) adopt(cached);
  if (!force && isFresh(cached)) return;
  Object.assign(state, { loading: true, stage: 'queue', received: 0, queueUntil: 0 });
  try {
    adopt(
      await fetchDataset(state.handle, (progress) => {
        state.stage = progress.stage;
        if (progress.stage === 'queue') state.queueUntil = progress.until;
        if (progress.stage === 'receive') state.received = progress.received;
      }),
    );
  } catch (error) {
    state.error = error?.code || 'network';
    state.errorComment = error?.comment || '';
  } finally {
    state.loading = false;
  }
}

// 跟随总开关显示或收起面板。挂载节点只在第一次开启时创建，之后一直留着：
// 关闭时面板要先播完收起的过渡，节点不能跟着立刻撤掉。
function sync() {
  const enabled = appSettings.user.analytics.enabled;
  if (!enabled) {
    state.active = false;
    return;
  }
  if (state.active) return;
  if (!state.host) {
    const host = mountHost();
    if (!host) return;
    state.handle = profileHandle();
    Object.assign(state, readProfile());
    state.host = host;
  }
  // 等面板先以收起状态挂上，下一拍再展开，展开的过渡才播得出来。
  nextTick(() => {
    if (!appSettings.user.analytics.enabled) return;
    state.active = true;
    if (appSettings.user.analytics.autoLoad && !state.started) loadAnalytics();
  });
}

// 只在个人主页启动。缓存用户数调小时立刻清掉多出来的旧缓存。
export function startAnalyticsFeature() {
  let cacheUsers = appSettings.user.analytics.cacheUsers;
  subscribeSettings(() => {
    if (appSettings.user.analytics.cacheUsers === cacheUsers) return;
    cacheUsers = appSettings.user.analytics.cacheUsers;
    if (appSettings.user.analytics.enabled) pruneDatasets(state.handle ? [state.handle] : []);
  });
  if (!profileHandle()) return;
  // 刚改完时区就离开页面时，赶在离开前写回。
  window.addEventListener('pagehide', flushZoneSave);
  sync();
  subscribeSettings(sync);
}
