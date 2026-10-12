import { appSettings } from '../../../settings.js';
import { enhanceLanguageCell } from '../../appearance/language-icons.js';
import { walkAndReplaceVerdict } from '../../appearance/verdicts/index.js';
import { formatStandingsCells } from '../../user/avatars/teams.js';
import { isTeamCell } from '../../user/avatars/structure.js';
import { applyRatingStyle } from '../cells/style.js';
import { getProblemRatingFromHref } from '../lookup.js';

// 按表头文字找出各列的位置。有题目列或 Hack 双方列的，才算提交表或 Hack 表。
function findColumns(headerRow, isHacksPage) {
  let idColIdx = -1;
  let timeColIdx = -1;
  let judgedColIdx = -1;
  let whoColIdx = -1;
  let problemColIdx = -1;
  let langColIdx = -1;
  let verdictColIdx = -1;
  let timeConsumedColIdx = -1;
  let memoryConsumedColIdx = -1;
  let isHacks = isHacksPage;
  let isStatusOrHacks = false;

  Array.from(headerRow.cells).forEach((th, idx) => {
    const text = th.textContent.toLowerCase();
    if (
      idColIdx === -1 &&
      (idx === 0 || text === '#' || text.startsWith('#') || th.classList.contains('id-cell'))
    ) {
      idColIdx = idx;
    }
    if (
      timeColIdx === -1 &&
      (text.includes('when') ||
        text.includes('提交时间') ||
        text.includes('когда') ||
        text.includes('sent') ||
        text.includes('отослано') ||
        text.includes('date') ||
        ((text.includes('time') || text.includes('时间')) && idx < 3))
    ) {
      timeColIdx = idx;
    }
    if (
      whoColIdx === -1 &&
      (text.includes('who') ||
        text.includes('author') ||
        text.includes('提交者') ||
        text.includes('автор'))
    ) {
      whoColIdx = idx;
    }
    if (
      problemColIdx === -1 &&
      (text.includes('problem') ||
        text.includes('题目') ||
        text.includes('问题') ||
        text.includes('задача'))
    ) {
      problemColIdx = idx;
      isStatusOrHacks = true;
    }
    if (
      langColIdx === -1 &&
      (text.includes('lang') || text.includes('语言') || text.includes('язык'))
    ) {
      langColIdx = idx;
    }
    if (
      verdictColIdx === -1 &&
      (text.includes('verdict') ||
        text.includes('判题状态') ||
        text.includes('结果') ||
        text.includes('вердикт'))
    ) {
      verdictColIdx = idx;
    }
    // 提交详情页另有一列判题时间，同样按时间处理。
    if (
      judgedColIdx === -1 &&
      (text.includes('judged') || text.includes('判题时间') || text.includes('протестировано'))
    ) {
      judgedColIdx = idx;
    }
    if (
      timeConsumedColIdx === -1 &&
      idx !== timeColIdx &&
      idx !== judgedColIdx &&
      (text.includes('time') || text.includes('时间') || text.includes('время')) &&
      idx >= 3
    ) {
      timeConsumedColIdx = idx;
    }
    if (
      memoryConsumedColIdx === -1 &&
      (text.includes('memory') || text.includes('内存') || text.includes('память'))
    ) {
      memoryConsumedColIdx = idx;
    }
    if (text.includes('hacker') || text.includes('defender')) {
      isHacks = true;
      isStatusOrHacks = true;
    }
  });

  return {
    idColIdx,
    timeColIdx,
    judgedColIdx,
    whoColIdx,
    langColIdx,
    verdictColIdx,
    timeConsumedColIdx,
    memoryConsumedColIdx,
    isHacks,
    isStatusOrHacks,
  };
}

