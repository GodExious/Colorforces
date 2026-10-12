import { appSettings } from '../../../settings.js';
import { applyUserAvatars } from './enhance.js';
import { captureTeamLayout, animateTeamLayout } from './layout-motion.js';
import { getProfileLinks, isTeamCell } from './structure.js';
import { hiddenMembers, isMoreMark, parseGhostTeam } from './team-members.js';

// 把原站折叠成「...」的成员补成主页链接，接在已有的成员后面；「...」本身去掉。返回补出来的链接。
// 提示有可能已经被插件的提示功能接管（鼠标正停在上面时原来的 title 会挪到 data-cf-native-tooltip 里），两处都看。
function revealHiddenMembers(cell) {
  const mark = [...cell.querySelectorAll('span')].find(
    (span) =>
      isMoreMark(span.textContent) &&
      (span.hasAttribute('title') || span.hasAttribute('data-cf-native-tooltip')),
  );
  if (!mark) return [];
  const names = hiddenMembers(
    mark.getAttribute('title') ?? mark.getAttribute('data-cf-native-tooltip'),
  );
  if (!names.length) return [];
  mark.remove();
  return names.map((name) => {
    const link = document.createElement('a');
    link.href = '/profile/' + encodeURIComponent(name);
    link.textContent = name;
    link.className = 'cf-team-extra-member';
    link.dataset.cfTeamExtra = '';
    return link;
  });
}

/*
 * 把格子恢复成原站的样子，头像一个不留，名字上「头像处理过了」的记号也去掉，之后头像功能会重新补。
 * 存下的原始内容不一定干净：头像功能是先给名字打上「处理中」的记号、再存原始内容的，
 * 照原样恢复的话名字带着记号回来，头像功能以为处理过了，头像就再也不出现。
 */
function restoreOriginal(cell) {
  if (cell.hasAttribute('data-original-html'))
    cell.innerHTML = cell.getAttribute('data-original-html');
  cell.querySelectorAll('.cf-avatar-container').forEach((el) => el.remove());
  cell
    .querySelectorAll('.cf-avatar-line-wrapper')
    .forEach((wrap) => wrap.replaceWith(...wrap.childNodes));
  cell
    .querySelectorAll('a[href*="/profile/"]')
    .forEach((link) => link.removeAttribute('data-cf-avatar-processed'));
}

// 恢复队伍单元格的原始结构。只有排过版的才需要恢复：没排过的本来就是原站的样子，里面可能已经有头像，不动它。
// 返回有没有恢复（恢复了的话头像被清掉了，要重新补）。
export function unformatTeamCell(cell) {
  const restored = cell.classList.contains('cf-team-formatted');
  if (restored) restoreOriginal(cell);
  cell.classList.remove('cf-team-formatted');
  cell.classList.add('cf-team-unformatted');
  cell.style.removeProperty('padding-top');
  cell.style.removeProperty('padding-bottom');
  cell.style.setProperty('word-break', 'break-word', 'important');
  return restored;
}

