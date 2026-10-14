// 页面上用户名后面的分组标签。
// 不往页面里加节点：只在一个已有的元素上写几个属性和变量（标签的文字、样子、宽度、颜色），标签由样式用 ::after 画出来
// （styles/codeforces/user/groups.css）。这样链接里的文字不变，头像、队伍排版和原站自己的脚本照旧按名字认人；
// 属性不算页面内容的改动，也不会让页面观察器再跑一轮。
// 写在哪个元素上（见 hostOf）：表格里要让标签排在名字后面那些小记号（虚拟参赛的 # 等）的后面，
// 所以写在包着「名字和小记号」的那一层上——头像功能包出来的那一行，没有那一行时就是表格的格子；
// 不在表格里的（博客、侧栏、个人主页），写在用户的主页链接上，标签紧跟着名字。
// 一个人只显示一个标签：排在最前的那个自建分组；一个都不在但是好友时显示「好友」。
// 标签有两种样子（设置里选）：写分组名的小块，或者只画分组小标的小圆。
import { appSettings } from '../../../settings.js';
import { translate as t } from '../../../i18n/index.js';
import { menuTabColor } from '../../../utils/petal-palette.js';
import { getCurrentUserHandle } from '../../page/account.js';
import { PLUGIN_UI_SELECTOR } from '../../page/plugin-ui.js';
import { readAccount } from './data.js';
import { everyoneIn, listGroups, markGroupOf, shownMark, userId } from './store.js';

const ATTRIBUTE = 'data-cf-group';
const COLOR = '--cf-group-color';
// 标签的宽度。展开、收起要按确切的宽度过渡才看得出来，所以先量好写在这里（见 widthOf）。
const WIDTH = '--cf-group-width';
// 画成小标时带上这个属性，样式按它换成小圆：'mark' 是一个字符（或没有，画色点），正圆；'marks' 是两个字符，一个短的圆角条。
const KIND = 'data-cf-group-kind';
// 标签的文字或样子要换（换了语言、分组改了名、换了样式）时先带上这个属性收起来，收好了再换、展开。
const LEAVING = 'data-cf-group-out';
// 分组的名字，鼠标移到标签上时提示用（见 groupTagAt）。
const TITLE = 'data-cf-group-title';
// 标签和它前面的内容之间隔这么多像素（样式里定的 margin-left）。
const GAP = 4;
const SWAP_TIME = 200;
const USER_LINK = 'a[href*="/profile/"]';
const LINE = '.cf-avatar-line-wrapper';

// 小写账号名 → { name, title, color, kind }：name 是标签里的文字，title 是分组的名字，
// kind 是 'name'、'mark' 或 'marks'。分组、设置或语言变了就丢掉重算。
let tags = null;
function buildTags() {
  const built = new Map();
  const owner = getCurrentUserHandle();
  const account = owner ? readAccount(owner) : null;
  if (!account) return built;
  const groups = new Map(listGroups(account).map((group) => [group.id, group]));
  // 没设颜色的分组用分组页的主题色。
  const plain = menuTabColor('groups');
  const asMark = appSettings.groups.tagStyle === 'mark';
  const tagOf = (group) => {
    const title = group.builtin ? t('groupsFriends') : group.name;
    if (!asMark) return { name: title, title, kind: 'name' };
    const chars = shownMark(group);
    return { name: chars.join(''), title, kind: chars.length > 1 ? 'marks' : 'mark' };
  };
  for (const handle of everyoneIn(account)) {
    const group = groups.get(markGroupOf(account, handle));
    if (!group) continue;
    built.set(userId(handle), { ...tagOf(group), color: group.color || plain });
  }
  return built;
}

// 一个标签画出来有多宽（像素）。写分组名的、两个字符的小标要量：放进一个看不见的元素里，它的字和留白与标签一样。
// 同样的文字只量一次。
let ruler = null;
const widths = new Map();
function widthOf(tag) {
  if (tag.kind === 'mark') return tag.name ? 16 : 8;
  const key = tag.kind + '\n' + tag.name;
  if (!widths.has(key)) {
    if (!ruler) {
      ruler = document.createElement('span');
      ruler.id = 'cf-group-tag-ruler';
      document.body.appendChild(ruler);
    }
    ruler.dataset.kind = tag.kind;
    ruler.textContent = tag.name;
    widths.set(key, Math.ceil(ruler.getBoundingClientRect().width));
  }
  return widths.get(key);
}

