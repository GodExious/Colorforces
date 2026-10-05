import { appSettings } from '../../../settings.js';
import { applyUserAvatars } from './enhance.js';
import { captureTeamLayout, animateTeamLayout } from './layout-motion.js';
import { getProfileLinks, isTeamCell } from './structure.js';

// 恢复队伍单元格的原始结构。
export function unformatTeamCell(cell) {
  if (cell.hasAttribute('data-original-html')) {
    cell.innerHTML = cell.getAttribute('data-original-html');
  }
  cell.classList.remove('cf-team-formatted');
  cell.classList.add('cf-team-unformatted');
  cell.style.removeProperty('padding-top');
  cell.style.removeProperty('padding-bottom');
  cell.style.setProperty('word-break', 'break-word', 'important');
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
        unformatTeamCell(cell);
        return;
      }
      const span = cell.querySelector('span[title="Ghost participant"]');
      if (span) {
        cell.classList.remove('cf-team-unformatted');
        cell.classList.add('cf-team-formatted');
        const text = span.textContent.trim();
        let school = '',
          team = '',
          members = '';

        if (text.includes(': ')) {
          // Pattern: School: Team (Members) or School: Team
          const parts = text.split(': ');
          school = parts[0].trim();
          let rest = parts.slice(1).join(': ').trim();
          const parenMatch = rest.match(/^(.*?)\s*\((.*?)\)$/);
          if (parenMatch) {
            team = parenMatch[1].trim();
            members = parenMatch[2].trim();
          } else {
            team = rest;
          }
        } else if (text.includes(' - ') && text.split(' - ').length >= 3) {
          // Pattern: School - Team - Members
          const parts = text.split(' - ');
          school = parts[0].trim();
          team = parts[1].trim();
          members = parts.slice(2).join(' - ').trim();
        } else if (text.includes(' - ') && text.split(' - ').length === 2) {
          // Pattern: School - Team
          const parts = text.split(' - ');
          school = parts[0].trim();
          team = parts[1].trim();
        } else if (text.match(/^(.*?)\s*\((.*?)\)$/)) {
          // Pattern: Team (School)
          const match = text.match(/^(.*?)\s*\((.*?)\)$/);
          team = match[1].trim();
          school = match[2].trim();
        } else {
          // Fallback
          team = text;
        }

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

        if (members) {
          const memberNames = members.split(',').map((m) => m.trim());
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

    const userLinks = getProfileLinks(cell);
    if (userLinks.length > 1 || cell.querySelector('a[href*="/team/"]')) {
      if (!formatTeams) {
        unformatTeamCell(cell);
        return;
      }
      cell.classList.remove('cf-team-unformatted');
      cell.classList.add('cf-team-formatted');

      const membersContainer = document.createElement('div');
      membersContainer.className = 'cf-team-members';
      membersContainer.style.cssText =
        'display: flex; flex-direction: column; gap: 4px; margin-left: 4px;';

      userLinks.forEach((link) => {
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
    if (cell.hasAttribute('data-original-html')) {
      cell.innerHTML = cell.getAttribute('data-original-html');
      cell.classList.remove('cf-team-formatted');
      cell.classList.remove('cf-team-unformatted');
    }
    cell.classList.remove('cf-avatar-processed-cell');
    cell
      .querySelectorAll('a[href*="/profile/"]')
      .forEach((a) => a.removeAttribute('data-cf-avatar-processed'));
    cell.querySelectorAll('.cf-avatar-container').forEach((el) => el.remove());
    cell.querySelectorAll('.cf-avatar-line-wrapper').forEach((wrap) => {
      while (wrap.firstChild) {
        wrap.parentNode.insertBefore(wrap.firstChild, wrap);
      }
      wrap.remove();
    });
  });
  formatStandingsCells();
  applyUserAvatars();
  snapshots.forEach(animateTeamLayout);
}
