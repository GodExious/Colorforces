import { reactive } from 'vue';
import { appStorage } from './storage/gm.js';
import { SETTINGS_KEY, LEGACY_SETTINGS_KEY } from './storage/keys.js';
import { DEFAULT_SETTINGS } from './config/defaults.js';
import { upgradeLegacySettings } from './storage/migrations/settings.js';
const listeners = new Set();
const clone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isBoolean = (value) => typeof value === 'boolean';
const isString = (value) => typeof value === 'string';
const isText = (value) => isString(value) && value !== '';
const oneOf =
  (...values) =>
  (value) =>
    values.includes(value);
// 保存完整设置，通知原生页面功能和菜单使用同一份状态。
export function saveSettings(settings = appSettings) {
  appStorage.setJSON(SETTINGS_KEY, settings);
  for (const listener of listeners) listener(settings);
}

// 取 source 下面的一组设置；不是对象（没有保存过，或数据坏了）就当作没有。
const part = (source, key) => (isObject(source) && isObject(source[key]) ? source[key] : undefined);
// 开关：target 里默认值是布尔值的那些项，source 里也是布尔值才接受。
function takeFlags(target, source) {
  if (!source) return;
  for (const [key, value] of Object.entries(target)) {
    if (isBoolean(value) && isBoolean(source[key])) target[key] = source[key];
  }
}
// 其余的项逐个指定检查方式，通过了才接受。
function take(target, source, key, accepts) {
  if (source && accepts(source[key])) target[key] = source[key];
}
// 带小数的倍数（头像、语言图标的大小）。
function takeScale(target, source, key, min = 0, max = Infinity) {
  const value = parseFloat(source?.[key]);
  if (Number.isFinite(value) && value > 0) target[key] = Math.min(max, Math.max(min, value));
}

// 旧配置默认关闭自定义尺寸；空值留待首次启用时取当前面板大小。
function readMenuSize(target, source) {
  if (!source) return;
  target.enabled = source.enabled === true;
  for (const axis of ['width', 'height']) {
    const value = Number(source[axis]);
    target[axis] = Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  }
}
// 百分比位置独立于尺寸保存；无有效旧值时首次启用沿用当前位置。
function readMenuPosition(target, source) {
  if (!source) return;
  target.enabled = source.enabled === true;
  target.reference = source.reference === 'panel' ? 'panel' : 'button';
  const panelSize = source.panelSize;
  const sizeKeys = ['width', 'height', 'viewportWidth', 'viewportHeight'];
  if (panelSize && sizeKeys.every((key) => Number.isFinite(panelSize[key]) && panelSize[key] > 0)) {
    target.panelSize = Object.fromEntries(sizeKeys.map((key) => [key, panelSize[key]]));
  }
  for (const axis of ['x', 'y']) {
    const raw = source[axis];
    const value = Number(raw);
    target[axis] =
      raw !== null && raw !== '' && Number.isFinite(value)
        ? Math.round(Math.min(100, Math.max(0, value)) * 1e6) / 1e6
        : null;
  }
}
function readShortcuts(target, source) {
  if (!source) return;
  for (const key of Object.keys(target)) take(target, source, key, isString);
  // 新快捷键只在未配置时补入；旧绑定占用默认键时保持未绑定，不抢占用户设置。
  for (const key of Object.keys(target)) {
    if (Object.hasOwn(source, key)) continue;
    const occupied = Object.entries(target).some(
      ([other, binding]) => other !== key && binding.toLowerCase() === target[key].toLowerCase(),
    );
    if (occupied) target[key] = '';
  }
}

