// 原站个人主页的评级图：让它的悬停提示可以点击固定，用法和面板里的对比曲线一样。
//
// 原站的做法：鼠标停到曲线上的一个点，就在点的右上方放一个提示（页面上 id 为 tooltip 的元素），
// 并定一个四秒后让提示淡出的计时。计时是每停一次就定一个、互不取消的，所以先后停过几个点之后，
// 后一个提示常常刚出来就被前一个点的计时带走，里面的比赛链接来不及点。
//
// 这里不改原站的脚本，只在旁边加一层：点一下曲线上的点，就把这时的提示照原样复制一份留在原处，
// 复制的这份不受原站的计时影响，可以慢慢点里面的链接。再点同一个点、点别处、按 Esc、
// 鼠标进过提示又移出去，都会放开。只在开着用户数据分析时生效。
import { appSettings, subscribeSettings } from '../../../settings.js';

const GRAPH = '#usersRatingGraphPlaceholder';
const SITE_TIP = 'tooltip';
const PINNED_ID = 'cf-rating-tip-pinned';
// 固定着的时候给页面根元素加的类：原站自己的提示这时不显示，免得和固定的那份叠在一起。
const PINNED_CLASS = 'cf-rating-tip-is-pinned';
// 鼠标停在点上时给评级图加的类：换成手型光标，提示这里可以点。
const POINTING_CLASS = 'cf-rating-graph-pointing';
// 原站把提示放在点的右上方：提示的左边缘在点右边 10 像素，上边缘在点上面 20 像素。
const TIP_OFFSET = { x: 10, y: -20 };
// 鼠标离点多近算是点在这个点上。原站判断悬停用的也是差不多大的范围。
const REACH = 12;

// 鼠标底下那个点的提示：原站的提示正显示着，并且鼠标就在它对应的点上时返回它，否则返回 null。
// 提示显示之后鼠标可能已经移开了，所以要按位置核对，不能只看提示在不在。
function tipUnder(event) {
  const tip = document.getElementById(SITE_TIP);
  if (!tip || getComputedStyle(tip).display === 'none') return null;
  const box = tip.getBoundingClientRect();
  const x = box.left - TIP_OFFSET.x;
  const y = box.top - TIP_OFFSET.y;
  return Math.hypot(event.clientX - x, event.clientY - y) <= REACH ? tip : null;
}
// 提示对应的是哪个点：用它在页面上的位置来认。
const placeOf = (tip) => `${tip.style.left}|${tip.style.top}`;

export function startOfficialGraphPin() {
  const graph = document.querySelector(GRAPH);
  if (!graph) return;
  const enabled = () => appSettings.user.analytics.enabled;
  let pinned = null;
  // 鼠标进过固定着的提示没有；进过之后再移出去才放开。
  let visited = false;

  function unpin() {
    if (!pinned) return;
    const leaving = pinned;
    pinned = null;
    visited = false;
    document.documentElement.classList.remove(PINNED_CLASS);
    // 淡出后再拿掉；淡出期间不再接受鼠标。
    leaving.style.pointerEvents = 'none';
    leaving.removeAttribute('id');
    const fade = leaving.animate?.([{ opacity: 1 }, { opacity: 0 }], {
      duration: 140,
      easing: 'ease-out',
    });
    if (fade) fade.finished.then(() => leaving.remove()).catch(() => leaving.remove());
    else leaving.remove();
  }
  function pin(tip) {
    pinned = tip.cloneNode(true);
    pinned.id = PINNED_ID;
    pinned.dataset.place = placeOf(tip);
    // 原站的提示是半透明的，而且可能正淡入到一半；固定的这份不透明。
    pinned.style.opacity = '';
    pinned.style.display = 'block';
    pinned.addEventListener('mouseenter', () => (visited = true));
    pinned.addEventListener('mouseleave', () => visited && unpin());
    document.body.appendChild(pinned);
    document.documentElement.classList.add(PINNED_CLASS);
  }

  graph.addEventListener('click', (event) => {
    if (!enabled()) return;
    const tip = tipUnder(event);
    // 点的正是固定着的那个点：放开。点的是另一个点：换到那个点上。点在空白处：放开。
    const again = pinned && tip && pinned.dataset.place === placeOf(tip);
    unpin();
    if (tip && !again) pin(tip);
  });
  // 鼠标停在点上时换成手型光标。
  graph.addEventListener('mousemove', (event) => {
    graph.classList.toggle(POINTING_CLASS, enabled() && Boolean(tipUnder(event)));
  });
  graph.addEventListener('mouseleave', () => graph.classList.remove(POINTING_CLASS));
  // 滚轮缩放之后点的位置变了，固定着的提示对不上了，放开。
  graph.addEventListener('wheel', unpin, { passive: true });
  // 点了评级图和提示以外的地方：放开。评级图上的点击由上面的处理决定。
  document.addEventListener('pointerdown', (event) => {
    if (!pinned || pinned.contains(event.target) || graph.contains(event.target)) return;
    unpin();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') unpin();
  });
  // 关掉用户数据分析时一并放开。
  subscribeSettings(() => {
    if (!enabled()) {
      unpin();
      graph.classList.remove(POINTING_CLASS);
    }
  });
}
