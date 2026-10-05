import { appSettings, saveSettings } from '../../settings.js';
import { matchesShortcut, startModifierTracking } from '../../utils/shortcuts.js';
let cycleMenuLanguage;
// 由菜单提供带动画的语言切换入口，快捷键不重复维护界面状态。
export function configureLanguageShortcut(handler) {
  cycleMenuLanguage = handler;
  return () => {
    if (cycleMenuLanguage === handler) cycleMenuLanguage = null;
  };
}
// 快捷键只修改设置；原生增强与 Vue 菜单分别订阅同一状态。
export function startShortcuts() {
  startModifierTracking();
  const actions = {
    hideTags: () => {
      const tags = appSettings.appearance.tags;
      tags.hide = !tags.hide;
    },
    menuLanguage: () => cycleMenuLanguage?.(),
    acHighlight: () => {
      const highlight = appSettings.appearance.acHighlight;
      highlight.enabled = !highlight.enabled;
    },
    shortVerdict: () => {
      appSettings.appearance.shortVerdict = !appSettings.appearance.shortVerdict;
    },
    timeFormat: () => {
      const timeFormat = appSettings.appearance.timeFormat;
      timeFormat.enabled = !timeFormat.enabled;
    },
    langIcon: () => {
      const langIcon = appSettings.appearance.langIcon;
      langIcon.enabled = !langIcon.enabled;
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
      // 语言动画完成文案切换时自行保存；长按不反复启动切换。
      if (key === 'menuLanguage') {
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
