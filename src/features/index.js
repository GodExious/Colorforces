import { appSettings, subscribeSettings } from '../settings.js';
import { updateDynamicStyle } from './appearance/ac-highlight.js';
import { refreshVerdicts } from './appearance/verdicts.js';
import { applyTimeFormatting, wrapVirtualParticipationTime } from './appearance/time.js';
import { applyProblemTagsVisibility } from './appearance/problem-tags.js';
import { getRatings } from './ratings/data.js';
import { applyRatings, refreshRatingsOnPage } from './ratings/enhance.js';
import { applyUserAvatars } from './user/avatars/enhance.js';
import { formatStandingsCells, refreshUserAvatarsAndStandings } from './user/avatars/standings.js';
import { syncSecondLevelMenuLava, observeSecondLevelMenu } from './page/navigation.js';
import { setupObserver, updateWithoutObservation } from './page/observer.js';
import { startShortcuts } from './shortcuts/index.js';
import { transitionRatingVisibility } from './ratings/visibility-motion.js';
// 按功能依赖分发设置变化，不再因保存任意配置而重建整页增强。
export function connectSettingsEffects() {
  let queued = false;
  const ratingNodes = '.cf-rating-col, .cf-rating-standings-row > :is(td, th), span.tag-box';
  const effects = [
    {
      read: () => [appSettings.hideTags, appSettings.hideRatingTag, appSettings.notHideAcTags],
      selector: 'span.tag-box, table.problems a.notice, .cf-tags-hidden-notice',
      apply: applyProblemTagsVisibility,
    },
    {
      read: () => appSettings.show.shortVerdict,
      selector: '.cf-verdict-text',
      apply: refreshVerdicts,
    },
    {
      read: () => appSettings.timeFormat,
      selector: '.cf-formatted-time, .format-time, .format-date, .cf-table-time-cell',
      apply: applyTimeFormatting,
      style: true,
    },
    {
      read: () => [
        appSettings.colorRatings,
        ...['submissions', 'status', 'hacks', 'problemset', 'contestProblems', 'standings'].map(
          (key) => appSettings.show[key],
        ),
      ],
      selector: ratingNodes,
      style: true,
      ratingVisibility: true,
    },
    {
      read: () => [
        appSettings.colorRatings,
        appSettings.displayStyle,
        appSettings.tagFillCell,
        appSettings.clist.enabled,
        appSettings.show.problemTags,
      ],
      selector: ratingNodes,
      apply: refreshRatingsOnPage,
    },
    {
      read: () => [appSettings.show.userAvatar, appSettings.show.formatTeams],
      selector:
        '.status-party-cell, table.standings .contestant-cell, .cf-avatar-inline-user, .second-level-menu-list a[href*="/profile/"]',
      apply: refreshUserAvatarsAndStandings,
      style: true,
    },
    {
      read: () => appSettings.show.langIcon,
      selector: '[data-cf-lang-icon-processed]',
      style: true,
    },
    {
      read: () => [
        appSettings.avatarSize,
        appSettings.langIconSize,
        appSettings.acBgColor,
        appSettings.show.acHighlight,
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
  applyRatings(ratings);
  formatStandingsCells();
  applyProblemTagsVisibility();
  wrapVirtualParticipationTime();
  setTimeout(applyTimeFormatting, 500);
  setupObserver(ratings);
}
