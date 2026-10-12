import { appSettings } from '../../../settings.js';
import { applyRatingStyle } from '../cells/style.js';
import { getProblemRatingFromHref } from '../lookup.js';

// 题库与比赛题目表：在末尾加上难度列。
export function addProblemsRatingColumn() {
  const problemsTables = document.querySelectorAll(
    'table.problems:not([data-cf-rating-problems-processed])',
  );
  problemsTables.forEach((table) => {
    const isProblemset = window.location.pathname.toLowerCase().includes('/problemset');
    const shouldShowRating = isProblemset
      ? appSettings.ratings.show.problemset
      : appSettings.ratings.show.contestProblems;

    if (isProblemset) table.classList.add('cf-table-problemset');
    else table.classList.add('cf-table-contestProblems');

    table.setAttribute('data-cf-rating-problems-processed', 'true');

    const headerRow = table.querySelector('tr');
    if (headerRow) {
      const prevTh = headerRow.querySelector('th.right') || headerRow.lastElementChild;
      if (prevTh && prevTh.classList.contains('right')) {
        prevTh.classList.remove('right');
      }

      const th = document.createElement('th');
      th.className = 'top right cf-rating-col';
      th.style.width = '4.5em';
      th.style.textAlign = 'center';
      th.textContent = 'Rating';

      headerRow.appendChild(th);
    }

    const dataRows = table.querySelectorAll('tr:not(:first-child)');
    dataRows.forEach((row) => {
      if (row.cells.length < 2) return;

      const idCell = row.querySelector('td.id');

      const prevTd = row.querySelector('td.right') || row.lastElementChild;
      if (prevTd && prevTd.classList.contains('right')) {
        prevTd.classList.remove('right');
      }

      const td = document.createElement('td');
      td.className = 'right cf-rating-col';
      td.style.textAlign = 'center';
      td.style.verticalAlign = 'middle';

      const link = idCell ? idCell.querySelector('a') : row.querySelector('a[href*="/problem/"]');

      if (link) {
        const titleLink =
          row.querySelector('td:nth-child(2) a') ||
          row.querySelector(
            'a[href*="/problem/"]:not([href$="' + link.getAttribute('href') + '"])',
          );
        const probName = titleLink ? titleLink.textContent : row.textContent;
        const info = getProblemRatingFromHref(link.href, probName);
        applyRatingStyle(td, info?.rating);

        const rowLinks = row.querySelectorAll('a[href*="/problem/"]');
        rowLinks.forEach((l) => l.setAttribute('data-cf-rating-added', 'true'));
      }

      row.appendChild(td);
    });
  });
}
