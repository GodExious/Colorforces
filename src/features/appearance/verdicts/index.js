import { appSettings } from '../../../settings.js';
import { PLUGIN_UI_SELECTOR } from '../../page/plugin-ui.js';
import { findTestInfo } from './test-info.js';
const running = new WeakMap();
export const VERDICT_SELECTOR =
  '.status-verdict-cell, [data-cf-verdict-processed], #sidebar .verdict-accepted, #sidebar .verdict-rejected, #sidebar .verdict-waiting';
const verdicts = [
  ['Accepted', 'AC', 'verdict-accepted'],
  ['Wrong answer', 'WA', 'verdict-rejected'],
  ['Time limit exceeded', 'TLE', 'verdict-rejected'],
  ['Memory limit exceeded', 'MLE', 'verdict-rejected'],
  ['Runtime error', 'RE', 'verdict-rejected'],
  ['Compilation error', 'CE', ''],
  ['Idleness limit exceeded', 'ILE', 'verdict-rejected'],
  ['Presentation error', 'PE', 'verdict-rejected'],
  ['Skipped', 'SK', 'verdict-rejected'],
];
const fullPattern = new RegExp(`\\b(${verdicts.map(([full]) => full).join('|')})\\b`, 'gi');
const shortPattern = /^(AC|WA|TLE|MLE|RE|CE|ILE|PE|SK)(?=\s|$)/i;
// 原站自己的判题文字节点。状态表格、侧栏之外的地方（提交详情页、源码弹窗的标题等）用的也是这些类名。
export const NATIVE_VERDICT_SELECTOR =
  '.verdict-accepted, .verdict-rejected, .verdict-waiting, .verdict-failed';
const nativeSelector = NATIVE_VERDICT_SELECTOR;
const auxiliarySelector = '.diagnosticsHint, .diagnostics-icon, script, style';

// 是否开着「隐藏测试点信息」。
const hidesVerdictTests = () => appSettings.appearance.hideVerdictTests;

// 把一段判题文字里的测试点信息（on test 3 这样的）藏起来，返回新的 HTML；没有测试点时原样返回。
// 藏起来的部分不丢：换成一个不显示的占位节点，原来的内容记在它的 data-cf-verdict-test 上。
// 原站重写整格 HTML（比如追加诊断图标）之后，还能从占位节点把测试点放回去。
function hideTestInfo(html) {
  // 先粗筛一遍，绝大多数判题文字（Accepted 等）不用往下解析。
  if (!html || !/test|тест/i.test(html)) return html;
  const holder = document.createElement('template');
  holder.innerHTML = html;
  const texts = [];
  const walker = document.createTreeWalker(holder.content, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) texts.push(walker.currentNode);
  let changed = false;
  for (const text of texts) {
    const found = findTestInfo(text.textContent);
    if (!found) continue;
    const rest = text.textContent.slice(found.end);
    const hidden = document.createElement('div');
    hidden.append(text.textContent.slice(found.start, found.end));
    // 编号常常单独包在紧跟着的一个节点里（verdict-format-judged），一起藏。
    const next = text.nextSibling;
    const numberNext =
      !found.numbered &&
      !rest.trim() &&
      next?.nodeType === Node.ELEMENT_NODE &&
      /^\s*\d+\s*$/.test(next.textContent);
    if (numberNext) hidden.append(rest, next);
    const marker = document.createElement('span');
    marker.hidden = true;
    marker.dataset.cfVerdictTest = hidden.innerHTML;
    text.textContent = text.textContent.slice(0, found.start);
    text.after(marker, ...(numberNext || !rest ? [] : [rest]));
    changed = true;
  }
  return changed ? holder.innerHTML : html;
}

// 判题文字现在该显示哪一种写法：缩写不缩写、测试点藏不藏，各看各的开关。
function chosenVerdict(original, short) {
  const html = appSettings.appearance.shortVerdict ? short : original;
  return hidesVerdictTests() ? hideTestInfo(html) : html;
}

// 原站在动画途中更新正文时取消旧交接，旧回调不再覆盖新内容。
function cancelVerdictTransition(span) {
  const state = running.get(span);
  if (!state) return;
  running.delete(span);
  state.animations.forEach((animation) => animation.cancel());
  state.outgoing.remove();
  state.current.style.removeProperty('width');
}