// 表头：给各列加上类名，时间列补上时区，需要时在末尾加上难度列的表头。
function enhanceHeader(table, headerRow, columns, shouldShowRating) {
  const {
    idColIdx,
    timeColIdx,
    judgedColIdx,
    whoColIdx,
    langColIdx,
    verdictColIdx,
    timeConsumedColIdx,
    memoryConsumedColIdx,
  } = columns;

  // 1) # Column - Never wrap, compact width
  if (idColIdx !== -1 && headerRow.cells[idColIdx]) {
    headerRow.cells[idColIdx].classList.add('id-cell');
  }

  // 2) Append timezone to Time column headers
  // 提交详情页的两列时间不带时区，原站按服务器时间（莫斯科，UTC+3）显示，所以取不到时就标 UTC+3。
  for (const idx of [timeColIdx, judgedColIdx]) {
    const th = idx !== -1 && headerRow.cells[idx];
    if (!th) continue;
    th.classList.add('cf-table-time-header');
    let tzStr = 'UTC+3'; // Codeforces default server time (MSK)

    const firstDataRow = table.querySelector('tr:not(:first-child)');
    if (firstDataRow && firstDataRow.cells[idx]) {
      const tzMatch = firstDataRow.cells[idx].textContent.match(/UTC[+-]?\d*(:\d+)?/i);
      if (tzMatch) {
        tzStr = tzMatch[0].toUpperCase();
      }
    }
    th.innerHTML = `${th.innerHTML}<br><span class="cf-time-timezone-label">(${tzStr})</span>`;
  }

  // 3) Who Column
  if (whoColIdx !== -1 && headerRow.cells[whoColIdx]) {
    headerRow.cells[whoColIdx].classList.add('status-party-cell');
  }

  // 4) Lang Column
  if (langColIdx !== -1 && headerRow.cells[langColIdx]) {
    headerRow.cells[langColIdx].classList.add('cf-table-lang-header');
  }

  // 5) Verdict Column - Allow controlled wrapping, do NOT set white-space: nowrap
  if (verdictColIdx !== -1 && headerRow.cells[verdictColIdx]) {
    headerRow.cells[verdictColIdx].classList.add('status-verdict-cell');
  }

  // 6) Time & Memory Consumed
  if (timeConsumedColIdx !== -1 && headerRow.cells[timeConsumedColIdx]) {
    headerRow.cells[timeConsumedColIdx].classList.add('cf-time-consumed-header');
  }
  if (memoryConsumedColIdx !== -1 && headerRow.cells[memoryConsumedColIdx]) {
    headerRow.cells[memoryConsumedColIdx].classList.add('cf-memory-consumed-header');
  }

  // 7) Rating Column
  if (shouldShowRating) {
    // Remove 'right' class from the previous last header cell
    const prevTh = headerRow.querySelector('th.right');
    if (prevTh) prevTh.classList.remove('right');

    // Create new Rating header
    const th = document.createElement('th');
    th.className = 'top right cf-rating-col';
    th.textContent = 'Rating';
    headerRow.appendChild(th);
  }
}

