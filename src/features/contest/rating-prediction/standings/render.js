import { appSettings } from '../../../../settings.js';
import { translate as t } from '../../../../i18n/index.js';
import {
  renderScore,
  renderRankProgress,
  setRankIcon,
  snapshotTime,
  predictionNumberColor,
} from './presentation.js';
import {
  updateParticipationTag,
  clearParticipationTags,
  resetParticipationMeasures,
} from './participation-tags.js';
import { syncPredictionColumns } from './column-motion.js';
import { untrustedHandles } from '../trusted.js';
import {
  teamIndex,
  teamRecordFor,
  teamIsUnrated,
  teamSize,
  memberParts,
  textBefore,
} from './team-rows.js';
import { hiddenMembers, isMoreMark, parseGhostTeam } from '../../../user/avatars/team-members.js';
import { snapshotLifetime } from '../data.js';
let observer = null,
  updateTimer = null;
const toolbarAnimations = new WeakMap();
let flowerSerial = 0;

// 分析入口是一朵五片花瓣的小花，每片由花心处的原色向花瓣尖变浅；颜色由按钮上的变量给出。
// 渐变靠编号引用，每个按钮各用各的编号，否则整页的花都会指到第一朵的渐变上、变成同一种颜色。
function flowerIcon() {
  const id = `cf-prediction-flower-${++flowerSerial}`;
  const petals = [0, 1, 2, 3, 4]
    .map(
      (index) =>
        `<ellipse class="cf-prediction-petal" cx="12" cy="6.2" rx="3.1" ry="5" transform="rotate(${index * 72} 12 12)" fill="url(#${id})"/>`,
    )
    .join('');
  return `<svg class="cf-prediction-flower" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><defs><radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="12" cy="12" r="11.5"><stop class="cf-prediction-flower-inner" offset=".2"/><stop class="cf-prediction-flower-outer" offset="1"/></radialGradient></defs>${petals}<circle class="cf-prediction-flower-core" cx="12" cy="12" r="2.2"/></svg>`;
}

// 成绩算不出来、只能打标签的那些不在官方榜单内的参赛者（见 trusted.js）。按快照记着，同一份快照反复重画时不用每次重算。
const untrustedOf = new WeakMap();
function untrustedIn(snapshot) {
  if (!snapshot) return new Set();
  if (!untrustedOf.has(snapshot)) untrustedOf.set(snapshot, untrustedHandles(snapshot));
  return untrustedOf.get(snapshot);
}

// 这一格里的全部账号（小写）。根据主页地址识别，图片链接无文字也能正常匹配；队伍的格子里有好几个。
function handlesForCell(cell) {
  const names = new Set();
  for (const link of cell.querySelectorAll('a[href]')) {
    try {
      const parts = new URL(link.href, location.href).pathname.split('/');
      if (parts[1] === 'profile' && parts[2]) names.add(decodeURIComponent(parts[2]).toLowerCase());
    } catch {}
  }
  return [...names];
}
// 这一行是队伍的话有几个人（不是队伍为 0）。原站折叠进「...」里的成员从它的提示里数，
// 提示可能已经被插件的提示功能接管（原来的 title 挪到了 data-cf-native-tooltip）。
function teamSizeForCell(cell, handles) {
  const more = [...cell.querySelectorAll('span')].find((span) => isMoreMark(span.textContent));
  const hidden = more
    ? hiddenMembers(more.getAttribute('title') ?? more.getAttribute('data-cf-native-tooltip'))
    : [];
  return teamSize(handles.length, !!cell.querySelector('a[href*="/team/"]'), hidden.length);
}
/*
 * Ghost 队伍有几个人。成员只是那段文字里的名单：队伍格式化之后数排出来的成员行，没格式化时照同一套写法从文字里认。
 * 没写成员、或者写法不认得的，返回 '?'.
 */
