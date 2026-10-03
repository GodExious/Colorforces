import { appSettings } from '../../../../settings.js';
import { translate as t } from '../../../../i18n/index.js';
import {
  renderScore,
  renderRankProgress,
  setRankIcon,
  snapshotTime,
  predictionNumberColor,
} from './presentation.js';
import { updateParticipationTag, clearParticipationTags } from './participation-tags.js';
import { syncPredictionColumns } from './column-motion.js';
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

// 根据主页地址识别用户，图片链接无文字也能正常匹配。
export function handleForCell(cell) {
  const names = new Set();
  for (const link of cell.querySelectorAll('a[href]')) {
    try {
      const parts = new URL(link.href, location.href).pathname.split('/');
      if (parts[1] === 'profile' && parts[2]) names.add(decodeURIComponent(parts[2]).toLowerCase());
    } catch {}
  }
  return names.size === 1 ? [...names][0] : null;
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
  const initialized = el.hasAttribute('data-cf-toolbar-text');
  const before = el.getBoundingClientRect();
  toolbarAnimations.get(el)?.cancel();
  toolbarAnimations.delete(el);
  el.dataset.cfToolbarText = key;
  fillToolbarText(el, value, zone, tail);
  const after = el.getBoundingClientRect();
  if (
    !initialized ||
    !before.width ||
    document.hidden ||
    !el.isConnected ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return;
  animateWidth(el, before.width, after.width);
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
  if (link) {
    const prefix = document.createRange();
    prefix.setStart(cell, 0);
    prefix.setEndBefore(link);
    if (prefix.toString().includes('*')) return 'OUT_OF_COMPETITION';
  }
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
// 填写当前可见用户，单用户分析只有操作入口，不逐行建立组件。
function renderRow(cell, record, result, columns, state, analyze) {
  for (const key of columns) {
    const output = column(cell.parentElement, key),
      value = result?.[key];
    if (key === 'actions') {
      renderAnalysisAction(output, record, result, state, analyze);
      continue;
    }
    if (key === 'ratedRank') {
      const rank = result?.rank;
      text(output, Number.isInteger(rank) ? `(${rank})` : 'N/A');
      output.classList.toggle('cf-prediction-unavailable', !Number.isInteger(rank));
      output.dataset.tooltip = Number.isInteger(rank)
        ? t('predictionRatedRank')
        : t('predictionNotApplicable');
      continue;
    }
    if (key === 'rank') {
      renderRankProgress(output, record, result, state.snapshot?.phase);
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
  const show =
    appSettings.participationTags.enabled &&
    record &&
    record.reason !== 'unofficial' &&
    ['rated', 'unrated', 'virtual'].includes(record.status) &&
    appSettings.participationTags[record.status];
  updateParticipationTag(
    cell,
    show ? record.status : null,
    record ? t('predictionReason' + record.reason) : '',
  );
  cell.querySelector('.cf-prediction-open')?.remove();
}
// 操作独立成列，不挤占昵称和参与状态的位置。
function renderAnalysisAction(output, record, result, state, analyze) {
  let button = output.querySelector('.cf-prediction-open');
  const canAnalyze =
    appSettings.prediction.enabled &&
    appSettings.prediction.analysis &&
    record?.status === 'rated' &&
    record.valid &&
    !!result &&
    !state.snapshot?.warnings.includes('predictionIncompleteData');
  if (canAnalyze) {
    if (!button) {
      button = node('button', 'cf-prediction-open');
      button.type = 'button';
      button.innerHTML = flowerIcon();
      output.replaceChildren(button);
    }
    // 花的颜色跟随这一行的表现分；没有表现分时退回赛前评级的颜色。
    const color =
      predictionNumberColor(result.performance) || predictionNumberColor(record.rating) || '';
    if (button.style.getPropertyValue('--cf-flower-color') !== color)
      button.style.setProperty('--cf-flower-color', color);
    delete output.dataset.tooltip;
    button.dataset.tooltip = t('predictionAnalyze');
    button.setAttribute('aria-label', t('predictionAnalyze') + ' ' + record.handle);
    button.onclick = () => analyze(record.handle);
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

// 显示当前快照，暂时失败时保留原时间并给出说明。
export function renderPrediction(state, actions) {
  const table = document.querySelector('table.standings');
  if (!table) return;
  observer?.disconnect();
  try {
    let bar = document.querySelector('.cf-prediction-bar');
    if (!bar) {
      bar = node('div', 'cf-prediction-bar');
      bar.append(node('span', 'cf-prediction-status'), node('span', 'cf-prediction-note'));
      const button = node('button', 'cf-prediction-refresh');
      button.type = 'button';
      button.addEventListener('click', actions.refresh);
      bar.append(button);
      table.parentNode.insertBefore(bar, table);
    }
    toolbarText(
      bar.querySelector('.cf-prediction-status'),
      state.loading
        ? state.progress
          ? t('predictionScanning', state.progress)
          : t('predictionLoading')
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
    note.dataset.tooltip = (state.snapshot?.warnings || []).map((key) => t(key)).join(' · ');
    const refresh = bar.querySelector('button');
    toolbarText(refresh, t('predictionRefresh'));
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
    const columns = appSettings.prediction.enabled
      ? ['performance', 'delta', 'rank', 'ratedRank', 'actions'].filter(
          (key) =>
            appSettings.prediction[
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
        el.dataset.tooltip = t('predictionRatedRank');
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
    for (const cell of table.querySelectorAll('td.contestant-cell')) {
      const handle = handleForCell(cell);
      const type = participationTypeForCell(cell);
      const known = records.get(handle);
      const record =
        type === 'VIRTUAL'
          ? { handle, status: 'virtual', reason: 'virtual', valid: false }
          : type === 'OUT_OF_COMPETITION' ||
              (isOfficialStandingsRow(cell) && known?.reason === 'unofficial')
            ? { handle, status: 'unrated', reason: 'outOfCompetition', valid: false }
            : !isOfficialStandingsRow(cell)
              ? { handle, status: 'unrated', reason: 'unofficial', valid: false }
              : known ||
                (handle && state.snapshot?.phase === 'final'
                  ? { handle, status: 'unrated', reason: 'notOfficial', valid: false }
                  : null);
      renderRow(
        cell,
        record,
        record?.status === 'rated' ? state.results[record.handle] : null,
        columns,
        state,
        actions.analyze,
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
