import { fetchUserInfo } from '../../../api/codeforces.js';
import { appSettings } from '../../../settings.js';
import { appStorage } from '../../../storage/gm.js';
import { AVATAR_CACHE_KEY } from '../../../storage/keys.js';
import { CACHE_EXPIRY } from '../../../config/cache-policy.js';
import { normalizeAvatarUrl, DEFAULT_AVATAR_URL } from './data.js';
import { syncSecondLevelMenuLava } from '../../page/navigation.js';
import { isTeamCell } from './structure.js';

// 收集页面用户链接，按缓存及官方信息补齐头像。
export async function applyUserAvatars() {
  if (!appSettings.user.avatar.enabled) return;

  // 兼容相对路径与绝对路径 (/profile/xxx 与 https://codeforces.com/profile/xxx)
  const userLinks = document.querySelectorAll(
    'a[href*="/profile/"]:not([data-cf-avatar-processed])',
  );
  const handlesToFetch = new Set();
  const handleToElements = {};

  userLinks.forEach((link) => {
    // Skip if it already has an img (like titlePhoto or similar icon)
    if (link.querySelector('img')) return;

    // Skip if it's inside a native CF avatar container or profile main-info
    if (link.closest('.avatar, .main-info')) return;

    // Skip if it's a comment author (comments already have native CF avatar box on the left)
    // Mentions inside the text body (.ttypography) and topic authors should receive avatars.
    if (link.closest('.comment') && !link.closest('.ttypography')) return;

    const href = link.getAttribute('href');
    if (!href) return;
    const match = href.match(/\/profile\/([^/?#]+)(?:[?#]|$)/i);
    if (!match) return;

    const handle = decodeURIComponent(match[1]);
    if (link.textContent.trim().toLowerCase() === handle.toLowerCase()) {
      link.setAttribute('data-cf-avatar-processed', 'pending');
      handlesToFetch.add(handle);
      const key = handle.toLowerCase();
      if (!handleToElements[key]) handleToElements[key] = [];
      handleToElements[key].push(link);
    }
  });

  if (handlesToFetch.size === 0) return;

  let avatarCache = appStorage.getJSON(AVATAR_CACHE_KEY, {}) || {};
  const cachedByHandle = new Map(
    Object.entries(avatarCache).map(([handle, value]) => [handle.toLowerCase(), value]),
  );

  const now = Date.now();
  let missingHandles = [];

  for (const handle of handlesToFetch) {
    const cachedData = cachedByHandle.get(handle.toLowerCase());
    if (cachedData && now - cachedData.time < CACHE_EXPIRY) {
      injectAvatar(
        handleToElements[handle.toLowerCase()],
        cachedData.url,
        cachedData.fallbackUrl,
        handle,
      );
    } else {
      missingHandles.push(handle);
    }
  }

  if (missingHandles.length > 0) {
    try {
      while (missingHandles.length > 0) {
        const response = await fetchUserInfo(missingHandles);
        const data = await response.json();

        if (data.status === 'OK') {
          for (const user of data.result) {
            const handle = user.handle;
            const avatarUrl = normalizeAvatarUrl(user.avatar);
            const titlePhotoUrl = normalizeAvatarUrl(user.titlePhoto);
            avatarCache[handle] = { url: avatarUrl, fallbackUrl: titlePhotoUrl, time: now };
            injectAvatar(
              handleToElements[handle.toLowerCase()] || [],
              avatarUrl,
              titlePhotoUrl,
              handle,
            );
          }
          appStorage.setJSON(AVATAR_CACHE_KEY, avatarCache);
          break;
        } else if (data.status === 'FAILED' && data.comment) {
          const match = data.comment.match(/User with handle (.*?) not found/i);
          if (match) {
            const missing = match[1];
            missingHandles = missingHandles.filter(
              (h) => h.toLowerCase() !== missing.toLowerCase(),
            );
            avatarCache[missing] = { url: DEFAULT_AVATAR_URL, fallbackUrl: '', time: now };
            injectAvatar(
              handleToElements[missing.toLowerCase()] || [],
              DEFAULT_AVATAR_URL,
              '',
              missing,
            );
          } else {
            break;
          }
        } else {
          break;
        }
      }
    } catch (e) {
      console.error('Codeforces Rating Helper: Failed to fetch user avatars', e);
    }
  }
  // 失败不伪装成已完成；仅在下次手动刷新头像设置时重试，避免观察器请求风暴。
  for (const elements of Object.values(handleToElements))
    for (const element of elements)
      if (element.dataset.cfAvatarProcessed === 'pending')
        element.dataset.cfAvatarProcessed = 'failed';
}

// 在用户链接旁插入头像，处理默认图与加载回退。
export function injectAvatar(elements, url, fallbackUrl, handle) {
  url = normalizeAvatarUrl(url) || DEFAULT_AVATAR_URL;
  fallbackUrl = normalizeAvatarUrl(fallbackUrl);

  elements.forEach((el) => {
    if (
      !el.isConnected ||
      el.closest('.cf-avatar-line-wrapper') ||
      el.querySelector('.cf-avatar-slot')
    )
      return;
    const td = el.closest('td, th');
    // 缓存只记录原站结构，不能把生成的头像链接保存为队伍成员。
    if (td && !td.hasAttribute('data-original-html'))
      td.setAttribute('data-original-html', td.innerHTML);
    const img = document.createElement('img');
    img.src = url;
    img.className = 'cf-user-avatar-container cf-user-avatar';
    const slot = document.createElement('span');
    slot.className = 'cf-avatar-slot cf-avatar-loading';
    slot.appendChild(img);

    // Auto-heal on 503 / 404 / broken avatar load errors
    img.onerror = function () {
      if (fallbackUrl && this.src !== fallbackUrl) {
        this.src = fallbackUrl;
      } else if (this.src !== DEFAULT_AVATAR_URL) {
        this.src = DEFAULT_AVATAR_URL;
      } else {
        slot.classList.add('cf-avatar-loading');
      }
    };

    const isTableLayout =
      td &&
      el.closest(
        'table.standings, table.status-frame-datatable, div.datatable table, table.rtable',
      ) &&
      !el.closest('.ttypography');

    if (isTableLayout) {
      td.style.setProperty('text-align', 'left', 'important');
      td.style.setProperty('vertical-align', 'middle', 'important');

      const anchor = document.createElement('a');
      anchor.href = el.href;
      anchor.title = el.textContent.trim();
      anchor.className = 'cf-avatar-container';
      anchor.appendChild(slot);

      const wrapper = document.createElement('span');
      wrapper.className = 'cf-avatar-line-wrapper';

      let currentStart = el;
      let nodesToWrap = [el];

      while (currentStart.previousSibling) {
        let prev = currentStart.previousSibling;
        if (prev.tagName === 'BR') break;
        if (prev.nodeType === Node.ELEMENT_NODE && prev.hasAttribute('data-cf-prediction')) break;

        if (prev.nodeType === Node.TEXT_NODE) {
          if (/^[\s*]*$/.test(prev.textContent)) {
            nodesToWrap.unshift(prev);
            currentStart = prev;
          } else {
            break;
          }
        } else if (prev.nodeType === Node.ELEMENT_NODE) {
          const isInlineAndEmpty =
            ['SPAN', 'SMALL', 'SUP', 'SUB', 'I', 'B', 'EM', 'STRONG'].includes(prev.tagName) &&
            /^[\s*]*$/.test(prev.textContent);
          const isFlagOrImg = prev.tagName === 'IMG' || prev.classList.contains('standings-flag');

          if (isInlineAndEmpty || isFlagOrImg) {
            nodesToWrap.unshift(prev);
            currentStart = prev;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      // Also collect trailing elements attached to the user (e.g. <sup title="Virtual participant">, badges, or trailing marks)
      let currentEnd = el;
      while (currentEnd.nextSibling) {
        let next = currentEnd.nextSibling;
        if (next.tagName === 'BR') break;
        // 评级标签与分析控件属于整个单元格，不能被当作昵称附属标记收进头像行。
        if (next.nodeType === Node.ELEMENT_NODE && next.hasAttribute('data-cf-prediction')) break;

        if (next.nodeType === Node.TEXT_NODE) {
          if (/^[\s*]*$/.test(next.textContent)) {
            nodesToWrap.push(next);
            currentEnd = next;
          } else {
            break;
          }
        } else if (next.nodeType === Node.ELEMENT_NODE) {
          const isSupOrSymbol = ['SUP', 'SUB', 'SPAN', 'I', 'SMALL'].includes(next.tagName);
          if (isSupOrSymbol) {
            nodesToWrap.push(next);
            currentEnd = next;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      el.parentNode.insertBefore(wrapper, currentStart);
      wrapper.appendChild(anchor);
      nodesToWrap.forEach((node) => wrapper.appendChild(node));

      if (td.classList.contains('status-party-cell') || td.closest('.status-party-cell')) {
        if (isTeamCell(td)) {
          el.style.setProperty('max-width', '180px', 'important');
        }
      }
    } else {
      el.classList.add('cf-avatar-inline-user');
      el.style.setProperty('white-space', 'nowrap', 'important');
      el.insertBefore(slot, el.firstChild);

      if (el.closest('.right-meta')) {
        const prevA = el.previousElementSibling;
        if (prevA && prevA.matches('a') && prevA.querySelector('img[src*="user_16x16"]')) {
          prevA.classList.add('cf-author-icon-hidden');
        }
      }

      if (el.closest('.second-level-menu-list')) {
        syncSecondLevelMenuLava();
        img.addEventListener('load', syncSecondLevelMenuLava);
        setTimeout(syncSecondLevelMenuLava, 150);
      }
    }
    // 图片就绪后展开槽位，姓名始终留在原节点内并被自然推向右侧。
    const ready = () => slot.classList.remove('cf-avatar-loading');
    el.dataset.cfAvatarProcessed = 'true';
    if (img.complete && img.naturalWidth) ready();
    else img.addEventListener('load', ready, { once: true });
  });
}