// 一行：给各格加上类名，处理语言和评测结果；这一行第一次处理时，在末尾加上难度格。
function enhanceRow(row, columns, shouldShowRating) {
  const {
    idColIdx,
    timeColIdx,
    judgedColIdx,
    whoColIdx,
    langColIdx,
    verdictColIdx,
    timeConsumedColIdx,
    memoryConsumedColIdx,
  } = columns;

  // 1) # Column
  if (idColIdx !== -1 && row.cells[idColIdx]) {
    row.cells[idColIdx].classList.add('id-cell');
  }

  // 2) Time Formatting
  for (const idx of [timeColIdx, judgedColIdx]) {
    const timeCell = idx !== -1 && row.cells[idx];
    if (timeCell && !timeCell.hasAttribute('data-cf-time-processed')) {
      timeCell.setAttribute('data-cf-time-processed', 'true');
      timeCell.classList.add('cf-table-time-cell');
      timeCell.setAttribute('data-original-time', timeCell.innerHTML);
    }
  }

  // 3) Who Column
  if (whoColIdx !== -1 && row.cells[whoColIdx]) {
    const partyCell = row.cells[whoColIdx];
    partyCell.classList.add('status-party-cell');
    if (!partyCell.hasAttribute('data-original-html')) {
      partyCell.setAttribute('data-original-html', partyCell.innerHTML);
    }
    const isTeam = isTeamCell(partyCell);

    if (isTeam) {
      partyCell.style.setProperty('word-break', 'break-word', 'important');
      if (!partyCell.classList.contains('cf-team-formatted')) {
        partyCell.classList.add('cf-team-unformatted');
      }
    }
  }

  // 4) Language Icon Formatting
  if (langColIdx !== -1 && row.cells[langColIdx]) {
    enhanceLanguageCell(row.cells[langColIdx]);
  }
  // 5) Verdict Abbreviation
  if (verdictColIdx !== -1) {
    const verdictCell = row.cells[verdictColIdx];
    if (verdictCell) {
      verdictCell.setAttribute('data-cf-verdict-processed', 'true');
      verdictCell.classList.add('status-verdict-cell');
      walkAndReplaceVerdict(verdictCell);
    }
  }

  // 6) Time & Memory Consumed
  if (timeConsumedColIdx !== -1 && row.cells[timeConsumedColIdx]) {
    row.cells[timeConsumedColIdx].classList.add('time-consumed-cell');
  }
  if (memoryConsumedColIdx !== -1 && row.cells[memoryConsumedColIdx]) {
    row.cells[memoryConsumedColIdx].classList.add('memory-consumed-cell');
  }

  if (row.hasAttribute('data-cf-rating-processed')) return;
  row.setAttribute('data-cf-rating-processed', 'true');

  // Skip empty/info rows (like "No submissions found")
  if (row.cells.length <= 1) {
    if (row.cells.length === 1 && shouldShowRating) {
      row.cells[0].colSpan = (parseInt(row.cells[0].colSpan) || 1) + 1;
    }
    return;
  }

  if (!shouldShowRating) return;

  // Remove 'right' class from the previous last data cell
  const prevTd = row.querySelector('td.right');
  if (prevTd) prevTd.classList.remove('right');

  // Find rating from links in the row
  let problemRating = null;
  const links = row.querySelectorAll('a[href*="/problem/"]');
  for (const link of links) {
    const info = getProblemRatingFromHref(link.href, link.textContent);
    if (info && typeof info.rating === 'number') {
      problemRating = info.rating;
    }
    // Mark ALL problem links in the datatable so the standalone logic ignores them
    link.setAttribute('data-cf-rating-added', 'true');
  }

  // Create new Rating cell
  const td = document.createElement('td');
  td.className = 'right cf-rating-col';
  td.style.textAlign = 'center';
  td.style.verticalAlign = 'middle';
  td.style.width = '52px';
  td.style.minWidth = '52px';
  td.style.maxWidth = '52px';
  td.style.setProperty('white-space', 'nowrap', 'important');

  applyRatingStyle(td, problemRating);
  row.appendChild(td);
}

// 提交表与 Hack 表：标出各列，处理时间、参赛者、语言和评测结果，并在末尾加上难度列。
export function enhanceStatusTables() {
  const statusTables = document.querySelectorAll(
    'table.status-frame-datatable, div.datatable table:not(.standings):not(.problems)',
  );
  statusTables.forEach((table) => {
    const headerRow = table.querySelector('tr');
    if (!headerRow) return;

    const isHacksPage = window.location.href.includes('/hacks');
    const path = window.location.pathname.toLowerCase();
    const isSubmissionsPage = path.includes('/my') || path.includes('/submissions');

    table.classList.add('cf-status-table');
    if (isHacksPage) table.classList.add('cf-table-hacks');
    else if (isSubmissionsPage) table.classList.add('cf-table-submissions');
    else table.classList.add('cf-table-status');

    const columns = findColumns(headerRow, isHacksPage);
    if (!columns.isStatusOrHacks) return; // Skip if it's not a status or hacks table (e.g., contest list)

    let shouldShowRating = false;
    if (columns.isHacks) {
      shouldShowRating = appSettings.ratings.show.hacks;
    } else if (isSubmissionsPage) {
      shouldShowRating = appSettings.ratings.show.submissions;
    } else {
      shouldShowRating = appSettings.ratings.show.status;
    }

    if (
      !shouldShowRating &&
      !appSettings.appearance.timeFormat.enabled &&
      columns.langColIdx === -1
    )
      return;

    if (!headerRow.hasAttribute('data-cf-rating-processed')) {
      headerRow.setAttribute('data-cf-rating-processed', 'true');
      enhanceHeader(table, headerRow, columns, shouldShowRating);
    }

    const dataRows = table.querySelectorAll('tr:not(:first-child)');
    dataRows.forEach((row) => enhanceRow(row, columns, shouldShowRating));
    formatStandingsCells();
  });
}
