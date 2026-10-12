import { applyRatingStyle } from '../cells/style.js';
import { getProblemRatingFromHref } from '../lookup.js';

// 榜单：在表头下面加一行，写各题的难度。
export function addStandingsRatingRow() {
  const standingsTables = document.querySelectorAll(
    'table.standings:not([data-cf-rating-standings-processed])',
  );
  standingsTables.forEach((table) => {
    table.setAttribute('data-cf-rating-standings-processed', 'true');

    const headerRow = table.querySelector('tr');
    if (!headerRow) return;

    const ratingRow = document.createElement('tr');
    ratingRow.className = 'cf-rating-standings-row';

    let hasRatings = false;

    Array.from(headerRow.cells).forEach((cell) => {
      const newCell = document.createElement('th');
      // 不另设内边距和字号，沿用原站单元格的，评分行才与表头行等高。
      // 预测列的占位格也保留归属，关闭预测时不留下多余空列。
      if (cell.dataset.predictionColumn) {
        newCell.dataset.cfPrediction = '';
        newCell.dataset.predictionColumn = cell.dataset.predictionColumn;
        newCell.className = 'cf-prediction-cell cf-prediction-placeholder';
      }

      const link = cell.querySelector('a[href*="/problem/"]');
      if (link) {
        const probName =
          link.getAttribute('title') || cell.getAttribute('title') || link.textContent;
        const info = getProblemRatingFromHref(link.href, probName);
        applyRatingStyle(newCell, info?.rating);
        if (info && typeof info.rating === 'number') {
          hasRatings = true;

          // Mark the link so it's skipped by standalone processor
          link.setAttribute('data-cf-rating-added', 'true');
        }
      }
      ratingRow.appendChild(newCell);
    });

    if (hasRatings) {
      // Insert the new rating row right below the header row
      headerRow.parentNode.insertBefore(ratingRow, headerRow.nextSibling);
    }
  });
}
