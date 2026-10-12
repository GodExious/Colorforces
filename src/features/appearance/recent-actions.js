// 侧栏「最新动态」的格式化。
//
// 原站的每条动态是连成一段的文字：作者、箭头、标题、图标。标题长的折到第二行，每条的高度和断行位置都不一样。
// 格式化后每条分成两行：第一行是作者（连同插件加的头像），图标靠右排成一列；标题另起一行，完整显示，
// 和作者名的左边对齐（也可以选不缩进，从最左边起）；条目之间有一条分隔线。
//
// 这里只给每条动态里的各个部分标上类名，把夹在中间的箭头、空格和末尾的图标各包起来，先后顺序不变，也不删除任何东西；
// 排法全在样式里（styles/codeforces/appearance/recent-actions.css），由页面根元素上的一个类名开关。
// 所以关掉这项设置后样式不再生效，页面就是原样，不需要还原什么。
import { appSettings } from '../../settings.js';

const ROOT_CLASS = 'cf-format-recent-actions';
// 标题不缩进时给页面根元素加的类名。
const FLUSH_CLASS = 'cf-recent-actions-flush';
const LIST = '.recent-actions';

// 给还没标过的动态标上类名。
function mark(list) {
  for (const item of list.querySelectorAll('li > div:not(.cf-recent-action)')) {
    const children = [...item.children];
    const user = children.find((element) => element.matches('a[href*="/profile/"]'));
    const title = children.find((element) => element.matches('a[href*="/blog/entry/"]'));
    // 认不出作者和标题的（原站换了结构，或者是别的样子的条目）不动它。
    if (!user || !title) continue;
    // 夹在中间的文字（箭头、不换行的空格）各包进一个元素，样式才藏得住它们；只有普通空白的不用管。
    for (const node of [...item.childNodes]) {
      if (node.nodeType !== Node.TEXT_NODE || !/[^ \t\n\r\f]/.test(node.data)) continue;
      const wrap = document.createElement('span');
      wrap.className = 'cf-recent-action-sep';
      node.replaceWith(wrap);
      wrap.appendChild(node);
    }
    // 标题后面的图标（有新评论、正文有更新、挖坟）收进一个容器，连同它们之间的空白，原来的先后顺序不变。
    // 容器就放在第一个图标原来的位置上，不格式化时看起来和原来一样。
    const icons = children.filter((element) => element.tagName === 'IMG');
    if (icons.length) {
      const box = document.createElement('span');
      box.className = 'cf-recent-action-icons';
      icons[0].before(box);
      while (box.nextSibling && box.nextSibling !== icons.at(-1)) box.appendChild(box.nextSibling);
      box.appendChild(icons.at(-1));
    }
    user.classList.add('cf-recent-action-user');
    title.classList.add('cf-recent-action-title');
    item.classList.add('cf-recent-action');
  }
}

let switching = 0;
// 按设置开关格式化。animate 为真时（用户刚改了设置）带过渡：列表先淡出，换好排法后淡入，高度同时过渡到新值；
// 页面刚打开时不带。
export function applyRecentActionsFormat({ animate = false } = {}) {
  const root = document.documentElement;
  const list = document.querySelector(LIST);
  const wanted = () => Boolean(appSettings.appearance.formatRecentActions);
  if (list) mark(list);
  // 标题缩进与否只是一处留白的变化，样式里有过渡，直接切换就行。
  root.classList.toggle(FLUSH_CLASS, !appSettings.appearance.indentRecentActionTitles);
  if (root.classList.contains(ROOT_CLASS) === wanted()) return;
  const moving =
    animate &&
    list?.animate &&
    list.getClientRects().length &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!moving) {
    root.classList.toggle(ROOT_CLASS, wanted());
    return;
  }
  const turn = ++switching;
  const from = list.offsetHeight;
  const fade = list.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 110,
    easing: 'ease-in',
    fill: 'forwards',
  });
  const settle = () => {
    // 淡出的过程中又改了一次设置：由后一次来收尾。
    if (turn !== switching) return;
    root.classList.toggle(ROOT_CLASS, wanted());
    const to = list.offsetHeight;
    list.animate(
      [
        { opacity: 0, height: `${from}px`, overflow: 'clip' },
        { opacity: 1, height: `${to}px`, overflow: 'clip' },
      ],
      { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' },
    );
    fade.cancel();
  };
  fade.finished.then(settle, settle);
}
