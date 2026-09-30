import { appSettings } from '../../settings.js';
import { isDarkTheme } from '../page/theme.js';
import { getRatingTagStyle, getRatingBgColor, getRatingBorderColor } from './rules.js';
import { isCurrentPageProblemAccepted } from '../general/solved.js';
import { getClistProblems } from './clist.js';
import { latestRatingsMap, getPeerContests, getProblemsByContest } from './data.js';
import { cleanProblemTitle } from '../../utils/problem.js';
import { applyProblemTagsVisibility } from '../appearance/problem-tags.js';
import { beginTagMotion, finishTagMotion } from '../appearance/problem-tags-motion.js';
import { enhanceLanguageCell } from '../appearance/language-icons.js';
import { walkAndReplaceVerdict } from '../appearance/verdicts.js';
import { formatStandingsCells } from '../user/avatars/standings.js';
import { isTeamCell } from '../user/avatars/structure.js';
import { updateRatingValue } from './value-motion.js';

// 按当前显示模式绘制评分单元格。
export function applyRatingStyle(cell, rating) {
  const hasRating = typeof rating === 'number' && Number.isFinite(rating);
  if (hasRating) cell.dataset.rating = rating;
  else delete cell.dataset.rating;
  cell.dataset.cfRatingEmpty = String(!hasRating);
  cell.style.textAlign = 'center';
  cell.style.verticalAlign = 'middle';
  let value = cell.querySelector('.cf-rating-value');
  if (!value) {
    value = document.createElement('span');
    value.className = 'cf-rating-value';
    cell.replaceChildren(value);
  }
  updateRatingValue(value, hasRating ? rating : null);
  if (!hasRating) {
    // 保留同一块底板及上一种模式，空值仅收起，不拆掉动画节点。
    cell.dataset.cfRatingMode ||= 'plain';
    return;
  }
  const enabled = appSettings.colorRatings;
  const tag = appSettings.displayStyle === 'tag';
  const compact = tag && appSettings.tagFillCell === false;
  const palette = getRatingTagStyle(rating);
  cell.dataset.cfRatingMode = !enabled ? 'plain' : compact ? 'compact' : tag ? 'filled' : 'block';
  cell.style.setProperty(
    '--cf-rating-bg',
    !enabled ? 'transparent' : tag ? palette.bg : getRatingBgColor(rating),
  );
  cell.style.setProperty(
    '--cf-rating-color',
    !enabled
      ? 'inherit'
      : tag
        ? palette.text
        : isDarkTheme()
          ? '#EEEEEE'
          : rating >= 1600
            ? 'white'
            : 'black',
  );
  cell.style.setProperty('--cf-rating-border', compact && enabled ? palette.border : 'transparent');
  cell.style.setProperty('--cf-rating-digits', String(rating).length + 'ch');
  cell.style.setProperty('background-color', 'transparent', 'important');
  cell.style.removeProperty('color');
  cell.style.removeProperty('font-weight');
  cell.style.removeProperty('box-shadow');
}

// 取出可恢复的原始样式，过滤增强产生的样式项。
export function getCleanCssText(el) {
  if (!el || !el.style) return '';
  return (el.style.cssText || '')
    .replace(/display\s*:\s*none\s*!important\s*;?/gi, '')
    .replace(/display\s*:\s*none\s*;?/gi, '')
    .trim();
}

