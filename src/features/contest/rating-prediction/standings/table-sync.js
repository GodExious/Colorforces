/*
 * 把页面上的榜单表格换成最新的。
 *
 * 榜单表格是原站的，页面打开时载入一次就不再变；预测定时刷新，用的是新成绩，
 * 页面上却还是原来那些人、原来的题数和名次，两边对不上。所以预测刷新完之后，这里重新取一遍当前这一页，
 * 拿新表格和页面上的对账：
 * - 同一位参赛者（按原站标在行上的参赛编号认）的行留着，只改内容变了的格子。选手那一格不动，
 *   里面的头像、参赛标签，还有这一行上预测的各列，都原样留着。
 *   改格子时格子本身也留着，只改它的属性和里面的内容：原站在页面载入时给每个格子挂了操作
 *   （题目格：双击或按住 Ctrl 点击，查看这道题的提交记录；选手格：双击看这位选手的比赛过程），
 *   换成新的格子这些操作就没了。
 *   新进这一页的行没有旧格子可留，就拿离开这一页的行的格子来改（见 reuseCells）。
 *   这样做行得通，是因为原站的这些操作是在点的那一刻才去读格子上的题目编号、行上的参赛编号的
 *   （看过榜单页的脚本：handleContestantProblem 里是 td.parent().attr("participantId") 和 td.attr("problemId")），
 *   格子换了主人、改了属性，点开的就是新主人的记录。
 *   页面载入时还没有提交的格子、没有旧格子可用而整格新加的格子，原站没给它们挂操作，另外补（见 native-actions.js）。
 * - 名次变了的行挪到新位置；新进这一页的行加进来，不在这一页了的行去掉。
 * - 表头和插件自己加的难度分行不动。
 * 这样没变的地方完全不碰，页面不会整个闪一下。
 *
 * 换完之后的过渡：位置变了的行从原来的位置滑到新位置；其中自己成绩变了的那一行（过了题的人）滑动时
 * 浮在别的行上面，并带一层底色——上升是绿的，下降是红的，到位后淡掉。新进这一页的行从它来的那一边滑进来。
 * 要离开这一页的行在换之前先退场：朝它去的那一边挪一小段、淡出，然后才换表格，别的行再滑过来补上空位。
 */
import { fetchCurrentPage } from '../../../../api/codeforces.js';
import { noteNative, noteAdopted, watchNativeActions } from './native-actions.js';

// 插件自己加的格子（预测各列）和行（难度分行），不算原站的内容。
const isOwnCell = (cell) =>
  cell.dataset.predictionColumn !== undefined || cell.dataset.cfPrediction !== undefined;
const isOwnRow = (row) => row.classList.contains('cf-rating-standings-row');
const isWho = (cell) => cell.classList.contains('contestant-cell');
const squeeze = (text) => (text || '').replace(/\s+/g, ' ').trim();

// 一行是哪位参赛者的。原站在行上标了参赛编号；万一没有，就按选手那一格里的主页链接认。
// 表头、底部的统计行不属于谁，返回空。
function keyOf(row) {
  const id = row.getAttribute('participantId');
  if (id) return 'id:' + id;
  const who = [...row.cells].find(isWho);
  if (!who) return '';
  const links = [...who.querySelectorAll('a[href*="/profile/"]')].map((a) =>
    a.getAttribute('href'),
  );
  return links.length ? 'who:' + [...new Set(links)].join(',') : '';
}

/*
 * 表格的隔行底色和四周的边线，是原站自己的脚本在页面载入之后加到格子上的类：
 * 隔一行加 dark，每行第一格加 left、最后一格加 right，最后一行加 bottom。重新取到的页面源码里没有这些类，
 * 直接照着新表格换的话，换过的格子没了底色和边线，没换的也会被对成「没有」。
 * 所以换之前先记下页面上是什么样（记的是规律，不是每一格），换完按新的位置重新加一遍。
 */
const nativeCells = (row) => [...row.cells].filter((cell) => !isOwnCell(cell));
function captureLook(body) {
  const classes = (row, index) => nativeCells(row)[index]?.classList;
  const [first, second] = body;
  const firstDark = Boolean(first && classes(first, 0)?.contains('dark'));
  return {
    firstDark,
    // 前两行底色不一样才是隔行的；一样（或者只有一行）就全按第一行的来。
    striped: Boolean(second) && Boolean(classes(second, 0)?.contains('dark')) !== firstDark,
    frame: first
      ? nativeCells(first).map((cell) =>
          ['left', 'right'].filter((name) => cell.classList.contains(name)),
        )
      : [],
    bottom: Boolean(body.length && classes(body.at(-1), 0)?.contains('bottom')),
  };
}
function applyLook(body, look) {
  body.forEach((row, index) => {
    const dark = look.striped
      ? index % 2 === 0
        ? look.firstDark
        : !look.firstDark
      : look.firstDark;
    const bottom = look.bottom && index === body.length - 1;
    for (const cell of row.cells) {
      cell.classList.toggle('dark', dark);
      cell.classList.toggle('bottom', bottom);
    }
    nativeCells(row).forEach((cell, column) => {
      for (const name of ['left', 'right'])
        cell.classList.toggle(name, Boolean(look.frame[column]?.includes(name)));
    });
  });
}

