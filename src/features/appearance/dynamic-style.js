import { appSettings } from '../../settings.js';
import { FONT_SIZE } from '../../config/defaults.js';
import { syncSecondLevelMenuLava } from '../page/navigation.js';
let previousAcHighlight;
let previousAcColor;
// 仅开关切换使用缓动；连续取色立即生效，也会取消尚未结束的开关过渡。
function syncAcHighlightTransition() {
  const { enabled, rejectedColor } = appSettings.appearance.acHighlight;
  // 两种底色放在一起比：哪一种变了都算在取色。
  const color = appSettings.appearance.acHighlight.color + '|' + rejectedColor;
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
let previousFontSize;
let fontScaleTimer;
// 插件字体大小：把倍数写进 --cf-font-scale，各档字号都乘上它（见 styles/tokens.css）。
// 只有用户改了字号的那一下才过渡（类名挂一小会儿）；页面刚载入时直接到位，免得整页跟着算一段动画。
function syncFontScale() {
  const size = appSettings.general.fontSize;
  if (size === previousFontSize) return;
  const root = document.documentElement;
  if (previousFontSize !== undefined) {
    root.classList.add('cf-font-scale-transition');
    clearTimeout(fontScaleTimer);
    fontScaleTimer = setTimeout(() => root.classList.remove('cf-font-scale-transition'), 260);
  }
  previousFontSize = size;
  root.style.setProperty('--cf-font-scale', String(size / FONT_SIZE.base));
}
// 将用户颜色和大小写入 CSS 变量，样式规则只在 CSS 中维护。
export function updateDynamicStyle() {
  syncAcHighlightTransition();
  syncFontScale();
  const { appearance, ratings, user, groups } = appSettings;
  const style = document.documentElement.style;
  style.setProperty('--cf-ac-background', appearance.acHighlight.color);
  style.setProperty('--cf-rejected-background', appearance.acHighlight.rejectedColor);
  style.setProperty('--cf-avatar-em', (parseFloat(user.avatar.size) || 1.6) + 'em');
  // 菜单里的头像（分组的成员名单）：菜单的字比原站表格里的小，按原站表格的 13px 字号算，和页面上的一样大；
  // 用的地方再乘上菜单的字号倍数，和名字一起变。
  style.setProperty('--cf-avatar-px', (parseFloat(user.avatar.size) || 1.6) * 13 + 'px');
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
    // 头像开着、但某一处不显示（见 features/user/avatars/places.js）：表格里的、其他页面上的。
    'cf-hide-avatar-tables': user.avatar.enabled && user.avatar.showAt.tables === false,
    'cf-hide-avatar-others': user.avatar.enabled && user.avatar.showAt.others === false,
    // 头像框（见 features/user/frames/）：有没有可能戴，和动效的三档。
    'cf-frames-on': user.avatar.enabled && user.avatar.frames,
    'cf-frame-motion-off': user.avatar.frameMotion === 'off',
    'cf-frame-motion-hover': user.avatar.frameMotion === 'hover',
    'cf-frame-motion-on': user.avatar.frameMotion !== 'off' && user.avatar.frameMotion !== 'hover',
    'cf-hide-groupTags': !groups.enabled || !groups.showTags,
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
