import { appSettings, subscribeSettings } from '../settings.js';
import { startPredictionFeature } from './contest/rating-prediction/index.js';
import { startAnalyticsFeature } from './user/analytics/index.js';
import { startUserGroups } from './user/groups/index.js';
import { applyGroupTags, refreshGroupTags } from './user/groups/tags.js';
import { applyFrames, refreshFrames, watchCustomFrames } from './user/frames/page.js';
import { updateDynamicStyle } from './appearance/dynamic-style.js';
import {
  refreshVerdicts,
  VERDICT_SELECTOR,
  NATIVE_VERDICT_SELECTOR,
} from './appearance/verdicts/index.js';
import { applyTimeFormatting, wrapVirtualParticipationTime } from './appearance/time/format.js';
import { applyProblemTagsVisibility } from './appearance/problem-tags/visibility.js';
import { applyRecentActionsFormat } from './appearance/recent-actions.js';
import { getRatings } from './ratings/data.js';
import { applyRatings, refreshRatingsOnPage } from './ratings/enhance.js';
import { applyUserAvatars } from './user/avatars/enhance.js';
import { formatStandingsCells, refreshUserAvatarsAndStandings } from './user/avatars/teams.js';
import { syncSecondLevelMenuLava, observeSecondLevelMenu } from './page/navigation.js';
import { setupObserver, updateWithoutObservation } from './page/observer.js';
import { startShortcuts } from './shortcuts/index.js';
import { transitionRatingVisibility } from './ratings/cells/visibility-motion.js';
// 按功能依赖分发设置变化，不再因保存任意配置而重建整页增强。
export function connectSettingsEffects() {
  let queued = false;
  const ratingNodes = '.cf-rating-col, .cf-rating-standings-row > :is(td, th), span.tag-box';
  const effects = [
    {
      read: () => appSettings.appearance.tags,
      selector: 'span.tag-box, table.problems a.notice, .cf-tags-hidden-notice',
      apply: applyProblemTagsVisibility,
    },
    {
      read: () => [
        appSettings.appearance.formatRecentActions,
        appSettings.appearance.indentRecentActionTitles,
      ],
      selector: '.recent-actions',
      apply: () => applyRecentActionsFormat({ animate: true }),
    },
    {
      // 还没包起来的判题文字（Running 等）也要处理，所以连原站的类名一起找。
      read: () => [appSettings.appearance.shortVerdict, appSettings.appearance.hideVerdictTests],
      selector: `.cf-verdict-text, ${VERDICT_SELECTOR}, ${NATIVE_VERDICT_SELECTOR}`,
      apply: refreshVerdicts,
    },
    {
      read: () => appSettings.appearance.timeFormat,
      selector: '.cf-formatted-time, .format-time, .format-date, .cf-table-time-cell',
      apply: applyTimeFormatting,
      style: true,
    },
    {
      read: () => [
        appSettings.ratings.enabled,
        ...['submissions', 'status', 'hacks', 'problemset', 'contestProblems', 'standings'].map(
          (key) => appSettings.ratings.show[key],
        ),
      ],
      selector: ratingNodes,
      style: true,
      ratingVisibility: true,
    },
    {
      read: () => [
        appSettings.ratings.enabled,
        appSettings.ratings.style,
        appSettings.ratings.tagFillCell,
        appSettings.ratings.clist.enabled,
        appSettings.ratings.show.problemTags,
      ],
      selector: ratingNodes,
      apply: refreshRatingsOnPage,
    },
    {
      // 显示位置变了也一样：刚打开的那一处补上头像，刚关掉的那一处由样式收起，头像框跟着重看。
      read: () => [
        appSettings.user.avatar.enabled,
        { ...appSettings.user.avatar.showAt },
        appSettings.user.formatTeams,
      ],
      selector: '.status-party-cell, table.standings .contestant-cell, a[href*="/profile/"]',
      // 队伍的格子会按原站的内容重排一遍，里面的链接是重排前的样子，分组标签、头像框跟着补一遍。
      apply: () => {
        refreshUserAvatarsAndStandings();
        applyGroupTags();
        // 头像关着的这段时间里段位头像框的设置可能改过，全部重新看一遍。
        refreshFrames();
      },
      style: true,
    },
    {
      // 「好友」这个标签的文字跟着语言走。
      read: () => [
        appSettings.groups.enabled,
        appSettings.groups.showTags,
        appSettings.groups.tagStyle,
        appSettings.general.lang,
      ],
      selector: 'a[href*="/profile/"]',
      apply: refreshGroupTags,
      style: true,
    },
    {
      // 头像框：段位头像框的设置、显示位置、自己戴的头像框、分组开关（分组的头像框）变了，页面上的头像全部重新看一遍。
      // 动效的三档只换根元素上的类（style），不用重新标。
      read: () => [
        appSettings.user.avatar.frames,
        { ...appSettings.user.avatar.frameAt },
        appSettings.user.avatar.rankFrame,
        appSettings.user.avatar.wornFrame,
        appSettings.groups.enabled,
        appSettings.user.avatar.frameMotion,
      ],
      selector: '.cf-avatar-slot, .title-photo',
      apply: refreshFrames,
      style: true,
    },
    {
      read: () => appSettings.appearance.langIcon.enabled,
      selector: '[data-cf-lang-icon-processed]',
      style: true,
    },
    {
      read: () => [
        appSettings.general.fontSize,
        appSettings.user.avatar.size,
        appSettings.appearance.langIcon.size,
        appSettings.appearance.acHighlight.color,
        appSettings.appearance.acHighlight.rejectedColor,
        appSettings.appearance.acHighlight.enabled,
      ],
      selector: '',
      style: true,
    },
  ].map((effect) => ({ ...effect, previous: JSON.stringify(effect.read()) }));
  return subscribeSettings(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      const changed = effects.filter((effect) => {
        const next = JSON.stringify(effect.read());
        const differs = next !== effect.previous;
        effect.previous = next;
        return differs;
      });
      if (!changed.length) return;
      const relevant = changed.filter(
        (effect) => effect.selector && document.querySelector(effect.selector),
      );
      updateWithoutObservation(() => {
        const update = () => {
          if (changed.some((effect) => effect.style)) updateDynamicStyle();
          for (const effect of relevant) effect.apply?.();
        };
        if (changed.some((effect) => effect.ratingVisibility)) transitionRatingVisibility(update);
        else update();
      });
    });
  });
}
// 保持原版启动顺序，并仅启动一个全页观察器。
export async function startFeatures() {
  startPredictionFeature();
  connectSettingsEffects();
  startShortcuts();
  updateDynamicStyle();
  refreshVerdicts();
  applyProblemTagsVisibility();
  applyRecentActionsFormat();
  // 先记录原站队伍结构，避免将稍后插入的头像链接当作第二位成员。
  formatStandingsCells();
  applyUserAvatars();
  applyFrames();
  syncSecondLevelMenuLava();
  observeSecondLevelMenu();
  const ratings = await getRatings();
  // 数据分析要查本地题库，所以排在题库就绪之后。
  startAnalyticsFeature();
  applyRatings(ratings);
  formatStandingsCells();
  applyProblemTagsVisibility();
  wrapVirtualParticipationTime();
  setTimeout(applyTimeFormatting, 500);
  setupObserver(ratings);
  startUserGroups();
  watchCustomFrames();
}
