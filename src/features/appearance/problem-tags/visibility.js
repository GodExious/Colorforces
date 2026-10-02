import { appSettings } from '../../../settings.js';
import {
  checkAndFetchUserSolved,
  isCurrentPageProblemAccepted,
  getUserSolvedProblems,
} from '../../general/solved.js';
import { t } from '../../../i18n/index.js';
import { extractProblemKey } from '../../../utils/problem.js';
import { beginTagMotion, finishTagMotion } from './motion.js';

// 按隐藏设置和通过状态控制算法标签、难度标签及占位提示。
export function applyProblemTagsVisibility({ animate = true } = {}) {
  const isHide = !!appSettings.hideTags;
  const hideRating = !!appSettings.hideRatingTag;
  const notHideAc = !!appSettings.notHideAcTags;

  if (notHideAc) {
    checkAndFetchUserSolved();
  }

  // ---------------------------------------------------------
  // 1. Sidebar Problem Tags Container (Problem Details Page)
  // ---------------------------------------------------------
  let container = null;
  let tagSidebox = Array.from(
    document.querySelectorAll('.roundbox.sidebox, #sidebar .roundbox'),
  ).find((box) => {
    if (box.closest('.cf-settings-modal')) return false;
    const caption = box.querySelector('.caption');
    return caption && /tags|标签|теги/i.test(caption.textContent);
  });

  if (!tagSidebox) {
    const firstTag = document.querySelector('span.tag-box');
    if (
      firstTag &&
      !firstTag.closest('.cf-settings-modal') &&
      !firstTag.closest('table.problems')
    ) {
      tagSidebox = firstTag.closest('.roundbox.sidebox, #sidebar .roundbox');
    }
  }

  if (tagSidebox) {
    container =
      tagSidebox.querySelector('div[style*="padding"]') ||
      tagSidebox.querySelector('.caption')?.nextElementSibling ||
      tagSidebox;
  } else {
    const allSpans = Array.from(document.querySelectorAll('span.tag-box')).filter(
      (t) => !t.closest('.cf-settings-modal') && !t.closest('table.problems'),
    );
    if (allSpans.length > 0) {
      let p = allSpans[0].parentElement;
      while (p && p !== document.body) {
        if (allSpans.every((span) => p.contains(span))) {
          container = p;
          break;
        }
        p = p.parentElement;
      }
    }
  }

  if (container) {
    const motion = animate ? beginTagMotion(container) : null;
    const isAc = notHideAc && isCurrentPageProblemAccepted();

    if (isHide && !isAc) {
      const tagSpans = Array.from(container.querySelectorAll('span.tag-box')).filter(
        (t) => !t.closest('.cf-tags-hidden-notice') && !t.closest('[data-cf-rating-absent="true"]'),
      );
      if (tagSpans.length > 0 || container.querySelector('.cf-tags-hidden-notice')) {
        let isWrapped = false;
        let sampleFontSize = '1.2rem';

        tagSpans.forEach((span) => {
          const text = span.textContent.trim();
          const title = span.getAttribute('title') || '';
          const isScore =
            /^\*\s*\d+/.test(text) ||
            !!span.dataset.rating ||
            span.getAttribute('data-cf-clist-tag') === 'true' ||
            span.getAttribute('data-cf-rating-tag') === 'true' ||
            /difficulty|难度/i.test(title);

          if (span.style.fontSize) sampleFontSize = span.style.fontSize;

          const item =
            span.parentElement &&
            span.parentElement !== container &&
            span.parentElement.classList.contains('roundbox')
              ? span.parentElement
              : span;

          if (item.tagName === 'DIV') isWrapped = true;

          const shouldHide = hideRating ? true : !isScore;
          if (shouldHide) {
            item.style.setProperty('display', 'none', 'important');
            item.setAttribute('data-cf-tag-hidden', 'true');
            if (item !== span) {
              span.style.setProperty('display', 'none', 'important');
              span.setAttribute('data-cf-tag-hidden', 'true');
            }
          } else {
            item.style.removeProperty('display');
            item.removeAttribute('data-cf-tag-hidden');
            if (item !== span) {
              span.style.removeProperty('display');
              span.removeAttribute('data-cf-tag-hidden');
            }
          }
        });

        // Add ONE hidden tag as the first item if not already present, or ensure it's visible
        const existingNotice = container.querySelector('.cf-tags-hidden-notice');
        if (existingNotice) {
          existingNotice.style.removeProperty('display');
          existingNotice.removeAttribute('data-cf-tag-hidden');
        } else {
          let hiddenItem;
          if (isWrapped) {
            hiddenItem = document.createElement('div');
            hiddenItem.className =
              'roundbox borderTopRound borderBottomRound cf-tags-hidden-notice';
            hiddenItem.style.cssText = 'margin:2px; padding:0 3px 2px 3px; float:left;';
            const hiddenSpan = document.createElement('span');
            hiddenSpan.className = 'tag-box cf-tags-hidden-notice';
            hiddenSpan.style.fontSize = sampleFontSize;
            hiddenSpan.textContent = 'tags hidden';
            hiddenSpan.title = 'Tags hidden';
            hiddenItem.appendChild(hiddenSpan);
          } else {
            hiddenItem = document.createElement('span');
            hiddenItem.className = 'tag-box cf-tags-hidden-notice';
            hiddenItem.style.fontSize = sampleFontSize;
            hiddenItem.textContent = 'tags hidden';
            hiddenItem.title = 'Tags hidden';
          }
          container.insertBefore(hiddenItem, container.firstElementChild);
        }
      }
    } else {
      // Restore all tags and remove notice
      container.querySelectorAll('.cf-tags-hidden-notice').forEach((n) => n.remove());
      container.querySelectorAll('[data-cf-tag-hidden="true"]').forEach((item) => {
        item.style.removeProperty('display');
        item.removeAttribute('data-cf-tag-hidden');
      });
    }
    if (motion) finishTagMotion(container, motion);
  }

  // ---------------------------------------------------------
  // 2. Problemset & Contest Tables (table.problems tr)
  // ---------------------------------------------------------
  const tableRows = document.querySelectorAll('table.problems tr');
  if (tableRows.length > 0) {
    const solvedSet = notHideAc ? getUserSolvedProblems() : null;

    tableRows.forEach((row) => {
      const isRowAc = row.classList.contains('accepted-problem');
      let isAc = isRowAc;

      if (isRowAc) {
        const probLink = row.querySelector('a[href*="/problem/"]');
        if (probLink) {
          const k = extractProblemKey(probLink.href);
          if (k && solvedSet) solvedSet.add(k);
        }
      } else if (notHideAc && solvedSet) {
        const probLink = row.querySelector('a[href*="/problem/"]');
        if (probLink) {
          const k = extractProblemKey(probLink.href);
          if (k && solvedSet.has(k)) {
            isAc = true;
          }
        }
      }

      const tagsInRow = row.querySelectorAll('div[style*="float: left"] a.notice, span.tag-box');
      if (tagsInRow.length === 0) return;

      if (isHide && !(notHideAc && isAc)) {
        tagsInRow.forEach((tag) => {
          const text = tag.textContent.trim();
          const title = tag.getAttribute('title') || '';
          const isScore =
            /^\*\s*\d+/.test(text) ||
            !!tag.dataset.rating ||
            tag.getAttribute('data-cf-clist-tag') === 'true' ||
            tag.getAttribute('data-cf-rating-tag') === 'true' ||
            /difficulty|难度/i.test(title);
          const shouldHide = hideRating ? true : !isScore;
          if (shouldHide) {
            tag.style.setProperty('display', 'none', 'important');
            tag.setAttribute('data-cf-tag-hidden', 'true');
          } else {
            tag.style.removeProperty('display');
            tag.removeAttribute('data-cf-tag-hidden');
          }
        });
      } else {
        tagsInRow.forEach((tag) => {
          tag.style.removeProperty('display');
          tag.removeAttribute('data-cf-tag-hidden');
        });
      }
    });
  }
}