// 按主题和评分为原生题目标签应用样式。
export function applyProblemTagStyle(box, tag, rating) {
  const isBoxHidden =
    box && (box.getAttribute('data-cf-tag-hidden') === 'true' || box.style.display === 'none');
  const isTagHidden =
    tag && (tag.getAttribute('data-cf-tag-hidden') === 'true' || tag.style.display === 'none');
  const shouldHideScoreTag =
    !!appSettings.hideTags &&
    !!appSettings.hideRatingTag &&
    !(appSettings.notHideAcTags && isCurrentPageProblemAccepted());

  if (!appSettings.show.problemTags || !appSettings.colorRatings) {
    if (box && box.hasAttribute('data-original-css')) box.style.cssText = box.dataset.originalCss;
    else if (box) {
      box.style.removeProperty('background-color');
      box.style.removeProperty('border-color');
      box.style.removeProperty('color');
    }
    if (tag.hasAttribute('data-original-css')) tag.style.cssText = tag.dataset.originalCss;
    else {
      tag.style.removeProperty('background-color');
      tag.style.removeProperty('color');
    }
    if (shouldHideScoreTag || isBoxHidden) {
      if (box) {
        box.style.setProperty('display', 'none', 'important');
        box.setAttribute('data-cf-tag-hidden', 'true');
      }
    }
    if (shouldHideScoreTag || isTagHidden) {
      if (tag) {
        tag.style.setProperty('display', 'none', 'important');
        tag.setAttribute('data-cf-tag-hidden', 'true');
      }
    }
    return;
  }

  if (box && box.hasAttribute('data-original-css')) box.style.cssText = box.dataset.originalCss;
  if (tag.hasAttribute('data-original-css')) tag.style.cssText = tag.dataset.originalCss;

  tag.style.setProperty('background-color', 'transparent', 'important');
  if (appSettings.displayStyle === 'tag') {
    const tagStyle = getRatingTagStyle(rating);
    if (box) {
      box.style.setProperty('background-color', tagStyle.bg, 'important');
      box.style.setProperty('border-color', tagStyle.border, 'important');
      box.style.setProperty('color', tagStyle.text, 'important');
    }
    tag.style.setProperty('color', tagStyle.text, 'important');
  } else {
    const isWhite = rating >= 1600;
    if (box) {
      box.style.setProperty('background-color', getRatingBgColor(rating), 'important');
      box.style.setProperty('border-color', getRatingBorderColor(rating), 'important');
      if (isWhite) box.style.setProperty('color', 'white', 'important');
      else box.style.removeProperty('color');
    }
    tag.style.setProperty('color', isWhite ? 'white' : '#000', 'important');
  }

  if (shouldHideScoreTag || isBoxHidden) {
    if (box) {
      box.style.setProperty('display', 'none', 'important');
      box.setAttribute('data-cf-tag-hidden', 'true');
    }
  }
  if (shouldHideScoreTag || isTagHidden) {
    if (tag) {
      tag.style.setProperty('display', 'none', 'important');
      tag.setAttribute('data-cf-tag-hidden', 'true');
    }
  }
}