// 头像开启时整理榜单和提交记录中的队伍信息。
export function formatStandingsCells() {
  // 单用户姓名与国旗始终保持一行，不依赖头像是否开启；队伍仍可自然换行。
  document.querySelectorAll('table.standings td.contestant-cell').forEach((cell) => {
    cell.classList.toggle(
      'cf-single-user-cell',
      !isTeamCell(cell) && getProfileLinks(cell).length === 1,
    );
  });
  if (!appSettings.user.avatar.enabled) return;
  const formatTeams = appSettings.user.formatTeams !== false;
  // 这一趟里有没有把哪个格子的头像清掉：有的话最后让头像功能重新补一遍。
  let reinject = false;
  const cells = document.querySelectorAll(`
        table.standings .contestant-cell:not(.cf-avatar-processed-cell),
        .status-party-cell:not(.cf-avatar-processed-cell)
    `);
  cells.forEach((cell) => {
    cell.classList.add('cf-avatar-processed-cell');

    if (!cell.hasAttribute('data-original-html')) {
      cell.setAttribute('data-original-html', cell.innerHTML);
    }

    const ghostImg = cell.querySelector('img[src*="ghost.png"]');
    if (ghostImg) {
      if (!formatTeams) {
        if (unformatTeamCell(cell)) reinject = true;
        return;
      }
      const span = cell.querySelector('span[title="Ghost participant"]');
      if (span) {
        cell.classList.remove('cf-team-unformatted');
        cell.classList.add('cf-team-formatted');
        const { school, team, members } = parseGhostTeam(span.textContent);

        cell.innerHTML = '';

        const size = appSettings.user.avatar.size || 1.6;
        ghostImg.style.cssText = `width: ${size}em; height: ${size}em; vertical-align: middle; margin-right: 4px; display: inline-block; object-fit: cover;`;

        const teamHeader = document.createElement('div');
        teamHeader.className = 'cf-team-header';
        teamHeader.style.cssText = 'margin-bottom: 6px; line-height: 1.4;';

        if (school) {
          const schoolLine = document.createElement('div');
          schoolLine.style.cssText =
            'word-break: break-word; margin-bottom: 2px; display: inline-block;';
          schoolLine.appendChild(ghostImg);
          const schoolSpan = document.createElement('span');
          schoolSpan.style.cssText =
            'font-weight: bold; color: #777; margin-left: 4px; vertical-align: middle;';
          schoolSpan.textContent = school;
          schoolLine.appendChild(schoolSpan);
          teamHeader.appendChild(schoolLine);
        } else {
          const ghostLine = document.createElement('div');
          ghostLine.style.cssText =
            'word-break: break-word; margin-bottom: 2px; display: inline-block;';
          ghostLine.appendChild(ghostImg);
          teamHeader.appendChild(ghostLine);
        }

        if (team) {
          const teamLine = document.createElement('div');
          teamLine.style.cssText =
            'word-break: break-word; font-weight: bold; margin-bottom: 8px; margin-left: 2px; font-size: 13px;';
          teamLine.textContent = team;
          teamHeader.appendChild(teamLine);
        }

        cell.appendChild(teamHeader);

        if (members.length) {
          const memberNames = members;
          const membersContainer = document.createElement('div');
          membersContainer.className = 'cf-team-members';
          membersContainer.style.cssText =
            'display: flex; flex-direction: column; gap: 4px; margin-left: 4px;';
          memberNames.forEach((name) => {
            const memberLine = document.createElement('div');
            memberLine.className = 'cf-member-line';
            memberLine.style.cssText =
              'white-space: nowrap; color: #888; font-size: 11px; display: flex; align-items: center;';
            memberLine.textContent = name;
            membersContainer.appendChild(memberLine);
          });
          cell.appendChild(membersContainer);
        }
      }
      return;
    }

    let userLinks = getProfileLinks(cell);
    if (userLinks.length > 1 || cell.querySelector('a[href*="/team/"]')) {
      if (!formatTeams) {
        if (unformatTeamCell(cell)) reinject = true;
        return;
      }
      /*
       * 头像可能比排版先到：提交记录页的选手格要等评级功能认出来（加上类名）才轮到这里，那时头像早就插好了。
       * 头像是连同名字包在一起的，直接排版只会把名字挪走、头像留在队名旁边。先恢复成原站的样子再排，
       * 头像随后重新补到每个成员那一行。
       */
      if (cell.querySelector('.cf-avatar-line-wrapper, .cf-avatar-container')) {
        restoreOriginal(cell);
        userLinks = getProfileLinks(cell);
        reinject = true;
      }
      cell.classList.remove('cf-team-unformatted');
      cell.classList.add('cf-team-formatted');

      const membersContainer = document.createElement('div');
      membersContainer.className = 'cf-team-members';
      membersContainer.style.cssText =
        'display: flex; flex-direction: column; gap: 4px; margin-left: 4px;';

      [...userLinks, ...revealHiddenMembers(cell)].forEach((link) => {
        const memberLine = document.createElement('div');
        memberLine.className = 'cf-member-line';
        memberLine.style.cssText =
          'white-space: nowrap; display: flex; align-items: center; font-size: 11px;';
        memberLine.appendChild(link);
        membersContainer.appendChild(memberLine);
      });

      const removePunct = (parentNode) => {
        Array.from(parentNode.childNodes).forEach((child) => {
          if (child.nodeType === Node.TEXT_NODE) {
            child.textContent = child.textContent.replace(/^[\s,:]+|[\s,:]+$/g, '');
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            removePunct(child);
          }
        });
      };
      removePunct(cell);

      const teamHeader = document.createElement('div');
      teamHeader.className = 'cf-team-header';
      teamHeader.style.cssText =
        'word-break: break-word; margin-bottom: 8px; font-size: 13px; font-weight: bold; line-height: 1.4;';

      while (cell.firstChild) {
        teamHeader.appendChild(cell.firstChild);
      }

      const flag = teamHeader.querySelector('.standings-flag');
      if (flag) {
        flag.style.margin = '0 4px 0 0';
        flag.style.verticalAlign = 'middle';
      }

      Array.from(teamHeader.querySelectorAll('span, a')).forEach((el) => {
        if (el.style.fontSize) {
          el.style.fontSize = '';
        }
      });

      cell.appendChild(teamHeader);
      cell.appendChild(membersContainer);
      return;
    }
  });
  if (reinject) applyUserAvatars();
}

// 设置变化后刷新头像及依赖头像的榜单格式。
export function refreshUserAvatarsAndStandings() {
  document
    .querySelectorAll('a[data-cf-avatar-processed=failed]')
    .forEach((link) => link.removeAttribute('data-cf-avatar-processed'));
  const snapshots = [];
  const cells = document.querySelectorAll('table.standings .contestant-cell, .status-party-cell');
  cells.forEach((cell) => {
    // 普通用户保留头像和姓名节点，开关只改变头像槽宽度，不重建单元格。
    if (!isTeamCell(cell)) return;
    const formatted = appSettings.user.avatar.enabled && appSettings.user.formatTeams !== false;
    if (
      cell.classList.contains('cf-team-formatted') === formatted &&
      cell.classList.contains('cf-avatar-processed-cell')
    )
      return;
    snapshots.push(captureTeamLayout(cell));
    restoreOriginal(cell);
    cell.classList.remove('cf-team-formatted', 'cf-team-unformatted', 'cf-avatar-processed-cell');
  });
  formatStandingsCells();
  applyUserAvatars();
  snapshots.forEach(animateTeamLayout);
}
