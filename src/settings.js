import { reactive } from 'vue';
import { appStorage } from './storage/gm.js';
import { SETTINGS_KEY, CLIST_LAST_SYNC_KEY } from './storage/keys.js';
import { DEFAULT_SETTINGS } from './config/defaults.js';
import { hexToRgba } from './utils/color.js';
const listeners = new Set();
// 保存完整设置，通知原生页面功能和菜单使用同一份状态。
export function saveSettings(settings = appSettings) {
  appStorage.setJSON(SETTINGS_KEY, settings);
  for (const listener of listeners) listener(settings);
}
// 读取并迁移原版设置，保持原键名、格式与兼容处理。
function getSettings() {
  const parsed = appStorage.getJSON(SETTINGS_KEY, null);
  let settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); // deep clone
  if (parsed) {
    try {
      // Migrate from split hex+alpha to unified format
      if (parsed.acBgAlpha !== undefined && parsed.acBgColor && parsed.acBgColor.startsWith('#')) {
        if (parsed.acBgAlpha < 1) {
          parsed.acBgColor = hexToRgba(parsed.acBgColor, parsed.acBgAlpha);
        }
        delete parsed.acBgAlpha;
      }

      settings.acBgColor = parsed.acBgColor || settings.acBgColor;
      if (parsed.show) Object.assign(settings.show, parsed.show);
      settings.avatarSize =
        parsed.avatarSize !== undefined ? parsed.avatarSize : settings.avatarSize;
      settings.langIconSize =
        parsed.langIconSize !== undefined ? parseFloat(parsed.langIconSize) : settings.langIconSize;
      if (settings.langIconSize >= 5) {
        settings.langIconSize = parseFloat((settings.langIconSize / 14).toFixed(1));
      }
      if (settings.langIconSize < 0.8) settings.langIconSize = 0.8;
      if (settings.langIconSize > 3.0) settings.langIconSize = 3.0;
      if (parsed.timeFormat) Object.assign(settings.timeFormat, parsed.timeFormat);
      settings.hideTags = parsed.hideTags !== undefined ? !!parsed.hideTags : settings.hideTags;
      settings.hideRatingTag =
        parsed.hideRatingTag !== undefined ? !!parsed.hideRatingTag : settings.hideRatingTag;
      settings.notHideAcTags =
        parsed.notHideAcTags !== undefined ? !!parsed.notHideAcTags : settings.notHideAcTags;
      settings.colorRatings =
        parsed.colorRatings !== undefined ? !!parsed.colorRatings : settings.colorRatings;
      settings.tagFillCell =
        parsed.tagFillCell !== undefined ? !!parsed.tagFillCell : settings.tagFillCell;
      settings.disableAutoCheckUpdate =
        parsed.disableAutoCheckUpdate !== undefined
          ? !!parsed.disableAutoCheckUpdate
          : settings.disableAutoCheckUpdate;
      settings.lang = parsed.lang || settings.lang;
      settings.displayStyle = parsed.displayStyle || settings.displayStyle;
      if (parsed.clist) {
        if (!settings.clist) settings.clist = { ...DEFAULT_SETTINGS.clist };
        Object.assign(settings.clist, parsed.clist);
        // 兼容旧版配置内的同步时间，迁移到已有的独立数据键（旧字段 deprecated）。
        const legacySyncTime = Number(parsed.clist.lastSyncTime);
        const storedSyncTime = Number(appStorage.getItem(CLIST_LAST_SYNC_KEY)) || 0;
        if (Number.isFinite(legacySyncTime) && legacySyncTime > storedSyncTime) {
          appStorage.setItem(CLIST_LAST_SYNC_KEY, String(legacySyncTime));
        }
        delete settings.clist.lastSyncTime;
      }
      if (parsed.shortcuts) {
        if (!settings.shortcuts) settings.shortcuts = { ...DEFAULT_SETTINGS.shortcuts };
        Object.assign(settings.shortcuts, parsed.shortcuts);
        if (settings.shortcuts.timeFormat === undefined) {
          settings.shortcuts.timeFormat = DEFAULT_SETTINGS.shortcuts.timeFormat;
        }
        if (settings.shortcuts.displayStyle === undefined) {
          settings.shortcuts.displayStyle = DEFAULT_SETTINGS.shortcuts.displayStyle;
        }
        // Migrate legacy Alt+ defaults to new Shift+ defaults
        const legacyAltDefaults = {
          hideTags: 'Alt+H',
          shortVerdict: 'Alt+S',
          timeFormat: 'Alt+T',
          langIcon: 'Alt+L',
          clistEnabled: 'Alt+C',
          colorRatings: 'Alt+R',
          displayStyle: 'Alt+F',
          userAvatar: 'Alt+A',
        };
        for (const [k, oldVal] of Object.entries(legacyAltDefaults)) {
          if (settings.shortcuts[k] === oldVal) {
            settings.shortcuts[k] = DEFAULT_SETTINGS.shortcuts[k];
          }
        }
        // 新快捷键只在未配置时补入；旧绑定占用默认键时保持未绑定，不抢占用户设置。
        for (const key of ['acHighlight', 'menuLanguage']) {
          if (Object.hasOwn(parsed.shortcuts, key)) continue;
          const occupied = Object.entries(settings.shortcuts).some(
            ([other, binding]) =>
              other !== key &&
              typeof binding === 'string' &&
              binding.toLowerCase() === DEFAULT_SETTINGS.shortcuts[key].toLowerCase(),
          );
          if (occupied) settings.shortcuts[key] = '';
        }
      }

      saveSettings(settings);
    } catch (e) {
      console.error('Failed to parse settings', e);
    }
  }
  return settings;
}
export const appSettings = reactive(getSettings());
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
  if (path === 'clist.authMode') appSettings.clist.isLoggedIn = value === 'cookie';
  saveSettings();
}
// 就地恢复默认值，保证所有模块持有的设置引用不变。
export function resetSettings() {
  appStorage.removeItem(SETTINGS_KEY);
  for (const key of Object.keys(appSettings)) delete appSettings[key];
  Object.assign(appSettings, JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
  saveSettings();
}
