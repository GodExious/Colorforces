import { applyRatings } from '../ratings/enhance.js';
import { formatStandingsCells } from '../user/avatars/teams.js';
import { applyUserAvatars } from '../user/avatars/enhance.js';
import { applyGroupTags } from '../user/groups/tags.js';
import { applyProblemTagsVisibility } from '../appearance/problem-tags/visibility.js';
import { wrapVirtualParticipationTime, applyTimeFormatting } from '../appearance/time/format.js';
import {
  walkAndReplaceVerdict,
  refreshLooseVerdicts,
  refreshVerdicts,
  VERDICT_SELECTOR,
  NATIVE_VERDICT_SELECTOR,
} from '../appearance/verdicts/index.js';
import { PLUGIN_UI_SELECTOR } from './plugin-ui.js';

// 阻止页面增强过程中递归处理自身 DOM 变更。
export let isMutationProcessing = false;

// 合并短时间内的页面变更。
export let observerDebounceTimer = null;
let pageObserver;
let processPageMutations;
let enhancePage;

// 立刻把页面增强（难度分、队伍排版、头像、时间格式等）补到新出现的内容上，不等防抖。
// 给「一次换进来很多行、马上要量位置」的地方用，比如榜单同步刷新：等防抖的话，新行先按没有头像的高度排，
// 过一会儿头像补上，整张表会突然高出一截。
export function enhancePageNow() {
  enhancePage?.();
}

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

// 无需参与站点增强观察的插件浮层与侧栏：插件自己的界面，加上插件插入的头像和原站侧栏。
export const PLUGIN_IGNORE_SELECTOR =
  PLUGIN_UI_SELECTOR +
  ', .cf-avatar-line-wrapper, .cf-avatar-container, .cf-user-avatar, .roundbox.sidebox, #sidebar';

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

// 一批改动超过这么多条，判题文字就不逐条去找了，见 processPageMutations。
const BULK_MUTATIONS = 200;
// 这一条改动有没有加进来元素（文字节点不算）。
function addsElement(mutation) {
  for (const node of mutation.addedNodes) if (node.nodeType === 1) return true;
  return false;
}

// 监听动态内容并防抖刷新增强，跳过插件自己的节点。
export function setupObserver(ratingsMap) {
  enhancePage = () => {
    if (isMutationProcessing) return;
    isMutationProcessing = true;
    try {
      applyRatings(ratingsMap);
      formatStandingsCells();
      applyUserAvatars();
      applyGroupTags();
      applyProblemTagsVisibility();
      wrapVirtualParticipationTime();
      applyTimeFormatting();
    } finally {
      setTimeout(() => {
        isMutationProcessing = false;
      }, 200);
    }
  };
  processPageMutations = (mutations) => {
    // 判题文字可能在全页增强锁期间变化，必须独立处理而不能直接忽略。
    if (mutations.length > BULK_MUTATIONS) {
      // 一次来了很多条（别的脚本翻译整页、榜单整张换掉）：逐条从改动的地方往上找判题文字，要找上万遍，
      // 而其中绝大多数和判题文字无关。这时直接把整页的判题文字处理一遍：只要找一次，范围只多不少，
      // 处理过的再处理一遍也不会变。
      refreshVerdicts();
    } else {
      const verdictCells = new Set();
      // 状态表格和侧栏之外的判题文字（提交详情页、源码弹窗的标题等）。
      const looseVerdicts = new Set();
      for (const mutation of mutations) {
        const target =
          mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
        if (!target || target.closest('.cf-menu-theme, .cf-verdict-outgoing')) continue;
        // 侧栏其余内容仍忽略，但提交历史的判题变化不能被一起排除。
        const cell = target.closest(VERDICT_SELECTOR);
        if (cell) verdictCells.add(cell);
        else {
          const native = target.closest(NATIVE_VERDICT_SELECTOR);
          if (native) looseVerdicts.add(native);
        }
        // 原站也可能替换整个提交历史单元格，而不是修改已有判题文字。
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1 || node.closest('.cf-verdict-text')) continue;
          if (node.matches(VERDICT_SELECTOR)) verdictCells.add(node);
          node.querySelectorAll(VERDICT_SELECTOR).forEach((cell) => verdictCells.add(cell));
          looseVerdicts.add(node);
        }
      }
      for (const cell of verdictCells) walkAndReplaceVerdict(cell);
      for (const root of looseVerdicts) refreshLooseVerdicts(root);
    }
    if (isMutationProcessing) return;
    let shouldApply = false;
    for (const mutation of mutations) {
      // 只有加进来的元素才会触发整页增强：没有的先跳过，不为它往上找祖先。
      if (!addsElement(mutation)) continue;
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
          applyGroupTags();
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