// 这个链接该不该有标签，有的话是哪个；没有返回 null。
function tagFor(link) {
  const match = /\/profile\/([^/?#]+)(?:[?#]|$)/.exec(link.getAttribute('href') || '');
  let handle = '';
  try {
    handle = match ? decodeURIComponent(match[1]) : '';
  } catch {
    // 地址里的编码不完整：不当成用户链接。
  }
  const tag = handle ? tags.get(userId(handle)) : null;
  // 只标文字就是用户名的链接（「查看主页」之类的不标），插件自己界面里的也不标。
  return tag &&
    link.textContent.trim().toLowerCase() === handle.toLowerCase() &&
    !link.closest(PLUGIN_UI_SELECTOR)
    ? tag
    : null;
}
const usersIn = (element) =>
  element.querySelectorAll(`${USER_LINK}:not(.cf-avatar-container)`).length;
// 名字后面算「小记号」的元素：上标、下标、小字，以及插件自己加的东西。
const isSmallMark = (node) =>
  ['SUP', 'SUB', 'SMALL'].includes(node.tagName) ||
  node.hasAttribute('data-cf-prediction') ||
  (typeof node.className === 'string' && /(^|\s)cf-/.test(node.className));
// 链接直接放在表格的格子里、格子里只有这一个用户、名字后面除了小记号和空白没有别的东西时，返回这个格子。
// 这样的格子可以拿来写标签：标签画在格子内容的最后，正好在小记号后面。名字后面还有别的文字的不行，标签会跑到那些字后面去。
function cellOf(link) {
  const cell = link.parentElement;
  if (cell?.tagName !== 'TD' || usersIn(cell) !== 1) return null;
  for (let node = link.nextSibling; node; node = node.nextSibling) {
    if (node.nodeType === 3 ? node.textContent.trim() : node.nodeType === 1 && !isSmallMark(node))
      return null;
  }
  return cell;
}
// 标签写在哪个元素上，依次看：头像功能包出来的那一行（里面只有这一个用户时）；上面说的那种表格格子；都不是就是链接自己。
function hostOf(link) {
  const line = link.closest(LINE);
  if (line && usersIn(line) === 1) return line;
  return cellOf(link) || link;
}

// 把标签的文字、样子、宽度写到元素上。
function write(host, tag) {
  const width = widthOf(tag);
  host.setAttribute(ATTRIBUTE, tag.name);
  if (tag.kind === 'name') host.removeAttribute(KIND);
  else host.setAttribute(KIND, tag.kind);
  host.style.setProperty(WIDTH, width + 'px');
  host.setAttribute(TITLE, tag.title);
}
const shows = (host, tag) =>
  host.getAttribute(ATTRIBUTE) === tag.name && (host.getAttribute(KIND) || 'name') === tag.kind;

// 正收起来、等着换的元素 → 要换成的标签。
const swapping = new Map();
function finishSwaps() {
  for (const [host, tag] of swapping) {
    write(host, tag);
    host.removeAttribute(LEAVING);
  }
  swapping.clear();
}
function swap(host, tag) {
  if (!swapping.size) setTimeout(finishSwaps, SWAP_TIME);
  swapping.set(host, tag);
  host.setAttribute(LEAVING, '');
}

function clear(host) {
  swapping.delete(host);
  host.removeAttribute(ATTRIBUTE);
  host.removeAttribute(KIND);
  host.removeAttribute(LEAVING);
  host.style.removeProperty(COLOR);
  host.style.removeProperty(WIDTH);
  host.removeAttribute(TITLE);
}
function mark(host, tag) {
  // 带着「正收起」的记号、却不在等着换字的名单里：是队伍的格子按存下的内容重排时带回来的，去掉。
  if (host.hasAttribute(LEAVING) && !swapping.has(host)) host.removeAttribute(LEAVING);
  // 新标上的直接写（样式里有展开的动画）；已经有标签、只是文字或样子变了的，收起来再换。
  if (!host.hasAttribute(ATTRIBUTE)) write(host, tag);
  else if (swapping.has(host)) swapping.set(host, tag);
  else if (!shows(host, tag)) swap(host, tag);
  if (host.style.getPropertyValue(COLOR) !== tag.color) host.style.setProperty(COLOR, tag.color);
  // 提示里的分组名单独跟：画成小标时标签上的图标不随语言变，上面两步不会重写，名字却要换（好友 / Friends）。
  if (!swapping.has(host) && host.getAttribute(TITLE) !== tag.title)
    host.setAttribute(TITLE, tag.title);
}

// 标签是画出来的，不是一个元素，鼠标移上去时浏览器只说「在这个元素上」。要给标签单独做悬停的提示，只能按位置算：
// 标签排在这个元素里所有内容的后面，隔开 GAP，宽度是写下的那个数（被样式限了宽、或者被挤窄时到元素的右边为止）。
// host 是带着标签的元素，x 是鼠标的横坐标。鼠标在标签上时返回 { rect, title }：rect 是标签的位置，
// title 是该提示的分组名——小标上看不出名字、太长的分组名被省略了，这两种情况才有，否则是空串。不在标签上返回 null。
export function groupTagAt(host, x) {
  const width = parseFloat(host.style.getPropertyValue(WIDTH));
  if (!(width > 0) || host.hasAttribute(LEAVING)) return null;
  if (document.documentElement.classList.contains('cf-hide-groupTags')) return null;
  const range = document.createRange();
  range.selectNodeContents(host);
  const inner = range.getBoundingClientRect();
  if (!inner.width && !inner.height) return null;
  const left = inner.right + GAP;
  const right = Math.min(left + width, Math.max(left, host.getBoundingClientRect().right));
  if (right - left < 2 || x < left - 1 || x > right + 1) return null;
  const top = (inner.top + inner.bottom) / 2 - 8;
  const cut = width - (right - left) > 0.5;
  return {
    rect: { left, right, top, bottom: top + 16, width: right - left, height: 16 },
    title: host.hasAttribute(KIND) || cut ? host.getAttribute(TITLE) || '' : '',
  };
}

// 给页面上的用户名补上（或去掉、换掉）分组标签。可以反复调用：已经对的不动。
// 功能关着时什么都不做：已有的标签留在原处，由样式收起来，这样开关来回切换时有过渡。
export function applyGroupTags() {
  if (!appSettings.groups.enabled) return;
  tags ||= buildTags();
  const hosts = new Set();
  // 一个标签都没有时不用找链接，下面把以前标过的清掉就行。
  if (tags.size)
    for (const link of document.querySelectorAll(USER_LINK)) {
      const tag = tagFor(link);
      if (!tag) continue;
      const host = hostOf(link);
      hosts.add(host);
      mark(host, tag);
    }
  // 不该再有标签的：人不在分组里了，或者链接后来被包进了头像那一行、标签挪到了那一层上。
  for (const host of document.querySelectorAll(`[${ATTRIBUTE}]`)) if (!hosts.has(host)) clear(host);
}

// 分组、设置或语言变了：按新的重新标一遍。
export function refreshGroupTags() {
  tags = null;
  applyGroupTags();
}