// 把已保存的设置（当前结构）整理成一份完整的设置：从默认值出发，只接受已知的项，
// 类型或取值不对的保持默认。新增的设置项在旧数据里没有，自然落到默认值上。
function readSettings(stored) {
  const settings = clone(DEFAULT_SETTINGS);

  const general = part(stored, 'general');
  take(settings.general, general, 'lang', isText);
  takeFlags(settings.general, general);
  readMenuSize(settings.general.menuSize, part(general, 'menuSize'));
  readMenuPosition(settings.general.menuPosition, part(general, 'menuPosition'));

  const appearance = part(stored, 'appearance');
  takeFlags(settings.appearance, appearance);
  const acHighlight = part(appearance, 'acHighlight');
  takeFlags(settings.appearance.acHighlight, acHighlight);
  take(settings.appearance.acHighlight, acHighlight, 'color', isText);
  const langIcon = part(appearance, 'langIcon');
  takeFlags(settings.appearance.langIcon, langIcon);
  takeScale(settings.appearance.langIcon, langIcon, 'size', 0.8, 3.0);
  const timeFormat = part(appearance, 'timeFormat');
  takeFlags(settings.appearance.timeFormat, timeFormat);
  // 格式可以是空的：输入框被清空时按默认格式显示。
  take(settings.appearance.timeFormat, timeFormat, 'format', isString);
  takeFlags(settings.appearance.tags, part(appearance, 'tags'));

  const ratings = part(stored, 'ratings');
  takeFlags(settings.ratings, ratings);
  take(settings.ratings, ratings, 'style', oneOf('tag', 'block'));
  takeFlags(settings.ratings.show, part(ratings, 'show'));
  const clist = part(ratings, 'clist');
  takeFlags(settings.ratings.clist, clist);
  take(settings.ratings.clist, clist, 'authMode', oneOf('cookie', 'api'));
  take(settings.ratings.clist, clist, 'apiKey', isString);

  const contest = part(stored, 'contest');
  const prediction = part(contest, 'prediction');
  takeFlags(settings.contest.prediction, prediction);
  // 预测缓存的比赛场数至少为 1：正在看的这一场总要留着。
  take(
    settings.contest.prediction,
    prediction,
    'cacheContests',
    (value) => Number.isInteger(value) && value >= 1,
  );
  takeFlags(settings.contest.participationTags, part(contest, 'participationTags'));

  const user = part(stored, 'user');
  takeFlags(settings.user, user);
  const avatar = part(user, 'avatar');
  takeFlags(settings.user.avatar, avatar);
  takeScale(settings.user.avatar, avatar, 'size');
  // 数据分析：缓存用户数只接受非负整数，图表开关只接受已知项。
  const analytics = part(user, 'analytics');
  takeFlags(settings.user.analytics, analytics);
  for (const key of ['ratingsMode', 'tagsMode']) {
    take(settings.user.analytics, analytics, key, oneOf('count', 'share', 'coverage'));
  }
  take(
    settings.user.analytics,
    analytics,
    'hoursSpan',
    oneOf('all', 'year', 'quarter', 'month', 'week'),
  );
  take(settings.user.analytics, analytics, 'recentSpan', oneOf('week', 'month', 'quarter', 'year'));
  take(
    settings.user.analytics,
    analytics,
    'rankDivision',
    oneOf('all', 'div1', 'div2', 'div3', 'div4', 'other'),
  );
  take(
    settings.user.analytics,
    analytics,
    'cacheUsers',
    (value) => Number.isInteger(value) && value >= 0,
  );
  take(
    settings.user.analytics,
    analytics,
    'recentCount',
    (value) => Number.isInteger(value) && value >= 1,
  );
  takeFlags(settings.user.analytics.charts, part(analytics, 'charts'));

  readShortcuts(settings.shortcuts, part(stored, 'shortcuts'));
  return settings;
}

// 已保存的设置，统一成当前结构；什么都没保存过时返回 null。
// 当前结构存在新键里。新键还没有（刚从旧版本升级）时读旧键：旧键里是第一版结构，改写成当前结构。
// 旧键只读不写，原样留着，原因见 storage/keys.js。
function storedSettings() {
  const current = appStorage.getJSON(SETTINGS_KEY, null);
  if (isObject(current)) return current;
  const legacy = appStorage.getJSON(LEGACY_SETTINGS_KEY, null);
  if (!isObject(legacy)) return null;
  // 旧键里已经是当前结构（带 version）时直接采用。
  return legacy.version ? legacy : upgradeLegacySettings(legacy);
}

// 读取已保存的设置并整理，随后写回新键：老用户的设置就原样带过来了。
// persist 为假时只读取整理、不写回：别的标签页改了设置、本页跟着更新时用，免得两边来回写。
function getSettings(persist = true) {
  try {
    const stored = storedSettings();
    if (!stored) return clone(DEFAULT_SETTINGS);
    const settings = readSettings(stored);
    if (persist) saveSettings(settings);
    return settings;
  } catch (e) {
    console.error('Failed to parse settings', e);
    return clone(DEFAULT_SETTINGS);
  }
}
export const appSettings = reactive(getSettings());

// 把 source 的内容原地写进 target：嵌套对象保持原来的那一个，只改里面的值。
// 有的模块会一直拿着某个嵌套对象（比如菜单尺寸），整个换掉的话它们就对不上了。
function assignDeep(target, source) {
  const plain = (value) => value && typeof value === 'object' && !Array.isArray(value);
  for (const key of Object.keys(target)) if (!(key in source)) delete target[key];
  for (const [key, value] of Object.entries(source)) {
    if (plain(value) && plain(target[key])) assignDeep(target[key], value);
    else target[key] = value;
  }
}

// 每个标签页各自持有一份设置，保存时写回的是整份。别的标签页改了设置而本页不知道的话，
// 本页之后任何一次保存都会用旧的整份把那次修改盖掉。所以别的标签页一保存，本页就重新读取并原地更新，
// 再通知各功能刷新；这里只更新、不写回。
export function syncSettingsFromStorage() {
  const next = getSettings(false);
  if (JSON.stringify(next) === JSON.stringify(appSettings)) return false;
  assignDeep(appSettings, next);
  for (const listener of listeners) listener(appSettings);
  return true;
}
appStorage.onRemoteChange(SETTINGS_KEY, syncSettingsFromStorage);
// 兜底：个别脚本管理器没有「别的标签页改了值」的通知，页面从后台回到前台时重新读一次。
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncSettingsFromStorage();
  });
}
// 订阅设置变更，并返回用于卸载的取消函数。
export function subscribeSettings(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
// 修改指定设置字段，并同步旧版 Clist 认证兼容字段。
export function setSetting(path, value) {
  const parts = path.split('.');
  const key = parts.pop();
  const target = parts.reduce((object, part) => object[part], appSettings);
  target[key] = value;
  if (path === 'ratings.clist.authMode') appSettings.ratings.clist.isLoggedIn = value === 'cookie';
  saveSettings();
}
// 就地恢复默认值，保证所有模块持有的设置引用不变。
export function resetSettings() {
  appStorage.removeItem(SETTINGS_KEY);
  assignDeep(appSettings, clone(DEFAULT_SETTINGS));
  saveSettings();
}