// 一个格子的原站内容：标签上的属性（类除外，底色和边线的类随位置变）加上里面的内容。
function sourceOf(cell) {
  const attributes = cell
    .getAttributeNames()
    .filter((name) => name !== 'class')
    .map((name) => name + '=' + cell.getAttribute(name));
  return attributes.join(' ') + '>' + cell.innerHTML;
}
// 各个格子上一次换成的原站内容，用来判断这一次有没有变。
const sources = new WeakMap();
// 把页面上的格子改成新格子的样子，格子本身不换（原因见文件开头）。底色和边线的类随后由 applyLook 重新加。
function rewriteCell(cell, next) {
  for (const name of cell.getAttributeNames())
    if (!next.hasAttribute(name)) cell.removeAttribute(name);
  for (const name of next.getAttributeNames()) cell.setAttribute(name, next.getAttribute(name));
  cell.replaceChildren(...next.childNodes);
}

// 把离开这一页的那一行（donor）的格子，改成新进来的这一行（row，刚从新表格里取来的）的样子，
// 再放进 row 里顶替它自己的格子。两边格子数对不上（结构变了）就不动。
function reuseCells(row, donor) {
  const spare = nativeCells(donor);
  const cells = [...row.cells];
  if (spare.length !== cells.length) return;
  cells.forEach((cell, index) => {
    const reused = spare[index];
    const source = sourceOf(cell);
    rewriteCell(reused, cell);
    cell.replaceWith(reused);
    sources.set(reused, source);
  });
}

/*
 * 把一行里原站的格子对成新的。
 * 返回 null：格子数对不上（结构变了），由调用方整行换掉。
 * 否则返回这一行自己的成绩变没变——名次以外的格子有没有确实换了内容的。第一格是名次，别人超过去它也会变，不算。
 */
function syncCells(live, fresh, adopt) {
  const native = [...live.cells].filter((cell) => !isOwnCell(cell));
  // 先把新的一行的格子记下来：下面可能把其中几个挪进页面，挪走之后这一行里的位置就变了。
  const incoming = [...fresh.cells];
  if (native.length !== incoming.length) return null;
  let changed = false;
  native.forEach((cell, index) => {
    const next = incoming[index];
    if (isWho(cell)) return;
    const source = sourceOf(next);
    const known = sources.get(cell);
    if (known === source) return;
    // 第一次对账时还不知道这个格子原来的内容：文字一样就当没变（插件可能改过里面的写法，比如时间格式）。
    if (known === undefined && squeeze(cell.textContent) === squeeze(next.textContent)) {
      sources.set(cell, source);
      return;
    }
    rewriteCell(cell, adopt(next));
    sources.set(cell, source);
    // 第一次对账改掉的格子可能只是写法不同，分不清，不算成绩变了。
    if (index > 0 && known !== undefined) changed = true;
  });
  return changed;
}

// 页面上哪些行在新表格里没有了（这一次要离开这一页）。body 是页面上属于参赛者的行。
function leavingRows(body, fresh) {
  const staying = new Set([...fresh.rows].slice(1).map(keyOf));
  return body.filter((row) => keyOf(row) && !staying.has(keyOf(row)));
}

/*
 * 拿新取到的表格 fresh 和页面上的 table 对账。adopt 把新表格里的节点变成能放进页面的节点。
 * 返回 { added, changed, removed, moved }：
 * added 是新加进来的行，changed 是自己成绩变了的行（都是页面上的行元素的集合）；
 * removed 是去掉了几行，moved 是为了排成新顺序挪了几行。
 */
