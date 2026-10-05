import { appSettings, subscribeSettings } from '../settings.js';
import { startPredictionFeature } from './contest/rating-prediction/index.js';
import { startAnalyticsFeature } from './user/analytics/index.js';
import { updateDynamicStyle } from './appearance/dynamic-style.js';
import { refreshVerdicts } from './appearance/verdicts.js';
import { applyTimeFormatting, wrapVirtualParticipationTime } from './appearance/time/format.js';
import { applyProblemTagsVisibility } from './appearance/problem-tags/visibility.js';
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
      read: () => appSettings.appearance.shortVerdict,
      selector: '.cf-verdict-text',
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
      read: () => [appSettings.user.avatar.enabled, appSettings.user.formatTeams],
      selector: '.status-party-cell, table.standings .contestant-cell, a[href*="/profile/"]',
      apply: refreshUserAvatarsAndStandings,
      style: true,
    },
    {
      read: () => appSettings.appearance.langIcon.enabled,
      selector: '[data-cf-lang-icon-processed]',
      style: true,
    },
    {
      read: () => [
        appSettings.user.avatar.size,
        appSettings.appearance.langIcon.size,
        appSettings.appearance.acHighlight.color,
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
  // 先记录原站队伍结构，避免将稍后插入的头像链接当作第二位成员。
  formatStandingsCells();
  applyUserAvatars();
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
}
