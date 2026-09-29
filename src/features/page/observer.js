import { applyRatings } from '../ratings/enhance.js';
import { formatStandingsCells } from '../user/avatars/standings.js';
import { applyUserAvatars } from '../user/avatars/enhance.js';
import { applyProblemTagsVisibility } from '../general/problem-tags.js';
import { wrapVirtualParticipationTime, applyTimeFormatting } from '../appearance/time.js';
import { walkAndReplaceVerdict, VERDICT_SELECTOR } from '../appearance/verdicts.js';

// 阻止页面增强过程中递归处理自身 DOM 变更。
export let isMutationProcessing = false;

// 合并短时间内的页面变更。
export let observerDebounceTimer = null;
let pageObserver;
let processPageMutations;

// 设置同步写入不再触发二次全页增强；原站已排队的更新仍单独处理。
export function updateWithoutObservation(update) {
  const pending = pageObserver?.takeRecords();
  try {
    return update();
  } finally {
    pageObserver?.takeRecords();
    if (pending?.length) queueMicrotask(() => processPageMutations(pending));
  }
}

// 无需参与站点增强观察的插件浮层与侧栏。
export const PLUGIN_IGNORE_SELECTOR =
  '.cf-menu-theme, .cf-avatar-line-wrapper, .cf-avatar-container, .cf-user-avatar, .cf-settings-modal, .cf-clist-modal-overlay, .cf-storage-json-modal, .cf-confirm-pop-overlay, .cf-guide-modal-overlay, .cf-toast-notification, .cf-floating-tooltip, #cf-ratings-settings-btn, .pcr-app, .roundbox.sidebox, #sidebar';

// 判断变更节点是否属于应忽略的插件区域。
export function isPluginIgnoredElement(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.id && el.id.startsWith('cf-')) return true;
  if (el.className && typeof el.className === 'string') {
    if (
      el.className.includes('cf-json-') ||
      el.className.includes('cf-storage-') ||
      el.className.includes('cf-modal-') ||
      el.className.includes('cf-tab-')
    )
      return true;
  }
  return !!el.closest?.(
    PLUGIN_IGNORE_SELECTOR + ', .cf-time-slot, .cf-rating-value, .cf-rating-number',
  );
}

// 监听动态内容并防抖刷新增强，跳过插件自己的节点。
export function setupObserver(ratingsMap) {
  processPageMutations = (mutations) => {
    // 判题文字可能在全页增强锁期间变化，必须独立处理而不能直接忽略。
    const verdictCells = new Set();
    for (const mutation of mutations) {
      const target =
        mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
      if (!target || target.closest('.cf-menu-theme, .cf-verdict-outgoing')) continue;
      // 侧栏其余内容仍忽略，但提交历史的判题变化不能被一起排除。
      const cell = target.closest(VERDICT_SELECTOR);
      if (cell) verdictCells.add(cell);
      // 原站也可能替换整个提交历史单元格，而不是修改已有判题文字。
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1 || node.closest('.cf-verdict-text')) continue;
        if (node.matches(VERDICT_SELECTOR)) verdictCells.add(node);
        node.querySelectorAll(VERDICT_SELECTOR).forEach((cell) => verdictCells.add(cell));
      }
    }
    for (const cell of verdictCells) walkAndReplaceVerdict(cell);
    if (isMutationProcessing) return;
    let shouldApply = false;
    for (const mutation of mutations) {
      if (mutation.target && isPluginIgnoredElement(mutation.target)) {
        continue;
      }
      const target =
        mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
      if (target?.closest('[data-cf-verdict-processed], .status-verdict-cell')) continue;
      for (const node of mutation.addedNodes) {
        if (
          node.nodeType === 1 &&
          !isPluginIgnoredElement(node) &&
          !node.classList?.contains('cf-tags-hidden-notice')
        ) {
          shouldApply = true;
          break;
        }
      }
      if (shouldApply) break;
    }
    if (shouldApply) {
      clearTimeout(observerDebounceTimer);
      observerDebounceTimer = setTimeout(() => {
        if (isMutationProcessing) return;
        isMutationProcessing = true;
        try {
          applyRatings(ratingsMap);
          formatStandingsCells();
          applyUserAvatars();
          applyProblemTagsVisibility();
          wrapVirtualParticipationTime();
          setTimeout(applyTimeFormatting, 300);
        } finally {
          setTimeout(() => {
            isMutationProcessing = false;
          }, 200);
        }
      }, 100);
    }
  };

  pageObserver = new MutationObserver(processPageMutations);
  pageObserver.observe(document.body, { childList: true, characterData: true, subtree: true });
}
