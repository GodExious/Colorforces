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
      appSettings.hideTags = !appSettings.hideTags;
    },
    menuLanguage: () => cycleMenuLanguage?.(),
    acHighlight: () => {
      appSettings.show.acHighlight = !appSettings.show.acHighlight;
    },
    shortVerdict: () => {
      appSettings.show.shortVerdict = !appSettings.show.shortVerdict;
    },
    timeFormat: () => {
      appSettings.timeFormat.enabled = !appSettings.timeFormat.enabled;
    },
    langIcon: () => {
      appSettings.show.langIcon = !appSettings.show.langIcon;
    },
    clistEnabled: () => {
      appSettings.clist.enabled = !appSettings.clist.enabled;
    },
    colorRatings: () => {
      appSettings.colorRatings = !appSettings.colorRatings;
    },
    displayStyle: () => {
      appSettings.displayStyle = appSettings.displayStyle === 'tag' ? 'block' : 'tag';
    },
    predictionEnabled: () => {
      appSettings.prediction.enabled = !appSettings.prediction.enabled;
    },
    userAvatar: () => {
      appSettings.show.userAvatar = !appSettings.show.userAvatar;
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