function ghostSizeForCell(cell) {
  const lines = cell.querySelectorAll('.cf-team-members > .cf-member-line').length;
  if (lines) return lines;
  const label = cell.querySelector(
    'span[title="Ghost participant"], span[data-cf-native-tooltip="Ghost participant"]',
  );
  return (label && parseGhostTeam(label.textContent).members.length) || '?';
}
// 这一格是哪个用户；队伍的格子不是某一个用户，返回 null。
export function handleForCell(cell) {
  const names = handlesForCell(cell);
  return names.length === 1 ? names[0] : null;
}
// 新节点带归属标记，关闭功能不删除原站或头像节点。
function node(tag, className) {
  const el = document.createElement(tag);
  el.dataset.cfPrediction = '';
  el.className = className;
  return el;
}
// 不重复修改未变化的文本。
function text(el, value) {
  if (el.textContent !== value) el.textContent = value;
}
// 填入工具栏文字。带时区时，时区排成原站那种上标小字，后面还可以再接一段文字（如提醒符号）。
// 上标节点建好后只改其中的文字，不反复增删元素。
function fillToolbarText(el, value, zone, tail) {
  if (!zone) {
    el.textContent = value + tail;
    return;
  }
  let mark = el.querySelector(':scope > sup');
  if (!mark) {
    mark = node('sup', 'tz-superscript cf-prediction-zone');
    el.replaceChildren(document.createTextNode(''), mark, document.createTextNode(''));
  }
  el.firstChild.nodeValue = value;
  text(mark, zone);
  el.lastChild.nodeValue = tail;
}
// 语言切换时只插值文字项宽度，工具栏保持单行，避免内容变长触发高度突变。
function toolbarText(el, value, zone = '', tail = '') {
  const key = zone || tail ? [value, zone, tail].join('\n') : value;
  if (!el || el.dataset.cfToolbarText === key) return;
  // 首次填入、页面不可见或用户关闭了动效时直接换文字，不做宽度过渡，也就不用量宽度：
  // 量一次，浏览器就得把之前攒着没排的版（比如刚加了几列的整张榜单）当场排完。
  const animated =
    el.hasAttribute('data-cf-toolbar-text') &&
    !document.hidden &&
    el.isConnected &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const before = animated ? el.getBoundingClientRect().width : 0;
  toolbarAnimations.get(el)?.cancel();
  toolbarAnimations.delete(el);
  el.dataset.cfToolbarText = key;
  fillToolbarText(el, value, zone, tail);
  if (!before) return;
  animateWidth(el, before, el.getBoundingClientRect().width);
}
// 宽度从旧值过渡到新值，结束后撤掉动画，交还给样式表。
// 表格单元格要同时压住最小和最大宽度，否则列宽会被新文字直接撑开，过渡不起作用。
function animateWidth(el, from, to, cell = false) {
  const frame = (width) =>
    cell
      ? { width: width + 'px', minWidth: width + 'px', maxWidth: width + 'px' }
      : { width: width + 'px' };
  const animation = el.animate([frame(from), frame(to)], {
    duration: 220,
    easing: 'cubic-bezier(.22,1,.36,1)',
    fill: 'both',
  });
  toolbarAnimations.set(el, animation);
  animation.finished.then(
    () => {
      if (toolbarAnimations.get(el) !== animation) return;
      animation.cancel();
      toolbarAnimations.delete(el);
    },
    () => {},
  );
}
// 单元格内容区的宽度（不含内边距和边框），与样式里 width 的含义一致。
function contentWidth(el) {
  const style = getComputedStyle(el);
  return (
    el.getBoundingClientRect().width -
    ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce(
      (sum, key) => sum + (parseFloat(style[key]) || 0),
      0,
    )
  );
}
// 表头里随语言变化的文字（如「操作」与 Actions）：两种语言宽度不同，
// 切换时列宽平滑过渡、新文字淡入，不让整张表突然变宽或变窄。
function headerText(el, value) {
  let label = el.querySelector('.cf-prediction-head-text');
  if (!label) {
    label = node('span', 'cf-prediction-head-text');
    el.replaceChildren(label);
  }
  if (label.textContent === value) return;
  // 首次填入、列正在收放、页面不可见或用户关闭了动效时，直接替换。
  const animated =
    label.textContent &&
    el.isConnected &&
    !document.hidden &&
    !el.classList.contains('cf-prediction-column-moving') &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 连续切换时从当前画面的宽度接续。
  const before = animated ? contentWidth(el) : 0;
  toolbarAnimations.get(el)?.cancel();
  toolbarAnimations.delete(el);
  label.textContent = value;
  if (!animated) return;
  const after = contentWidth(el);
  if (Math.abs(after - before) > 0.5) animateWidth(el, before, after, true);
  label.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
}
// 仅清理本功能的节点。
export function clearPrediction() {
  clearParticipationTags();
  document.querySelectorAll('table.standings').forEach((table) => syncPredictionColumns(table, []));
  document.querySelectorAll('.cf-prediction-bar').forEach((bar) => bar.remove());
}
// 找到当前功能拥有的列，避免选择其他插件的同名元素。
function column(row, key, tag = 'td') {
  let el = [...row.children].find((c) => c.dataset.predictionColumn === key);
  if (!el) {
    el = node(tag, 'cf-prediction-cell');
    el.dataset.predictionColumn = key;
    el.dataset.cfPredictionNew = '';
    const order = ['performance', 'delta', 'rank', 'ratedRank', 'actions'];
    const owned = [...row.children].filter((c) => c.dataset.predictionColumn);
    const next = owned.find((c) => order.indexOf(c.dataset.predictionColumn) > order.indexOf(key));
    if (next) row.insertBefore(el, next);
    else if (owned.length) owned.at(-1).after(el);
    else row.append(el);
  }
  const peer =
    row.querySelector('td.contestant-cell') ||
    [...row.children].find((c) => !c.dataset.predictionColumn);
  for (const name of ['dark', 'bottom', 'top'])
    el.classList.toggle(name, Boolean(peer?.classList.contains(name)));
  for (const owned of row.querySelectorAll('[data-prediction-column]')) {
    owned.classList.toggle('right', owned === row.lastElementChild);
    owned.classList.toggle(
      'cf-prediction-first',
      owned === row.querySelector('[data-prediction-column]'),
    );
  }
  return el;
}
// 身份按当前行的原生标注判定，不能把同名用户的正赛身份复制到虚拟榜单。
function participationTypeForCell(cell) {
  const row = cell.parentElement;
  const type =
    row.getAttribute('data-participant-type') ||
    row.getAttribute('participant-type') ||
    row.getAttribute('participanttype');
  if (type && type.toUpperCase() !== 'CONTESTANT') return type.toUpperCase();
  const titles = [
    ...cell.querySelectorAll('sup[title], sub[title], span[title], [data-cf-native-tooltip]'),
  ].map((marker) =>
    (marker.getAttribute('title') || marker.getAttribute('data-cf-native-tooltip') || '').trim(),
  );
  if (titles.some((title) => /^(virtual participant|виртуальный участник)$/i.test(title)))
    return 'VIRTUAL';
  if (titles.some((title) => /^(out of competition|вне конкурса)$/i.test(title)))
    return 'OUT_OF_COMPETITION';
  if (titles.some((title) => /^practice(?: participant)?$/i.test(title))) return 'PRACTICE';
  const rank = row.cells[0]?.textContent.trim() || '';
  if (rank === '*') return 'OUT_OF_COMPETITION';
  if (!/^\d/.test(rank)) return 'PRACTICE';
  const link = [...cell.querySelectorAll('a[href]')].find(
    (a) =>
      /\/profile\//.test(a.getAttribute('href')) &&
      !a.classList.contains('cf-avatar-container') &&
      a.textContent.trim(),
  );
  // 名字前面的星号是非正式参赛的记号；队名（队伍主页的链接）里的星号不算。
  const isTeamName = (node) => node.matches('a[href*="/team/"]');
  if (link && textBefore(cell, link, isTeamName).includes('*')) return 'OUT_OF_COMPETITION';
  return '';
}
// 同一用户可能同时参加正赛和赛后练习，先验证当前行，不能仅按用户名复用结果。
export function isOfficialStandingsRow(cell) {
  const row = cell.parentElement;
  const type = participationTypeForCell(cell);
  if (type && type !== 'CONTESTANT') return false;
  if (!/^\s*\d/.test(row.cells[0]?.textContent || '')) return false;
  return true;
}
/*
 * 计分队伍的头衔变化和分析入口按成员分开：一格等分成几段，细线隔开，一人一段，先后和原站榜单上的成员一致。
 * 开不开头像、队伍格式化都分；表现分、涨跌分、计评级名次是全队共用的，不分。
 * 分出来的几段叠在格子上（绝对定位，才能跟着这一行的高度等分），格子自己就没有内容撑宽度和高度了：
 * 宽度由头衔变化那一列里一份不显示的内容（sizer）撑住；高度按段数给一个下限，每段至少一个单人行那么高
 *（队伍没排成一人一行时这一行只有一行字，不给下限的话几段会挤在一起），单人行多高见 renderPrediction。
 */