// 结合官方、Clist 和并赛题目查找难度。
export function getProblemRating(hrefOrKey, probName) {
  if (!hrefOrKey) return null;
  const clistEnabled = !!(appSettings.clist && appSettings.clist.enabled);
  const clistData = clistEnabled ? getClistProblems() : null;
  const safeRatingsMap = latestRatingsMap || {};

  let key = '';
  let contestId = null;
  let index = '';
  if (typeof hrefOrKey === 'string' && hrefOrKey.includes('/')) {
    const regexes = [
      /\/contest\/(\d+)\/problem\/([A-Za-z0-9_]+)/i,
      /\/problemset\/problem\/(\d+)\/([A-Za-z0-9_]+)/i,
      /\/gym\/(\d+)\/problem\/([A-Za-z0-9_]+)/i,
    ];
    for (const regex of regexes) {
      const match = hrefOrKey.match(regex);
      if (match) {
        contestId = parseInt(match[1], 10);
        index = match[2].toUpperCase();
        key = `${match[1]}${match[2]}`.toUpperCase();
        break;
      }
    }
  } else if (typeof hrefOrKey === 'string') {
    key = hrefOrKey.toUpperCase();
    const match = key.match(/^(\d+)([A-Za-z0-9_]+)$/);
    if (match) {
      contestId = parseInt(match[1], 10);
      index = match[2];
    }
  }

  if (!key) return null;

  // 1. PRIORITY: When Clist is enabled, check direct Clist hit with key
  if (clistEnabled && clistData && clistData[key]) {
    const clistItem = clistData[key];
    const clistRating =
      typeof clistItem === 'number'
        ? clistItem
        : clistItem && typeof clistItem.rating === 'number'
          ? clistItem.rating
          : null;
    if (typeof clistRating === 'number') {
      return clistRating;
    }
  }

  // 2. FALLBACK: Codeforces official problem rating
  // 2.1 Direct hit by key (e.g. 2202A)
  const officialItem = safeRatingsMap[key] || safeRatingsMap[key.toLowerCase()];
  if (officialItem !== undefined && officialItem !== null) {
    const officialRating =
      typeof officialItem === 'number'
        ? officialItem
        : typeof officialItem.rating === 'number'
          ? officialItem.rating
          : null;
    if (typeof officialRating === 'number') {
      return officialRating;
    }
  }

  // 2.2 Parallel contest fallback: find peer contests in the same concurrent group and match by problem name
  if (contestId) {
    const peers = getPeerContests(contestId);
    if (peers && peers.length > 0) {
      let targetName = '';
      if (probName && typeof probName === 'string') {
        targetName = cleanProblemTitle(probName);
      }
      if (!targetName && officialItem && officialItem.name) {
        targetName = cleanProblemTitle(officialItem.name);
      }

      if (targetName) {
        const lowerTarget = targetName.toLowerCase();
        for (const peerId of peers) {
          const peerProblems = getProblemsByContest(peerId);
          for (const pEntry of peerProblems) {
            const pItem = pEntry.item;
            if (pItem && pItem.name) {
              const peerName = cleanProblemTitle(pItem.name).toLowerCase();
              if (peerName === lowerTarget) {
                const peerRating =
                  typeof pItem.rating === 'number'
                    ? pItem.rating
                    : typeof pItem === 'number'
                      ? pItem
                      : null;
                if (typeof peerRating === 'number') {
                  return peerRating;
                }
              }
            }
          }
        }
      }
    }
  }

  return null;
}

// 更新或移除链接旁的评分标记。
export function updateSpanRatingText(span, newRating) {
  if (!span) return;
  const existing = span.querySelector(':scope > .cf-rating-number');
  if (existing) {
    updateRatingValue(existing, newRating, '*');
    return;
  }
  let found = false;
  for (const node of span.childNodes) {
    if (node.nodeType === 3 /* Node.TEXT_NODE */ && /\*\s*\d+/.test(node.nodeValue)) {
      const number = document.createElement('span');
      number.className = 'cf-rating-number';
      number.textContent = node.nodeValue.match(/\*\s*\d+/)[0];
      const [before, after] = node.nodeValue.split(/\*\s*\d+/, 2);
      node.replaceWith(document.createTextNode(before), number, document.createTextNode(after));
      updateRatingValue(number, newRating, '*');
      found = true;
      break;
    }
  }
  if (!found) {
    const number = document.createElement('span');
    number.className = 'cf-rating-number';
    updateRatingValue(number, newRating, '*');
    span.insertBefore(number, span.firstChild);
  }
}

// 解析题目链接并返回对应难度信息。
export function getProblemRatingFromHref(href, title) {
  if (!href) return null;
  const regexes = [
    /\/contest\/(\d+)\/problem\/([A-Za-z0-9_]+)/i,
    /\/problemset\/problem\/(\d+)\/([A-Za-z0-9_]+)/i,
    /\/gym\/(\d+)\/problem\/([A-Za-z0-9_]+)/i,
  ];
  for (const regex of regexes) {
    const match = href.match(regex);
    if (match) {
      const rating = getProblemRating(href, title);
      return { contestId: match[1], index: match[2], rating: rating };
    }
  }
  return null;
}

