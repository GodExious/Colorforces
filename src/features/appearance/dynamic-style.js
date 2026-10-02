import { appSettings } from '../../settings.js';
import { syncSecondLevelMenuLava } from '../page/navigation.js';
let previousAcHighlight;
let previousAcColor;
// 仅开关切换使用缓动；连续取色立即生效，也会取消尚未结束的开关过渡。
function syncAcHighlightTransition() {
  const enabled = appSettings.show.acHighlight;
  const color = appSettings.acBgColor;
  if (enabled !== previousAcHighlight || color !== previousAcColor) {
    document.documentElement.classList.toggle(
      'cf-ac-highlight-transition',
      previousAcHighlight !== undefined &&
        enabled !== previousAcHighlight &&
        color === previousAcColor,
    );
    previousAcHighlight = enabled;
    previousAcColor = color;
  }
}
// 将用户颜色和大小写入 CSS 变量，样式规则只在 CSS 中维护。
export function updateDynamicStyle() {
  syncAcHighlightTransition();
  const style = document.documentElement.style;
  style.setProperty('--cf-ac-background', appSettings.acBgColor);
  style.setProperty('--cf-avatar-em', (parseFloat(appSettings.avatarSize) || 1.6) + 'em');
  style.setProperty('--cf-lang-px', (parseFloat(appSettings.langIconSize) || 1.6) * 14 + 'px');
  const isRatingsActive = appSettings.colorRatings !== false;
  const classMap = {
    'cf-ac-highlight-disabled': !appSettings.show.acHighlight,
    'cf-hide-submissions': !isRatingsActive || !appSettings.show.submissions,
    'cf-hide-status': !isRatingsActive || !appSettings.show.status,
    'cf-hide-hacks': !isRatingsActive || !appSettings.show.hacks,
    'cf-hide-problemset': !isRatingsActive || !appSettings.show.problemset,
    'cf-hide-contestProblems': !isRatingsActive || !appSettings.show.contestProblems,
    'cf-hide-standings': !isRatingsActive || !appSettings.show.standings,
    'cf-hide-userAvatar': !appSettings.show.userAvatar,
    'cf-hide-langIcon': !appSettings.show.langIcon,
    'cf-hide-timeFormat': !appSettings.timeFormat.enabled,
  };
  for (const [cls, add] of Object.entries(classMap)) {
    document.documentElement.classList.toggle(cls, add);
  }
  if (typeof syncSecondLevelMenuLava === 'function') {
    syncSecondLevelMenuLava();
  }
}