function fadeIn(element) {
  if (
    !element?.isConnected ||
    document.hidden ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return;
  element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease' });
}
// 把一格分成 count 段，返回这几段。原来是整格内容的，先把整格用的记号清掉。
function splitCell(cell, count) {
  let box = cell.querySelector(':scope > .cf-prediction-parts');
  if (!box) {
    for (const key of [
      'cfRankMode',
      'cfRankShape',
      'rankSignature',
      'tooltip',
      'tooltipVariant',
      'cfRatingMode',
      'cfRatingEmpty',
      'rating',
    ])
      delete cell.dataset[key];
    cell.style.removeProperty('background-color');
    box = node('div', 'cf-prediction-parts');
    cell.replaceChildren(node('span', 'cf-prediction-sizer'), box);
    cell.classList.add('cf-prediction-split');
    fadeIn(box);
  }
  cell.style.setProperty('--cf-prediction-parts', String(count));
  while (box.children.length > count) box.lastElementChild.remove();
  while (box.children.length < count) box.append(node('div', 'cf-prediction-part'));
  return [...box.children];
}
// 分开的格子改回整格。返回原来是不是分开的（是的话新内容要淡入，不能直接换）。
function unsplitCell(cell) {
  if (!cell.classList.contains('cf-prediction-split')) return false;
  cell.classList.remove('cf-prediction-split');
  cell.style.removeProperty('--cf-prediction-parts');
  cell.replaceChildren();
  delete cell.dataset.rankSignature;
  return true;
}
// 每个成员自己的头衔变化：赛前、赛后评级取官方记录里他自己的，涨跌是全队相同的那一个。
function renderMemberRanks(output, parts, result, phase) {
  const boxes = splitCell(output, parts.length);
  parts.forEach((part, index) =>
    renderRankProgress(
      boxes[index],
      {
        status: 'rated',
        rating: part.before,
        reportedRating: part.before,
        newRating: part.after,
        label: part.handle,
      },
      { delta: part.after - part.before, rank: result?.rank },
      phase,
    ),
  );
  const sizer = output.querySelector(':scope > .cf-prediction-sizer');
  const key = parts.map((part) => part.before + '>' + part.after).join(',');
  if (sizer.dataset.key === key) return;
  sizer.dataset.key = key;
  sizer.replaceChildren(
    ...boxes.map((box) => {
      const line = document.createElement('span');
      const content = box.querySelector('.cf-prediction-rank-change');
      if (content) line.append(content.cloneNode(true));
      return line;
    }),
  );
}
// 每个成员一个分析入口。推演是全队共用的，点开后显示的是这个成员自己的评级（见 index.js）。
function renderMemberActions(output, parts, result, analyze) {
  const boxes = splitCell(output, parts.length);
  parts.forEach((part, index) => {
    analysisButton(
      boxes[index],
      predictionNumberColor(result.performance) || predictionNumberColor(part.before) || '',
      part.handle,
      analyze,
    );
    // 几段和左边的成员不一定对得齐（队伍没排成一人一行时），提示里写明是谁的。
    boxes[index].firstElementChild.dataset.tooltip = t('predictionAnalyze') + ' · ' + part.handle;
  });
}
// 填写当前可见用户，单用户分析只有操作入口，不逐行建立组件。
// members：这一行是队伍的话有几个人；parts：计分队伍按成员分开时每一段是谁（不分时为 null）。
function renderRow(cell, record, result, columns, state, analyze, members = 0, parts = null) {
  for (const key of columns) {
    const output = column(cell.parentElement, key),
      value = result?.[key];
    if (key === 'actions') {
      if (parts && canAnalyze(record, result, state)) {
        renderMemberActions(output, parts, result, analyze);
        continue;
      }
      const restored = unsplitCell(output);
      renderAnalysisAction(output, record, result, state, analyze);
      if (restored) fadeIn(output.firstElementChild);
      continue;
    }
    if (key === 'ratedRank') {
      const rank = result?.rank;
      text(output, Number.isInteger(rank) ? `(${rank})` : 'N/A');
      output.classList.toggle('cf-prediction-unavailable', !Number.isInteger(rank));
      if (Number.isInteger(rank)) {
        output.dataset.tooltip = ratedRankTip(state.snapshot?.phase);
        output.dataset.tooltipVariant = 'lines';
      } else {
        output.dataset.tooltip = t('predictionNotApplicable');
        delete output.dataset.tooltipVariant;
      }
      continue;
    }
    if (key === 'rank') {
      if (parts) {
        renderMemberRanks(output, parts, result, state.snapshot?.phase);
        continue;
      }
      const restored = unsplitCell(output);
      renderRankProgress(output, record, result, state.snapshot?.phase);
      if (restored) fadeIn(output.firstElementChild);
      continue;
    }
    renderScore(output, key, value);
    // 表现分与涨跌分有数值时不带提示；只有显示 N/A 时才说明原因。
    const available = Number.isFinite(value) || value === Infinity;
    if (available) delete output.dataset.tooltip;
    else if (record?.status === 'rated')
      output.dataset.tooltip = state.error
        ? t(state.error)
        : state.snapshot?.warnings.includes('predictionIncompleteData')
          ? t('predictionIncompleteData')
          : t('predictionNotApplicable');
    else
      output.dataset.tooltip = record
        ? t('predictionReason' + record.reason)
        : t('predictionUnknown');
  }
  // 非可信参赛者（不在官方榜单里、成绩是从提交记录里算的）也是计分的，但单独用一种标签标出来。
  const tag = record?.untrusted ? 'untrusted' : record?.status;
  const show =
    appSettings.contest.participationTags.enabled &&
    record &&
    record.reason !== 'unofficial' &&
    ['rated', 'unrated', 'virtual', 'untrusted', 'practice', 'ghost'].includes(tag) &&
    appSettings.contest.participationTags[tag];
  updateParticipationTag(
    cell,
    show ? tag : null,
    record ? t('predictionReason' + record.reason) : '',
    members,
  );
  cell.querySelector('.cf-prediction-open')?.remove();
}
// 这一行能不能开单用户分析。
function canAnalyze(record, result, state) {
  return (
    appSettings.contest.prediction.enabled &&
    appSettings.contest.prediction.analysis &&
    record?.status === 'rated' &&
    record.valid &&
    !!result &&
    !state.snapshot?.warnings.includes('predictionIncompleteData')
  );
}
// 在 box 里放一朵分析入口的小花（已有就沿用），点了分析 handle。
function analysisButton(box, color, handle, analyze) {
  let button = box.querySelector(':scope > .cf-prediction-open');
  if (!button) {
    button = node('button', 'cf-prediction-open');
    button.type = 'button';
    button.innerHTML = flowerIcon();
    box.replaceChildren(button);
  }
  if (button.style.getPropertyValue('--cf-flower-color') !== color)
    button.style.setProperty('--cf-flower-color', color);
  button.dataset.tooltip = t('predictionAnalyze');
  button.setAttribute('aria-label', t('predictionAnalyze') + ' ' + handle);
  button.onclick = () => analyze(handle);
}
// 「#」（计评级名次）那一列的提示，表头和每一格一样：是什么、并列时取哪一名；比赛进行中再说一句会有延迟。
const ratedRankTip = (phase) =>
  t('predictionRatedRankHint') + (phase === 'live' ? '\n' + t('predictionRatedRankDelay') : '');
// 操作独立成列，不挤占昵称和参与状态的位置。
function renderAnalysisAction(output, record, result, state, analyze) {
  // 队伍整支没有分析入口：面板里的赛前评级是对一个人说的。队伍排成一人一行时按成员各给一个（见 renderMemberActions）。
  if (canAnalyze(record, result, state) && !record.members) {
    // 花的颜色跟随这一行的表现分；没有表现分时退回赛前评级的颜色。
    const color =
      predictionNumberColor(result.performance) || predictionNumberColor(record.rating) || '';
    delete output.dataset.tooltip;
    analysisButton(output, color, record.handle, analyze);
  } else {
    renderScore(output, 'actions', null);
    output.dataset.tooltip = t('predictionNotApplicable');
  }
}
// 观察原站重绘只补齐节点，不重新请求或计算预测。
export function observePredictionTable(render) {
  observer = new MutationObserver((records) => {
    if (
      !records.some((r) =>
        [...r.addedNodes, ...r.removedNodes].some(
          (n) =>
            n.nodeType === 1 &&
            !n.matches?.('[data-cf-prediction]') &&
            !n.closest?.('[data-cf-prediction]'),
        ),
      )
    )
      return;
    clearTimeout(updateTimer);
    updateTimer = setTimeout(render, 150);
  });
  observer.observe(document.getElementById('pageContent') || document.body, {
    childList: true,
    subtree: true,
  });
  return () => {
    observer?.disconnect();
    observer = null;
    clearTimeout(updateTimer);
  };
}

// 加载分成的几段，按先后顺序；有的段会被跳过（比如官方已出分时不用核对提交记录）。
const STAGES = ['standings', 'ratings', 'submissions', 'compute'];
// 加载时状态栏里写的话：到了哪一段；核对提交记录时带上已经扫描的条数。
function loadingText(state) {
  if (state.stage === 'standings') return t('predictionStageStandings');
  if (state.stage === 'ratings') return t('predictionStageRatings');
  if (state.stage === 'submissions')
    return state.progress
      ? t('predictionScanning', state.progress)
      : t('predictionStageSubmissions');
  if (state.stage === 'compute') return t('predictionStageCompute');
  return t('predictionLoading');
}
// 状态文字前面的分段进度：做完的段填实，正在做的一段有流动的光带。
// 只在真的发了请求的加载中显示；收起时各段保持最后的样子，不回跳。
function renderSteps(bar, state) {
  const stepping = state.loading && Boolean(state.stage);
  bar.classList.toggle('is-stepping', stepping);
  if (!stepping) return;
  const current = STAGES.indexOf(state.stage);
  bar.querySelectorAll('.cf-prediction-steps i').forEach((step, index) => {
    step.classList.toggle('is-done', index < current);
    step.classList.toggle('is-active', index === current);
  });
}

// 显示当前快照，暂时失败时保留原时间并给出说明。
export function renderPrediction(state, actions) {
  const table = document.querySelector('table.standings');
  if (!table) return;
  observer?.disconnect();
  try {
    let bar = document.querySelector('.cf-prediction-bar');
    if (!bar) {
      bar = node('div', 'cf-prediction-bar');
      // 换语言时状态栏里的文字走和菜单、弹窗一样的逐项淡出淡入（见 utils/language-wave.js）。
      bar.dataset.cfLanguageSurface = '';
      // 状态栏里分上下两行：上面一行是进度、状态文字、快照时间和刷新按钮，下面一行是临时的提醒。
      const row = node('div', 'cf-prediction-row');
      const steps = node('span', 'cf-prediction-steps');
      steps.setAttribute('aria-hidden', 'true');
      steps.append(...STAGES.map(() => node('i', '')));
      row.append(steps, node('span', 'cf-prediction-status'), node('span', 'cf-prediction-note'));
      const button = node('button', 'cf-prediction-refresh');
      button.type = 'button';
      button.addEventListener('click', actions.refresh);
      row.append(button);
      // 临时的提醒，在状态栏里面、状态文字的下一行：后续版本要做主题配色，所以不再适配其他插件的深色主题。
      // 和个人主页数据分析面板里的那一条是同一句话、同样的样子；主题功能上线后一起删掉。
      bar.append(row, node('div', 'cf-prediction-notice'));
      table.parentNode.insertBefore(bar, table);
    }
    text(bar.querySelector('.cf-prediction-notice'), t('themeNotice'));
    renderSteps(bar, state);
    toolbarText(
      bar.querySelector('.cf-prediction-status'),
      state.loading
        ? loadingText(state)
        : state.error
          ? t(state.error)
          : state.snapshot
            ? t('predictionPhase' + state.snapshot.phase)
            : t('predictionWaiting'),
    );
    const note = bar.querySelector('.cf-prediction-note');
    const taken = snapshotTime(state.snapshot?.fetchedAt);
    toolbarText(
      note,
      state.snapshot ? t('predictionDataTime') + ' ' + taken.text : '',
      state.snapshot ? taken.zone : '',
      state.snapshot?.warnings.length ? ' ⚠' : '',
    );
    // 多久自动刷新一次：比赛进行中和等待出分时定时刷新，间隔不同；结果已经固定的（已出分、不计分的比赛）和别的阶段各有各的说法。
    const phase = state.snapshot?.phase;
    const cadence = !phase
      ? ''
      : ['live', 'pending'].includes(phase)
        ? t('predictionAutoRefreshEvery', Math.round(snapshotLifetime(state.snapshot) / 1000))
        : ['final', 'unrated'].includes(phase)
          ? t('predictionAutoRefreshOff')
          : t('predictionAutoRefreshIdle');
    note.dataset.tooltip = [cadence, ...(state.snapshot?.warnings || []).map((key) => t(key))]
      .filter(Boolean)
      .join(' · ');
    const refresh = bar.querySelector('button');
    toolbarText(refresh, t('predictionRefresh'));
    if (cadence) refresh.dataset.tooltip = cadence;
    else delete refresh.dataset.tooltip;
    refresh.disabled = state.loading;
    const records = new Map(
      (state.snapshot?.participants || []).map((r) => [r.handle.toLowerCase(), r]),
    );
    for (const handle of state.snapshot?.activity?.unofficial || [])
      if (!records.has(handle.toLowerCase()))
        records.set(handle.toLowerCase(), {
          handle,
          status: 'unrated',
          reason: 'unofficial',
          valid: false,
        });
    // 队伍的行按队员的账号找记录（见 team-rows.js）。
    const teams = teamIndex(state.snapshot?.participants);
    // 按成员分开的格子，每段至少一个单人行那么高：量页面上一个单人的行。只在有队伍时量；
    // 这一页没有单人的行（整场都是队伍）时不量，样式里有默认的高度。
    if (teams.size) {
      const single = table.querySelector('td.contestant-cell.cf-single-user-cell');
      const height = single?.parentElement.offsetHeight;
      if (height > 0) table.style.setProperty('--cf-prediction-part-min', height + 'px');
    }
    const columns = appSettings.contest.prediction.enabled
      ? ['performance', 'delta', 'rank', 'ratedRank', 'actions'].filter(
          (key) =>
            appSettings.contest.prediction[
              key === 'rank' ? 'rankChange' : key === 'actions' ? 'analysis' : key
            ],
        )
      : [];
    const header = table.querySelector('tr');
    if (!header) return;
    for (const key of columns) {
      const el = column(header, key, 'th');
      el.querySelector('.cf-prediction-final')?.remove();
      if (key === 'rank') {
        setRankIcon(el, 'up');
        el.dataset.tooltip = t('predictionRankChange');
        el.setAttribute('aria-label', el.dataset.tooltip);
      } else if (key === 'actions') {
        headerText(el, t('predictionActions'));
      } else if (key === 'ratedRank') {
        el.replaceChildren(document.createTextNode('#'));
        const ratedMark = node('span', 'cf-prediction-rated-r-mark');
        ratedMark.textContent = 'R';
        el.append(ratedMark);
        // 表头的提示里说明并列时取哪一名：这一列和原站的名次一列取法不同，数字会差出一截。说明另起一行。
        el.dataset.tooltip = ratedRankTip(state.snapshot?.phase);
        el.dataset.tooltipVariant = 'lines';
      } else {
        text(el, key === 'delta' ? 'Δ' : 'Π');
        el.dataset.tooltip = t(
          key === 'delta'
            ? state.snapshot?.phase === 'final'
              ? 'predictionFinalDelta'
              : 'predictionLiveDelta'
            : 'predictionPerformanceHint',
        );
      }
      if (state.snapshot?.phase === 'final' && ['delta', 'rank'].includes(key)) {
        const badge = node('span', 'cf-prediction-final');
        badge.textContent = 'F';
        badge.dataset.tooltip = t('predictionFinalMarker');
        badge.setAttribute('aria-label', t('predictionFinalMarker'));
        el.append(badge);
      }
    }
    // 难度分行与统计底行也补齐空格，不能只给有用户名的行追加列。
    for (const row of table.rows) {
      if (row === header || row.querySelector('td.contestant-cell')) continue;
      for (const key of columns) {
        const output = column(row, key, row.querySelector('th') ? 'th' : 'td');
        output.classList.add('cf-prediction-placeholder');
      }
    }
    const untrusted = untrustedIn(state.snapshot);
    resetParticipationMeasures();
    for (const cell of table.querySelectorAll('td.contestant-cell')) {
      const handles = handlesForCell(cell);
      const handle = handles.length === 1 ? handles[0] : null;
      // Ghost 队伍：现场赛的队伍，成绩是导入榜单的，没有账号。原站给它配一个小幽灵图标，认图标（队伍格式化之后也留着）。
      const ghost = !!cell.querySelector('img[src*="ghost.png"]');
      const type = participationTypeForCell(cell);
      const known = handle ? records.get(handle) : teamRecordFor(handles, teams);
      // 已出分的比赛里，这一行没有评级记录就是不计分；队伍的行有一种情况不下结论，见 teamIsUnrated。
      const settled =
        state.snapshot?.phase === 'final' && (handle || teamIsUnrated(handles, records));
      const record = ghost
        ? { handle: null, status: 'ghost', reason: 'ghost', valid: false }
        : type === 'VIRTUAL'
          ? { handle, status: 'virtual', reason: 'virtual', valid: false }
          : type === 'OUT_OF_COMPETITION' ||
              (isOfficialStandingsRow(cell) && known?.reason === 'unofficial')
            ? { handle, status: 'unrated', reason: 'outOfCompetition', valid: false }
            : !isOfficialStandingsRow(cell)
              ? // 没有名次的行是赛后练习：比赛结束后才交的题，不在本场的排名里。单独标一种标签。
                type === 'PRACTICE'
                ? { handle, status: 'practice', reason: 'practice', valid: false }
                : { handle, status: 'unrated', reason: 'unofficial', valid: false }
              : known ||
                // 认得出是不在官方榜单内的参赛者，但成绩算不出来，只标标签，没有预测。
                // 原因有两种：这种赛制算不了，或者这一场是旧版本缓存的（那时没记赛制，也没存逐题的统计）。
                (handle && untrusted.has(handle)
                  ? {
                      handle,
                      status: 'untrusted',
                      reason:
                        // 两种算得出成绩的赛制里还没有结果，是因为这一场的缓存来自旧版本；别的赛制是算不了。
                        state.snapshot.scoring && !['ICPC', 'CF'].includes(state.snapshot.scoring)
                          ? 'untrustedUnsupported'
                          : 'untrustedNoResult',
                      untrusted: true,
                      valid: false,
                    }
                  : settled
                    ? { handle, status: 'unrated', reason: 'notOfficial', valid: false }
                    : null);
      renderRow(
        cell,
        record,
        record?.status === 'rated' ? state.results[record.handle] : null,
        columns,
        state,
        actions.analyze,
        ghost ? ghostSizeForCell(cell) : teamSizeForCell(cell, handles),
        // 计分的队伍，头衔变化和分析入口按成员分开。
        record?.status === 'rated' ? memberParts(record, handles) : null,
      );
    }
    syncPredictionColumns(table, columns);
  } finally {
    observer?.observe(document.getElementById('pageContent') || document.body, {
      childList: true,
      subtree: true,
    });
  }
}