// 更新题目详情侧栏中的难度标签。
export function updateProblemPageRatingTag(ratingsMap) {
  let sidebox = Array.from(document.querySelectorAll('.roundbox.sidebox, #sidebar .roundbox')).find(
    (box) => {
      if (box.closest('.cf-settings-modal')) return false;
      const caption = box.querySelector('.caption');
      return caption && /tags|标签|теги/i.test(caption.textContent);
    },
  );
  if (!sidebox) {
    const firstTag = document.querySelector('span.tag-box');
    if (
      firstTag &&
      !firstTag.closest('.cf-settings-modal') &&
      !firstTag.closest('table.problems')
    ) {
      sidebox = firstTag.closest('.roundbox.sidebox, #sidebar .roundbox');
    }
  }
  if (!sidebox) return;

  const container =
    sidebox.querySelector('div[style*="padding"]') ||
    sidebox.querySelector('.caption')?.nextElementSibling ||
    sidebox;
  if (!container) return;
  const motion = beginTagMotion(container);

  const clistEnabled = !!(appSettings.clist && appSettings.clist.enabled);
  let problemPageTitle = '';
  const titleEl = document.querySelector('.problem-statement .header .title');
  if (titleEl) {
    problemPageTitle = titleEl.textContent;
  }

  const tagSpans = Array.from(container.querySelectorAll('span.tag-box')).filter(
    (s) => !s.classList.contains('cf-tags-hidden-notice'),
  );

  // Find existing official rating tag and existing clist-created tags
  let officialTagSpan = null;
  const clistTags = [];

  tagSpans.forEach((span) => {
    if (span.getAttribute('data-cf-clist-tag') === 'true') {
      clistTags.push(span);
      return;
    }
    const text = span.textContent.trim();
    const title = span.getAttribute('title') || '';
    if (
      span.hasAttribute('data-original-rating') ||
      /^\*\s*\d+/.test(text) ||
      /difficulty|难度/i.test(title)
    ) {
      if (!officialTagSpan) {
        officialTagSpan = span;
      }
    }
  });

  const cleanClistTags = () => {
    clistTags.forEach((ct) => {
      const parent = ct.parentElement;
      if (parent && parent.classList.contains('roundbox') && parent !== container) {
        parent.remove();
      } else {
        ct.remove();
      }
    });
  };

  let targetRating = null;
  let isClist = false;
  if (clistEnabled) {
    const clistRating = getProblemRating(window.location.href, problemPageTitle);
    if (typeof clistRating === 'number') {
      targetRating = clistRating;
      isClist = true;
    }
  }

  // Case 1: Problem has an official rating tag (e.g. Ref/problem)
  if (officialTagSpan) {
    cleanClistTags();

    // Store original values once
    if (!officialTagSpan.hasAttribute('data-original-rating')) {
      const m = officialTagSpan.textContent.trim().match(/^\*\s*(\d+)/);
      if (m) {
        officialTagSpan.setAttribute('data-original-rating', m[1]);
      }
      officialTagSpan.setAttribute('data-original-text', officialTagSpan.textContent.trim());
      officialTagSpan.setAttribute(
        'data-original-title',
        officialTagSpan.getAttribute('title') || 'Difficulty',
      );
    }
    if (!officialTagSpan.hasAttribute('data-original-css')) {
      officialTagSpan.dataset.originalCss = getCleanCssText(officialTagSpan);
    }

    const parentBox =
      officialTagSpan.parentElement &&
      officialTagSpan.parentElement.classList.contains('roundbox') &&
      !officialTagSpan.parentElement.classList.contains('sidebox')
        ? officialTagSpan.parentElement
        : null;
    if (parentBox && !parentBox.hasAttribute('data-original-css')) {
      parentBox.dataset.originalCss = getCleanCssText(parentBox);
    }

    let effectiveRating = targetRating;
    if (typeof effectiveRating !== 'number') {
      const origRatingStr = officialTagSpan.getAttribute('data-original-rating');
      if (origRatingStr !== null && origRatingStr !== undefined && origRatingStr !== '') {
        effectiveRating = parseInt(origRatingStr, 10);
      }
    }

    if (typeof effectiveRating === 'number') {
      updateSpanRatingText(officialTagSpan, effectiveRating);
      officialTagSpan.title = isClist
        ? `Difficulty: ${effectiveRating} (CList)`
        : officialTagSpan.getAttribute('data-original-title') || 'Difficulty';
      officialTagSpan.dataset.rating = effectiveRating;
      officialTagSpan.setAttribute('data-cf-rating-tag', 'true');
      officialTagSpan.setAttribute('data-cf-rating-added', 'true');
      if (parentBox) {
        parentBox.dataset.rating = effectiveRating;
        parentBox.setAttribute('data-cf-rating-tag', 'true');
        parentBox.setAttribute('data-cf-rating-added', 'true');
      }
      applyProblemTagStyle(parentBox, officialTagSpan, effectiveRating);
    }
    applyProblemTagsVisibility({ animate: false });
    finishTagMotion(container, motion, { collapseToNotice: false });
    return;
  }

  // Case 2: No official rating tag exists (e.g. Ref/pro2)
  let effectiveRating = targetRating;
  if (typeof effectiveRating !== 'number') {
    const info = getProblemRatingFromHref(window.location.href, problemPageTitle);
    if (info && typeof info.rating === 'number') {
      effectiveRating = info.rating;
    }
  }

  const existingClistSpan = clistTags[0];

  if (typeof effectiveRating === 'number') {
    if (existingClistSpan) {
      existingClistSpan.removeAttribute('data-cf-rating-absent');
      updateSpanRatingText(existingClistSpan, effectiveRating);
      existingClistSpan.title = isClist ? `Difficulty: ${effectiveRating} (CList)` : 'Difficulty';
      existingClistSpan.dataset.rating = effectiveRating;
      const parent =
        existingClistSpan.parentElement &&
        existingClistSpan.parentElement.classList.contains('roundbox') &&
        existingClistSpan.parentElement !== container
          ? existingClistSpan.parentElement
          : null;
      if (parent) {
        parent.removeAttribute('data-cf-rating-absent');
        parent.dataset.rating = effectiveRating;
        parent.setAttribute('data-cf-rating-tag', 'true');
        parent.setAttribute('data-cf-rating-added', 'true');
      }
      applyProblemTagStyle(parent, existingClistSpan, effectiveRating);
    } else {
      // Find all existing tag items in container to determine insertion point at the end
      const allTagItems = Array.from(container.children).filter((child) => {
        if (child.classList.contains('cf-tags-hidden-notice')) return false;
        if (child.matches('span.tag-box')) return true;
        if (child.querySelector('span.tag-box')) return true;
        return false;
      });

      const firstTag = container.querySelector('span.tag-box');
      const isWrapped =
        firstTag &&
        firstTag.parentElement &&
        firstTag.parentElement !== container &&
        firstTag.parentElement.classList.contains('roundbox');
      const sampleFontSize = firstTag?.style?.fontSize || '1.2rem';

      const span = document.createElement('span');
      span.className = 'tag-box';
      span.style.fontSize = sampleFontSize;
      span.textContent = `*${effectiveRating}`;
      span.title = isClist ? `Difficulty: ${effectiveRating} (CList)` : 'Difficulty';
      span.setAttribute('data-cf-rating-tag', 'true');
      span.setAttribute('data-cf-clist-tag', 'true');
      span.setAttribute('data-cf-rating-added', 'true');
      span.dataset.rating = effectiveRating;

      let tagItem;
      if (isWrapped) {
        tagItem = document.createElement('div');
        tagItem.className = 'roundbox borderTopRound borderBottomRound';
        tagItem.style.cssText = 'margin:2px; padding:0 3px 2px 3px; float:left;';
        tagItem.setAttribute('data-cf-rating-tag', 'true');
        tagItem.setAttribute('data-cf-clist-tag', 'true');
        tagItem.setAttribute('data-cf-rating-added', 'true');
        tagItem.dataset.rating = effectiveRating;
        tagItem.appendChild(span);
        tagItem.dataset.originalCss = getCleanCssText(tagItem);
      } else {
        tagItem = span;
      }
      span.dataset.originalCss = getCleanCssText(span);

      // Append at the end of all tags (before clear:both or notice, or append to container)
      if (allTagItems.length > 0) {
        const lastTagItem = allTagItems[allTagItems.length - 1];
        lastTagItem.insertAdjacentElement('afterend', tagItem);
      } else {
        const clearDiv = Array.from(container.children).find((c) => {
          if (
            c.tagName === 'DIV' &&
            (c.style.clear === 'both' || c.getAttribute('style')?.includes('clear'))
          )
            return true;
          if (c.id === 'addTagForm') return true;
          return false;
        });
        if (clearDiv) {
          container.insertBefore(tagItem, clearDiv);
        } else {
          container.appendChild(tagItem);
        }
      }

      applyProblemTagStyle(isWrapped ? tagItem : null, span, effectiveRating);
    }
  } else {
    // 缺分只标记为不可见，保留原节点供收起动画及快速反向切换复用。
    clistTags.forEach((span) => {
      const parent = span.parentElement;
      const item = parent !== container && parent.classList.contains('roundbox') ? parent : span;
      item.dataset.cfRatingAbsent = 'true';
    });
  }
  applyProblemTagsVisibility({ animate: false });
  finishTagMotion(container, motion, { collapseToNotice: false });
}

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
        if (typeof rating === 'number') {
          if (appSettings.displayStyle === 'block') {
            ratingCell.style.setProperty('font-size', '0.9em', 'important');
            ratingCell.style.setProperty('padding', '0.2em', 'important');
          }
        }
      }
    });
  });

  // 3. Refresh Problem Page sidebar tags
  updateProblemPageRatingTag(ratingsMap);
}

