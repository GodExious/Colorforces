import { appSettings } from '../../../settings.js';
import { getRatingTagStyle, getRatingBgColor, getRatingBorderColor } from '../rules.js';
import { isCurrentPageProblemAccepted } from '../../general/solved.js';
import { applyProblemTagsVisibility } from '../../appearance/problem-tags/visibility.js';
import { beginTagMotion, finishTagMotion } from '../../appearance/problem-tags/motion.js';
import { updateRatingValue } from '../cells/value-motion.js';
import { getProblemRating, getProblemRatingFromHref } from '../lookup.js';

// 取出可恢复的原始样式，过滤增强产生的样式项。
function getCleanCssText(el) {
  if (!el || !el.style) return '';
  return (el.style.cssText || '')
    .replace(/display\s*:\s*none\s*!important\s*;?/gi, '')
    .replace(/display\s*:\s*none\s*;?/gi, '')
    .trim();
}

// 按主题和评分为原生题目标签应用样式。
function applyProblemTagStyle(box, tag, rating) {
  const isBoxHidden =
    box && (box.getAttribute('data-cf-tag-hidden') === 'true' || box.style.display === 'none');
  const isTagHidden =
    tag && (tag.getAttribute('data-cf-tag-hidden') === 'true' || tag.style.display === 'none');
  const shouldHideScoreTag =
    !!appSettings.appearance.tags.hide &&
    !!appSettings.appearance.tags.hideRating &&
    !(appSettings.appearance.tags.keepSolved && isCurrentPageProblemAccepted());

  if (!appSettings.ratings.show.problemTags || !appSettings.ratings.enabled) {
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
  if (appSettings.ratings.style === 'tag') {
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

// 更新或移除链接旁的评分标记。
function updateSpanRatingText(span, newRating) {
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

  const clistEnabled = !!(appSettings.ratings.clist && appSettings.ratings.clist.enabled);
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