// 新旧判题只在自身窗口内交接，快速切换合并到最后一次目标。
function displayVerdict(span, html, animate = true) {
  const pending = running.get(span);
  if (pending) {
    pending.next = html;
    return;
  }
  const current = span.querySelector('.cf-verdict-current');
  if (current.innerHTML === html) return;
  if (
    !animate ||
    !span.isConnected ||
    document.hidden ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    current.innerHTML = html;
    return;
  }
  const before = span.getBoundingClientRect();
  const next = document.createElement('span');
  next.className = 'cf-verdict-current';
  next.innerHTML = html;
  current.className = 'cf-verdict-outgoing';
  current.setAttribute('aria-hidden', 'true');
  span.appendChild(next);
  const after = span.getBoundingClientRect();
  // 两行全称和一行缩写共用相同位移，避免各按自身百分比滚动而互相覆盖。
  const distance = Math.ceil(Math.max(before.height, after.height)) + 2;
  current.style.width = before.width + 'px';
  next.style.width = after.width + 'px';
  const options = { duration: 240, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' };
  const state = { next: html, outgoing: current, current: next };
  running.set(span, state);
  const animations = [
    current.animate(
      [{ transform: 'translateY(0)' }, { transform: `translateY(${distance}px)` }],
      options,
    ),
    next.animate(
      [{ transform: `translateY(-${distance}px)` }, { transform: 'translateY(0)' }],
      options,
    ),
    span.animate(
      [
        { width: before.width + 'px', height: before.height + 'px' },
        { width: after.width + 'px', height: after.height + 'px' },
      ],
      options,
    ),
  ];
  state.animations = animations;
  Promise.all(animations.map((animation) => animation.finished))
    .catch(() => {})
    .then(() => {
      if (running.get(span) !== state) return;
      current.remove();
      next.style.removeProperty('width');
      animations.forEach((animation) => animation.cancel());
      running.delete(span);
      if (span.isConnected && state.next !== html) displayVerdict(span, state.next);
    });
}

// 在副本中生成全称与缩写，保留编号、换行及原站的其他内联样式。
function verdictForms(nodes) {
  const full = document.createElement('div');
  nodes.forEach((node) => full.append(node.cloneNode(true)));
  full.querySelectorAll('[data-cf-verdict-full]').forEach((node) => {
    node.replaceWith(document.createTextNode(node.dataset.cfVerdictFull));
  });
  // 藏起来的测试点先放回去，下面按完整的内容生成各种写法。
  full.querySelectorAll('[data-cf-verdict-test]').forEach((node) => {
    const holder = document.createElement('template');
    holder.innerHTML = node.dataset.cfVerdictTest;
    node.replaceWith(holder.content);
  });
  full.normalize();
  // 兼容已经被旧版改成缩写的正文，不再把 WA、AC 当作无法恢复的普通文本。
  const walker = document.createTreeWalker(full, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode;
    if (!text.textContent.trim()) continue;
    const match = text.textContent.trimStart().match(shortPattern);
    if (match) {
      const entry = verdicts.find(([, short]) => short === match[1].toUpperCase());
      const expanded = text.textContent.replace(match[1], entry[0]);
      const parent = text.parentElement;
      if (parent.tagName === 'B' && !parent.attributes.length && parent.childNodes.length === 1)
        parent.replaceWith(document.createTextNode(expanded));
      else text.textContent = expanded;
    }
    break;
  }
  const short = full.cloneNode(true);
  const texts = [];
  const shortWalker = document.createTreeWalker(short, NodeFilter.SHOW_TEXT);
  while (shortWalker.nextNode()) texts.push(shortWalker.currentNode);
  let type;
  for (const text of texts) {
    const matches = [...text.textContent.matchAll(fullPattern)];
    if (!matches.length) continue;
    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const match of matches) {
      const entry = verdicts.find(([full]) => full.toLowerCase() === match[0].toLowerCase());
      type ||= entry;
      fragment.append(document.createTextNode(text.textContent.slice(offset, match.index)));
      const bold = document.createElement('b');
      bold.dataset.cfVerdictFull = entry[0];
      bold.textContent = entry[1];
      fragment.append(bold);
      offset = match.index + match[0].length;
    }
    fragment.append(document.createTextNode(text.textContent.slice(offset)));
    text.replaceWith(fragment);
  }
  // 认不出判题名称（Running、俄文界面）但带着测试点的也算：它们没有缩写，只用来隐藏测试点。
  const original = full.innerHTML;
  const tests = hideTestInfo(original) !== original;
  return type || tests ? { original, short: short.innerHTML, type, tests } : null;
}