// 按页面表格和链接结构插入评分列及难度标记。
export function applyRatings(ratingsMap) {
  const clistEnabled = !!(appSettings.clist && appSettings.clist.enabled);
  const clistData = clistEnabled ? getClistProblems() : null;
  const hasOfficial = ratingsMap && Object.keys(ratingsMap).length > 0;
  if (!hasOfficial && !clistData) return;
  const safeRatingsMap = ratingsMap || {};

  // Walk through nodes to replace verdict text with abbreviations

  // 1. Handle Status Tables and Hacks Tables by adding a new Rating column
  const statusTables = document.querySelectorAll(
    'table.status-frame-datatable, div.datatable table:not(.standings):not(.problems)',
  );
  statusTables.forEach((table) => {
    const headerRow = table.querySelector('tr');
    if (!headerRow) return;

    // Find column indexes
    let idColIdx = -1;
    let timeColIdx = -1;
    let whoColIdx = -1;
    let problemColIdx = -1;
    let langColIdx = -1;
    let verdictColIdx = -1;
    let timeConsumedColIdx = -1;
    let memoryConsumedColIdx = -1;
    let isHacks = window.location.href.includes('/hacks');
    let isStatusOrHacks = false;

    const path = window.location.pathname.toLowerCase();
    const isSubmissionsPage = path.includes('/my') || path.includes('/submissions');

    table.classList.add('cf-status-table');
    if (isHacks) table.classList.add('cf-table-hacks');
    else if (isSubmissionsPage) table.classList.add('cf-table-submissions');
    else table.classList.add('cf-table-status');

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
      if (
        timeConsumedColIdx === -1 &&
        idx !== timeColIdx &&
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

    if (!isStatusOrHacks) return; // Skip if it's not a status or hacks table (e.g., contest list)

    let shouldShowRating = false;
    if (isHacks) {
      shouldShowRating = appSettings.show.hacks;
    } else if (isSubmissionsPage) {
      shouldShowRating = appSettings.show.submissions;
    } else {
      shouldShowRating = appSettings.show.status;
    }

    if (!shouldShowRating && !appSettings.timeFormat.enabled && langColIdx === -1) return;

    // Process Header (Rating Column and Time)
    if (!headerRow.hasAttribute('data-cf-rating-processed')) {
      headerRow.setAttribute('data-cf-rating-processed', 'true');

      // 1) # Column - Never wrap, compact width
      if (idColIdx !== -1 && headerRow.cells[idColIdx]) {
        headerRow.cells[idColIdx].classList.add('id-cell');
      }

      // 2) Append timezone to Time column header
      if (timeColIdx !== -1 && headerRow.cells[timeColIdx]) {
        const th = headerRow.cells[timeColIdx];
        th.classList.add('cf-table-time-header');
        let tzStr = 'UTC+3'; // Codeforces default server time (MSK)

        const firstDataRow = table.querySelector('tr:not(:first-child)');
        if (firstDataRow && firstDataRow.cells[timeColIdx]) {
          const tzMatch = firstDataRow.cells[timeColIdx].textContent.match(/UTC[+-]?\d*(:\d+)?/i);
          if (tzMatch) {
            tzStr = tzMatch[0].toUpperCase();
          }
        }
        th.innerHTML = `${th.innerHTML}<br><span class="cf-time-timezone-label" style="font-size: 0.85em; opacity: 0.8;">(${tzStr})</span>`;
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

    // Process data rows
    const dataRows = table.querySelectorAll('tr:not(:first-child)');
    dataRows.forEach((row) => {
      // 1) # Column
      if (idColIdx !== -1 && row.cells[idColIdx]) {
        row.cells[idColIdx].classList.add('id-cell');
      }

      // 2) Time Formatting
      if (timeColIdx !== -1 && row.cells[timeColIdx]) {
        const timeCell = row.cells[timeColIdx];
        if (!timeCell.hasAttribute('data-cf-time-processed')) {
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
    });
    formatStandingsCells();
  });

  // 1.5 Handle Standings tables specifically (adding a whole new row under the header)
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
      newCell.style.padding = '0.3em'; // minimal padding

      const link = cell.querySelector('a[href*="/problem/"]');
      if (link) {
        const probName =
          link.getAttribute('title') || cell.getAttribute('title') || link.textContent;
        const info = getProblemRatingFromHref(link.href, probName);
        applyRatingStyle(newCell, info?.rating);
        if (info && typeof info.rating === 'number') {
          hasRatings = true;
          if (appSettings.displayStyle === 'block') {
            newCell.style.setProperty('font-size', '0.9em', 'important');
            newCell.style.setProperty('padding', '0.2em', 'important');
          }

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

  // 1.8 Handle Problemset & Contest Problems tables specifically (adding a new column to the last column)
  const problemsTables = document.querySelectorAll(
    'table.problems:not([data-cf-rating-problems-processed])',
  );
  problemsTables.forEach((table) => {
    const isProblemset = window.location.pathname.toLowerCase().includes('/problemset');
    const shouldShowRating = isProblemset
      ? appSettings.show.problemset
      : appSettings.show.contestProblems;

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

      // Fix the CF accepted/rejected status styling
      if (
        row.classList.contains('accepted-problem') ||
        row.classList.contains('rejected-problem')
      ) {
        Array.from(row.cells).forEach((cell) => {
          if (cell === td) return;
          if (row.classList.contains('rejected-problem')) {
            cell.style.setProperty('background-color', '#ffdddd', 'important');
          }
        });
      }
    });
  });

  // 3. Handle actual Problem Page tags (sidebar tags)
  updateProblemPageRatingTag(safeRatingsMap);
}
