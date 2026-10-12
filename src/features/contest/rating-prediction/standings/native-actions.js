/*
 * 让同步之后才有内容的格子，也能用原站的操作（题目格：双击或按住 Ctrl 点击看提交记录；选手格：双击看比赛过程）。
 *
 * 原站只在页面载入时给当时符合条件的格子挂操作：带题目编号的格子（td[problemId]）和选手格。
 * 当时还没有提交的格子不带题目编号，没挂上；榜单同步后它有了提交、有了编号，点它却没有反应。
 * 没有旧格子可用、整格新加进来的也一样。
 * 原站的处理函数在页面脚本内部，从外面调不到。但它是在点的那一刻才读格子上的题目编号、行上的参赛编号的
 * （见 table-sync.js 开头），所以借一个挂过操作的格子：把要看的编号临时写到它身上，在它上面发出同样的事件，
 * 发完立刻写回去。整个过程在同一段脚本里做完，页面上看不到变化。
 */
const isWho = (cell) => cell.classList.contains('contestant-cell');
const seen = new WeakSet();
const bound = new WeakSet();
const watched = new WeakSet();

// 对账之前调用：还没见过的格子是页面载入时就在的，当时符合条件的就挂过操作。
export function noteNative(rows) {
  for (const row of rows)
    for (const cell of row.cells) {
      if (seen.has(cell)) continue;
      seen.add(cell);
      if (isWho(cell) || cell.hasAttribute('problemId')) bound.add(cell);
    }
}
// 对账之后调用：这一轮新放进页面的格子没有原站的操作，记成见过的，下一轮不会被当成页面载入时就在的。
export function noteAdopted(rows) {
  for (const row of rows) for (const cell of row.cells) seen.add(cell);
}
export const hasNativeAction = (cell) => bound.has(cell);

const put = (element, name, value) =>
  value === null ? element.removeAttribute(name) : element.setAttribute(name, value);

// 借一个挂过操作的同类格子（先在同一行里找），替 cell 发一次事件。
function relay(cell, type, ctrlKey) {
  const who = isWho(cell);
  const row = cell.parentElement;
  const fits = (other) => bound.has(other) && isWho(other) === who;
  const proxy =
    [...row.cells].find(fits) ||
    [...cell.closest('table').rows].flatMap((other) => [...other.cells]).find(fits);
  if (!proxy) return;
  const swaps = [[proxy.parentElement, 'participantId', row.getAttribute('participantId')]];
  if (!who)
    for (const name of ['problemId', 'acceptedSubmissionId'])
      swaps.push([proxy, name, cell.getAttribute(name)]);
  const saved = swaps.map(([element, name]) => element.getAttribute(name));
  swaps.forEach(([element, name, value]) => put(element, name, value));
  try {
    proxy.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ctrlKey }));
  } finally {
    swaps.forEach(([element, name], index) => put(element, name, saved[index]));
  }
}

function onAction(event) {
  // 只管用户自己的操作；上面替发的事件不再处理。
  if (!event.isTrusted) return;
  if (event.type === 'click' && !event.ctrlKey) return;
  const cell = event.target.closest?.('td');
  if (!cell || bound.has(cell) || cell.closest('table') !== this) return;
  const who = isWho(cell);
  if (who ? event.type !== 'dblclick' : !cell.hasAttribute('problemId')) return;
  if (event.type === 'dblclick') event.preventDefault();
  relay(cell, event.type, event.ctrlKey);
}

export function watchNativeActions(table) {
  if (watched.has(table)) return;
  watched.add(table);
  table.addEventListener('dblclick', onAction);
  table.addEventListener('click', onAction);
}