export function reconcileStandings(
  table,
  fresh,
  adopt = (node) => document.importNode(node, true),
) {
  const rows = [...table.rows];
  const pinned = rows.filter((row, index) => index === 0 || isOwnRow(row));
  const body = rows.filter((row) => !pinned.includes(row));
  noteNative(body);
  const look = captureLook(body);
  const byKey = new Map();
  const loose = [];
  for (const row of body) {
    const key = keyOf(row);
    if (key && !byKey.has(key)) byKey.set(key, row);
    else if (!key) loose.push(row);
  }
  // 这一次要离开这一页的行：它们的格子留给新进来的行用。
  const leaving = leavingRows(body, fresh);
  const kept = new Set();
  const added = new Set();
  const changed = new Set();
  let moved = 0;
  let cursor = pinned.at(-1);
  for (const next of [...fresh.rows].slice(1)) {
    const key = keyOf(next);
    // 不属于谁的行（统计行）按先后顺序一一对应。
    let live = key ? byKey.get(key) : loose.find((row) => !kept.has(row));
    if (live && kept.has(live)) live = null;
    if (live) {
      const result = syncCells(live, next, adopt);
      if (result === null) {
        const copy = adopt(next);
        live.replaceWith(copy);
        live = copy;
      } else if (result && key) changed.add(live);
      // 底部的统计行（Accepted / Tried）数字每次都变，那不是谁的成绩，不算。
    } else {
      live = adopt(next);
      const donor = leaving.pop();
      if (donor) reuseCells(live, donor);
      added.add(live);
    }
    kept.add(live);
    if (cursor.nextElementSibling !== live) {
      cursor.after(live);
      if (!added.has(live)) moved++;
    }
    cursor = live;
  }
  let removed = 0;
  for (const row of body)
    if (!kept.has(row) && row.parentNode) {
      row.remove();
      removed++;
    }
  const settled = [...table.rows].filter((row) => !pinned.includes(row));
  applyLook(settled, look);
  noteAdopted(settled);
  return { added, changed, removed, moved };
}

// 一行里选手的账号（小写）和现在的名次，用来查它原来的名次。认不出来的返回 null。
function standingOf(row) {
  const who = [...row.cells].find(isWho);
  const link = who?.querySelector('a[href*="/profile/"]');
  const handle = link?.getAttribute('href').split('/profile/')[1];
  const rank = parseInt(row.cells[0]?.textContent, 10);
  return handle && Number.isFinite(rank)
    ? { handle: decodeURIComponent(handle).toLowerCase(), rank }
    : null;
}

const TINT = { rise: '#dff5e7', fall: '#fde8e6' };
const EASE = 'cubic-bezier(.2,.8,.2,1)';
// 滑动的时长跟着距离走：近的快，远的慢一些，但不拖太久。
const durationFor = (distance) => Math.round(Math.min(1100, 450 + Math.abs(distance) * 0.35));

// 一行滑动期间浮在别的行上面，各个格子带一层底色，到位后淡回原来的颜色。
function emphasize(row, direction, duration) {
  const { position, zIndex } = row.style;
  row.style.position = 'relative';
  row.style.zIndex = '2';
  const restore = () => {
    row.style.position = position;
    row.style.zIndex = zIndex;
  };
  setTimeout(restore, duration);
  for (const cell of row.cells) {
    const rest = getComputedStyle(cell).backgroundColor;
    cell.animate(
      [
        { backgroundColor: TINT[direction] },
        { backgroundColor: TINT[direction], offset: 0.7 },
        { backgroundColor: rest },
      ],
      { duration: duration + 600, easing: 'ease-out' },
    );
  }
}

/*
 * 换完之后的过渡。tops 是换之前各行的位置；info 是对账的结果；
 * previousRanks 是「账号 → 上一次的名次」，用来判断新进这一页的行是从上面还是下面来的，查不到就原地淡入。
 */
function animateRows(table, tops, { added, changed }, previousRanks) {
  if (still()) return;
  const bounds = table.getBoundingClientRect();
  for (const row of table.rows) {
    if (!row.animate) return;
    const now = row.getBoundingClientRect();
    const before = tops.get(row);
    if (before !== undefined) {
      const shift = before - now.top;
      if (Math.abs(shift) < 0.5) continue;
      const duration = durationFor(shift);
      row.animate([{ transform: `translateY(${shift}px)` }, { transform: 'none' }], {
        duration,
        easing: EASE,
      });
      if (changed.has(row)) emphasize(row, shift > 0 ? 'rise' : 'fall', duration);
      continue;
    }
    // 新进这一页的行：原来名次靠后的从下面上来，原来靠前的从上面下来。起点不超出表格，也不离窗口太远。
    const standing = added.has(row) ? standingOf(row) : null;
    const previous = standing ? previousRanks.get(standing.handle) : undefined;
    let offset = 0;
    if (Number.isFinite(previous) && previous !== standing.rank) {
      offset =
        previous > standing.rank
          ? Math.max(0, Math.min(bounds.bottom - now.height, window.innerHeight) - now.top)
          : Math.min(0, Math.max(bounds.top, -now.height) - now.top);
    }
    if (Math.abs(offset) < now.height) {
      row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
      continue;
    }
    const duration = durationFor(offset);
    row.animate(
      [
        { transform: `translateY(${offset}px)`, opacity: 0 },
        { opacity: 1, offset: 0.25 },
        { transform: 'none', opacity: 1 },
      ],
      { duration, easing: EASE },
    );
    emphasize(row, offset > 0 ? 'rise' : 'fall', duration);
  }
}

