import { appSettings } from '../../settings.js';
import { getClistProblems } from './clist/sync.js';
import { latestRatingsMap } from './data.js';
import { applyRatingStyle } from './cells/style.js';
import { getProblemRating } from './lookup.js';
import { enhanceStatusTables } from './pages/status-table.js';
import { addStandingsRatingRow } from './pages/standings-row.js';
import { addProblemsRatingColumn } from './pages/problems-table.js';
import { updateProblemPageRatingTag } from './pages/problem-page.js';

// 设置变化后重新评估已增强的评分内容。
export function refreshRatingsOnPage() {
  const ratingsMap = latestRatingsMap || {};

  // 1. Refresh all rating cells in tables
  const ratingCols = document.querySelectorAll('td.cf-rating-col');
  ratingCols.forEach((td) => {
    const row = td.closest('tr');
    if (!row) return;

    const link = row.querySelector('td.id a') || row.querySelector('a[href*="/problem/"]');
    if (link) {
      const titleLink =
        row.querySelector('td:nth-child(2) a') ||
        row.querySelector('a[href*="/problem/"]:not([href$="' + link.getAttribute('href') + '"])');
      const probName = titleLink
        ? titleLink.textContent
        : link.getAttribute('title') || link.textContent;
      const rating = getProblemRating(link.href, probName);
      applyRatingStyle(td, rating);
    }
  });

  // 2. Refresh Standings tables rating row
  const standingsRows = document.querySelectorAll('tr.cf-rating-standings-row');
  standingsRows.forEach((ratingRow) => {
    const table = ratingRow.closest('table.standings');
    if (!table) return;
    const headerRow = table.querySelector('tr:first-child');
    if (!headerRow) return;

    Array.from(headerRow.cells).forEach((th, idx) => {
      const ratingCell = ratingRow.cells[idx];
      if (!ratingCell) return;
      const link = th.querySelector('a[href*="/problem/"]');
      if (link) {
        const probName = link.getAttribute('title') || th.getAttribute('title') || link.textContent;
        const rating = getProblemRating(link.href, probName);
        applyRatingStyle(ratingCell, rating);
      }
    });
  });

  // 3. Refresh Problem Page sidebar tags
  updateProblemPageRatingTag(ratingsMap);
}

// 按页面表格和链接结构插入评分列及难度标记。
export function applyRatings(ratingsMap) {
  const clistEnabled = !!(appSettings.ratings.clist && appSettings.ratings.clist.enabled);
  const clistData = clistEnabled ? getClistProblems() : null;
  const hasOfficial = ratingsMap && Object.keys(ratingsMap).length > 0;
  if (!hasOfficial && !clistData) return;
  const safeRatingsMap = ratingsMap || {};

  enhanceStatusTables();
  addStandingsRatingRow();
  addProblemsRatingColumn();
  updateProblemPageRatingTag(safeRatingsMap);
}
