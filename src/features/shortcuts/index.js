import { appSettings, saveSettings } from '../../settings.js';
import { matchesShortcut, startModifierTracking } from '../../utils/shortcuts.js';
// 由界面提供的几个动作：带动画的换语言、打开和关上头像框库、分组管理。快捷键不重复维护界面状态，也不改设置。
const uiActions = new Map();
const UI_KEYS = ['menuLanguage', 'frameLibrary', 'groupsManage'];
function configureUiAction(key, handler) {
  uiActions.set(key, handler);
  return () => {
    if (uiActions.get(key) === handler) uiActions.delete(key);
  };
}
export const configureLanguageShortcut = (handler) => configureUiAction('menuLanguage', handler);
export const configureFrameLibraryShortcut = (handler) =>
  configureUiAction('frameLibrary', handler);
export const configureGroupsManageShortcut = (handler) =>
  configureUiAction('groupsManage', handler);
// 快捷键只修改设置；原生增强与 Vue 菜单分别订阅同一状态。
export function startShortcuts() {
  startModifierTracking();
  const actions = {
    menuLanguage: () => uiActions.get('menuLanguage')?.(),
    frameLibrary: () => uiActions.get('frameLibrary')?.(),
    hideTags: () => {
      const tags = appSettings.appearance.tags;
      tags.hide = !tags.hide;
    },
    hideVerdictTests: () => {
      appSettings.appearance.hideVerdictTests = !appSettings.appearance.hideVerdictTests;
    },
    acHighlight: () => {
      const highlight = appSettings.appearance.acHighlight;
      highlight.enabled = !highlight.enabled;
    },
    langIcon: () => {
      const langIcon = appSettings.appearance.langIcon;
      langIcon.enabled = !langIcon.enabled;
    },
    shortVerdict: () => {
      appSettings.appearance.shortVerdict = !appSettings.appearance.shortVerdict;
    },
    timeFormat: () => {
      const timeFormat = appSettings.appearance.timeFormat;
      timeFormat.enabled = !timeFormat.enabled;
    },
    clistEnabled: () => {
      const clist = appSettings.ratings.clist;
      clist.enabled = !clist.enabled;
    },
    colorRatings: () => {
      appSettings.ratings.enabled = !appSettings.ratings.enabled;
    },
    displayStyle: () => {
      appSettings.ratings.style = appSettings.ratings.style === 'tag' ? 'block' : 'tag';
    },
    predictionEnabled: () => {
      const prediction = appSettings.contest.prediction;
      prediction.enabled = !prediction.enabled;
    },
    userAvatar: () => {
      const avatar = appSettings.user.avatar;
      avatar.enabled = !avatar.enabled;
    },
    avatarFrames: () => {
      const avatar = appSettings.user.avatar;
      avatar.frames = !avatar.frames;
    },
    userAnalytics: () => {
      const analytics = appSettings.user.analytics;
      analytics.enabled = !analytics.enabled;
    },
    groupsEnabled: () => {
      appSettings.groups.enabled = !appSettings.groups.enabled;
    },
    groupTags: () => {
      appSettings.groups.showTags = !appSettings.groups.showTags;
    },
    groupsManage: () => uiActions.get('groupsManage')?.(),
  };
  const keydown = (event) => {
    const active = document.activeElement;
    if (
      event.defaultPrevented ||
      (active && (['INPUT', 'TEXTAREA'].includes(active.tagName) || active.isContentEditable))
    )
      return;
    for (const [key, action] of Object.entries(actions)) {
      if (!matchesShortcut(event, appSettings.shortcuts[key])) continue;
      event.preventDefault();
      // 界面的动作不改设置（换语言在动画换完文案时自行保存）；长按不反复触发。
      if (UI_KEYS.includes(key)) {
        if (!event.repeat) action();
        return;
      }
      action();
      saveSettings();
      return;
    }
  };
  document.addEventListener('keydown', keydown);
  return () => document.removeEventListener('keydown', keydown);
}