const still = () => document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches;
const LEAVE = { duration: 220, easing: 'ease-in', fill: 'forwards' };

/*
 * 要离开这一页的行先退场：朝它去的那一边挪大半行的高度，同时淡出。等它们退完再换表格。
 * 往哪边去，看这个人在前后两份快照里的名次（previousRanks、nextRanks）：名次变小是往上，变大是往下；
 * 查不到或者没变的，原地淡出。返回一个收尾的函数：换完表格后调用，万一有行没被换掉，把它恢复原样。
 */
async function dismissRows(rows, previousRanks, nextRanks) {
  const leaving = rows.filter((row) => row.animate);
  if (!leaving.length || still()) return () => {};
  const heights = leaving.map((row) => row.getBoundingClientRect().height);
  const animations = leaving.map((row, index) => {
    const standing = standingOf(row);
    const before = standing ? previousRanks.get(standing.handle) : undefined;
    const after = standing ? nextRanks.get(standing.handle) : undefined;
    const side = Number.isFinite(before) && Number.isFinite(after) ? Math.sign(after - before) : 0;
    return row.animate(
      [
        { transform: 'none', opacity: 1 },
        { transform: `translateY(${side * heights[index] * 0.6}px)`, opacity: 0 },
      ],
      LEAVE,
    );
  });
  await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
  return () => animations.forEach((animation) => animation.cancel());
}

// 连着取不到几次（网络问题，或者被原站的人机验证拦下）就不再试，免得白白发请求；重新载入页面后重新算。
const GIVE_UP_AFTER = 2;
let failures = 0;

/*
 * 重新取当前页，拿到里面最新的榜单表格。取不到（网络问题、被拦下、请求被取消、已经不再试）返回 null，不抛错。
 * 取和换分成两步：预测用的成绩是开始刷新时向接口要的，算完要好几秒；表格要是等算完再取，就比预测新了一截，
 * 这几秒里过了题的人，表格上是新名次，预测各列却还是按旧成绩算的。所以表格在向接口要成绩的同一刻取，算完再换上去。
 */
export async function fetchStandingsTable(signal) {
  if (failures >= GIVE_UP_AFTER || !document.querySelector('table.standings')) return null;
  try {
    const response = await fetchCurrentPage(signal);
    if (!response.ok) return null;
    const page = new DOMParser().parseFromString(await response.text(), 'text/html');
    return page.querySelector('table.standings');
  } catch {
    return null;
  }
}

/*
 * 把榜单表格换成取到的 fresh（fetchStandingsTable 的结果）。换了返回 true。用户正在表格里选文字时这一次先不换。
 * settle 在换完之后、量位置之前立刻调用：新加的行要先补上头像、预测各列这些，行高才是最终的，
 * 不然过渡是按没补之前的高度算的，补上之后表格会突然高出一截。
 * previousRanks 见 animateRows；nextRanks 是新快照里各人的名次，和它一起用来判断离开这一页的行往哪边退（见 dismissRows）。
 */
export async function applyStandingsTable(
  fresh,
  { settle = () => {}, previousRanks = new Map(), nextRanks = new Map() } = {},
) {
  const table = document.querySelector('table.standings');
  if (!table || table.rows.length < 2 || failures >= GIVE_UP_AFTER) return false;
  const selection = document.getSelection?.();
  if (selection && !selection.isCollapsed && table.contains(selection.anchorNode)) return false;
  // 表头的列数对不上，说明取到的不是同一张表，不动。
  const columns = [...table.rows[0].cells].filter((cell) => !isOwnCell(cell)).length;
  if (!fresh || fresh.rows.length < 2 || fresh.rows[0].cells.length !== columns) {
    failures++;
    return false;
  }
  failures = 0;
  const body = [...table.rows].filter((row, index) => index > 0 && !isOwnRow(row));
  const restore = await dismissRows(leavingRows(body, fresh), previousRanks, nextRanks);
  if (!table.isConnected) {
    restore();
    return false;
  }
  const tops = new Map([...table.rows].map((row) => [row, row.getBoundingClientRect().top]));
  const info = reconcileStandings(table, fresh);
  // 退场的行这时已经不在表格里了；万一还在（没被换掉），恢复原样。
  restore();
  watchNativeActions(table);
  settle();
  animateRows(table, tops, info, previousRanks);
  return true;
}
