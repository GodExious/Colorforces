import { appSettings } from '../../settings.js';
import { syncSecondLevelMenuLava } from '../page/navigation.js';
let previousAcHighlight;
let previousAcColor;
// 仅开关切换使用缓动；连续取色立即生效，也会取消尚未结束的开关过渡。
function syncAcHighlightTransition() {
  const enabled = appSettings.appearance.acHighlight.enabled;
  const color = appSettings.appearance.acHighlight.color;
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
  const { appearance, ratings, user } = appSettings;
  const style = document.documentElement.style;
  style.setProperty('--cf-ac-background', appearance.acHighlight.color);
  style.setProperty('--cf-avatar-em', (parseFloat(user.avatar.size) || 1.6) + 'em');
  style.setProperty('--cf-lang-px', (parseFloat(appearance.langIcon.size) || 1.6) * 14 + 'px');
  const isRatingsActive = ratings.enabled !== false;
  const classMap = {
    'cf-ac-highlight-disabled': !appearance.acHighlight.enabled,
    'cf-hide-submissions': !isRatingsActive || !ratings.show.submissions,
    'cf-hide-status': !isRatingsActive || !ratings.show.status,
    'cf-hide-hacks': !isRatingsActive || !ratings.show.hacks,
    'cf-hide-problemset': !isRatingsActive || !ratings.show.problemset,
    'cf-hide-contestProblems': !isRatingsActive || !ratings.show.contestProblems,
    'cf-hide-standings': !isRatingsActive || !ratings.show.standings,
    'cf-hide-userAvatar': !user.avatar.enabled,
    'cf-hide-langIcon': !appearance.langIcon.enabled,
    'cf-hide-timeFormat': !appearance.timeFormat.enabled,
  };
  for (const [cls, add] of Object.entries(classMap)) {
    document.documentElement.classList.toggle(cls, add);
  }
  if (typeof syncSecondLevelMenuLava === 'function') {
    syncSecondLevelMenuLava();
  }
}