// 只包装判题正文，原生 submissionVerdictWrapper、颜色节点和诊断提示始终留在原位。
function formatVerdictBody(body) {
  const hide = hidesVerdictTests();
  let span = body.querySelector(':scope > .cf-verdict-text[data-cf-verdict-native]');
  let current = span?.querySelector(':scope > .cf-verdict-current');
  // 原站追加诊断图标会序列化整格 HTML；克隆节点没有动画实例，不能留下旧文字层。
  if (span && !running.has(span)) {
    span.querySelectorAll(':scope > .cf-verdict-outgoing').forEach((node) => node.remove());
    if (current?.style.width) current.style.removeProperty('width');
  }
  if (span && !current) {
    cancelVerdictTransition(span);
    span.replaceWith(...span.childNodes);
    span = null;
  }
  if (current) {
    const { original, short } = span.dataset;
    const known = [original, short, hideTestInfo(original), hideTestInfo(short)];
    if (known.includes(current.innerHTML)) {
      displayVerdict(span, chosenVerdict(original, short));
      return;
    }
  }
  const nodes = [...(current || body).childNodes].filter(
    (node) => node.nodeType !== Node.ELEMENT_NODE || !node.matches(auxiliarySelector),
  );
  const forms = verdictForms(nodes);
  if (span) cancelVerdictTransition(span);
  // 认得出名称的判题文字一直包着（缩写要用）。认不出名称的（Running、俄文界面）
  // 只在要隐藏测试点、并且真带着测试点时才包起来，平时不动它们。
  const wanted = forms && (forms.type || (hide && forms.tests));
  if (!wanted) {
    if (span && current) {
      // 拆掉包装前，把藏起来的测试点放回去。
      if (forms) current.innerHTML = forms.original;
      span.replaceWith(...current.childNodes);
    }
    return;
  }
  if (!span) {
    span = document.createElement('span');
    span.className = 'cf-verdict-text';
    span.dataset.cfVerdictNative = 'true';
    current = document.createElement('span');
    current.className = 'cf-verdict-current';
    span.append(current);
    body.insertBefore(span, nodes[0] || null);
    current.append(...nodes);
  }
  // 仅修复旧版已丢失语义节点的纯文本行；有原站配色时不覆盖它。
  for (const name of ['verdict-accepted', 'verdict-rejected']) span.classList.remove(name);
  if (forms.type?.[2] && !body.closest(nativeSelector) && !current.querySelector(nativeSelector))
    span.classList.add(forms.type[2]);
  span.dataset.original = forms.original;
  span.dataset.short = forms.short;
  // 原站刚写进来的新内容，测试点直接藏起来，不走交接：
  // 否则评测中每判完一个测试点，编号都会露一下再滑走。
  if (hide) {
    const hidden = hideTestInfo(current.innerHTML);
    if (hidden !== current.innerHTML) current.innerHTML = hidden;
  }
  displayVerdict(span, chosenVerdict(forms.original, forms.short));
}

// 将站点更新定位到真正的判题正文；旧包装拆开时移动节点，绝不用 textContent 丢弃结构。
export function walkAndReplaceVerdict(node) {
  const root = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!root?.isConnected || root.closest('.cf-menu-theme, .cf-verdict-outgoing')) return;
  if (root.matches('.cf-verdict-text[data-cf-verdict-native]')) {
    formatVerdictBody(root.parentElement);
    return;
  }
  const oldWindows = [...root.querySelectorAll('.cf-verdict-text:not([data-cf-verdict-native])')];
  for (const old of oldWindows) {
    const current = old.querySelector(':scope > .cf-verdict-current');
    const contents = [...(current || old).childNodes].filter(
      (node) =>
        node.nodeType !== Node.ELEMENT_NODE || !node.classList.contains('cf-verdict-outgoing'),
    );
    old.replaceWith(...contents);
  }
  const wrappers = root.matches('.submissionVerdictWrapper')
    ? [root]
    : [...root.querySelectorAll('.submissionVerdictWrapper')];
  if (wrappers.length) {
    for (const wrapper of wrappers) {
      const native = [...wrapper.querySelectorAll(nativeSelector)].find(
        (node) => !node.closest('.cf-verdict-text'),
      );
      formatVerdictBody(native || wrapper);
    }
    return;
  }
  if (root.matches(nativeSelector) && !root.classList.contains('cf-verdict-text')) {
    formatVerdictBody(root);
    return;
  }
  const native = [...root.querySelectorAll(nativeSelector)].filter(
    (node) => !node.closest('.cf-verdict-text'),
  );
  if (native.length) native.forEach(formatVerdictBody);
  else if (root.matches('.status-verdict-cell, [data-cf-verdict-processed]'))
    formatVerdictBody(root);
}

// 状态表格和侧栏之外的判题文字（提交详情页、源码弹窗的标题等）：按原站的判题类名找，
// 缩写和隐藏测试点同样作用到它们身上。
export function refreshLooseVerdicts(root = document) {
  const bodies = [...root.querySelectorAll(NATIVE_VERDICT_SELECTOR)];
  if (root.matches?.(NATIVE_VERDICT_SELECTOR)) bodies.unshift(root);
  for (const body of bodies) {
    // 插件自己界面里的、已经包在判题文字里面的、归状态表格和侧栏那条路管的，都不在这里处理。
    if (
      !body.isConnected ||
      body.closest(`${PLUGIN_UI_SELECTOR}, .cf-verdict-text, ${VERDICT_SELECTOR}`)
    )
      continue;
    formatVerdictBody(body);
  }
}

// 设置切换与侧栏提交历史共用同一转换路径，避免两个更新循环互相覆盖。
export function refreshVerdicts() {
  document.querySelectorAll(VERDICT_SELECTOR).forEach((cell) => walkAndReplaceVerdict(cell));
  refreshLooseVerdicts();
}
