// 页面上头像的头像框。头像功能（avatars/enhance.js）在名字前面放了头像（.cf-avatar-slot），这里给它套上头像框；
// 个人主页上的标题照片换成带头像框的圆形大头像。谁戴哪个见 choose.js，图片见 catalog.js，样子见
// styles/codeforces/user/frames.css。
// 每个头像框是叠在头像上的两张图片：静止的和会动的，显示哪张由根元素上的动效设置决定（关闭、悬停时、始终），
// 换设置不用重新标。
import { appSettings } from '../../../settings.js';
import { appStorage } from '../../../storage/gm.js';
import { AVATAR_CACHE_KEY } from '../../../storage/keys.js';
import { getCurrentUserHandle } from '../../page/account.js';
import { PLUGIN_UI_SELECTOR } from '../../page/plugin-ui.js';
import { readAccount } from '../groups/data.js';
import { requestProfiles } from '../groups/profiles.js';
import { frameOf, profileHandle, userId } from '../groups/store.js';
import { chooseFrame, rankFromTitle } from './choose.js';
import { pageAdmins } from './admins.js';
import {
  KNOWN_FRAMES,
  frameArt,
  frameImage,
  frameReach,
  measuredReach,
  wearableFrame,
} from './catalog.js';
import { subscribeCustomFrames } from './custom/data.js';
import { avatarShownAt, pagePlaceOf } from '../avatars/places.js';

// 旧的头像框淡出要多久，到时候从页面上拿掉。
const LEAVE_TIME = 240;
// 头像四周让出（或收回）那一圈边距要多久（和样式里 margin 的过渡一样长）。
const SPACE_TIME = 260;
const USER_LINK = 'a[href*="/profile/"]';

// 一个头像框：一层外壳，里面叠着静止的、会动的两层，各是一个带着图片类的空元素（见 catalog.js 的 frameArt）。
// 刚放上去时外壳淡入一下（is-entering，淡入完就去掉）；afterSpace 为真时等四周的边距让出来了再淡入（is-after-space）。
function frameNodes(id, afterSpace) {
  const pair = document.createElement('span');
  pair.className = `cf-frame-pair is-entering${afterSpace ? ' is-after-space' : ''}`;
  pair.setAttribute('aria-hidden', 'true');
  pair.addEventListener('animationend', () => pair.classList.remove('is-entering'), { once: true });
  for (const moving of [false, true]) {
    const art = document.createElement('span');
    art.className = `cf-frame ${moving ? 'is-live' : 'is-still'} ${frameArt(id, moving)}`;
    pair.appendChild(art);
  }
  return pair;
}
// 给放头像的元素戴上头像框（id 为空就是摘掉）。已经是这个就不动；换了的，旧的淡出后拿掉，新的淡入。
// 头像四周的那一圈边距（cf-frame-space，见样式）和框分两步走，框不跟着头像滑：
// 戴上时先让出边距、头像挪到位，框再淡入；摘掉时框先在原处淡掉，再收回边距。换成另一个框时边距不变，直接换。
// cf-has-frame 是「框可以伸到头像外面」，摘掉时等边距收完再去掉。
// 自定义的头像框改了代码时编号不变、图片换了（cfFrameArt 记着用的是哪张），也按换成另一个框处理。
function wearFrame(box, id) {
  const before = box.dataset.cfFrame ?? '';
  const art = id ? frameImage(id, false) : '';
  if (before === id && (box.dataset.cfFrameArt ?? '') === art) return;
  box.dataset.cfFrame = id;
  box.dataset.cfFrameArt = art;
  clearTimeout(Number(box.dataset.cfFrameTimer));
  for (const old of box.querySelectorAll(':scope > .cf-frame-pair:not(.is-leaving)')) {
    old.classList.add('is-leaving');
    setTimeout(() => old.remove(), LEAVE_TIME);
  }
  if (id) {
    box.classList.add('cf-has-frame', 'cf-frame-space');
    box.append(frameNodes(id, !before));
    return;
  }
  box.dataset.cfFrameTimer = String(
    setTimeout(() => {
      box.classList.remove('cf-frame-space');
      box.dataset.cfFrameTimer = String(
        setTimeout(() => box.classList.remove('cf-has-frame'), SPACE_TIME),
      );
    }, LEAVE_TIME),
  );
}

// 换掉一块内容时，外面那一层的高度从旧的滑到新的（个人主页的照片框：照片和带框的大头像高度不一样）。
function morphHeight(holder, change) {
  const from = holder.getBoundingClientRect().height;
  change();
  const to = holder.getBoundingClientRect().height;
  if (
    !holder.animate ||
    Math.abs(from - to) < 1 ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return;
  holder.animate(
    [
      { height: from + 'px', overflow: 'hidden' },
      { height: to + 'px', overflow: 'hidden' },
    ],
    { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  );
}

// 这一轮要用的东西：头像缓存（按小写名字）、自己（小写名字，没登录时是空串）和自己的分组、段位头像框的设置、这一页上的管理员。
function context() {
  const cache = new Map();
  const stored = appStorage.getJSON(AVATAR_CACHE_KEY, null);
  if (stored && typeof stored === 'object')
    for (const [handle, entry] of Object.entries(stored))
      if (entry && typeof entry === 'object') cache.set(userId(handle), entry);
  const me = getCurrentUserHandle() || '';
  return {
    cache,
    me: me && userId(me),
    account: me && appSettings.groups.enabled ? readAccount(me) : null,
    mode: appSettings.user.avatar.rankFrame,
    admins: pageAdmins(),
  };
}
// 一个人戴哪个。title 是页面上这个人名字的提示（「段位 名字」），读得出段位就用它，读不出用缓存里记的。
// admin 为真表示页面上这个名字是管理员的样子（提示里没写段位时，靠名字的颜色类认出来）。
function frameFor(handle, title, { cache, me, account, mode, admins }, admin = false) {
  // 关掉了「显示头像框」：谁都不戴。
  if (!appSettings.user.avatar.frames) return '';
  const entry = cache.get(userId(handle));
  const shown = rankFromTitle(title, handle);
  const stored = entry && !entry.missing && typeof entry.rank === 'string' ? entry.rank : undefined;
  return chooseFrame({
    // 自己从库里戴的；段位、特别款不能手动戴，记着的也不算。
    worn:
      me && userId(handle) === me && wearableFrame(appSettings.user.avatar.wornFrame)
        ? appSettings.user.avatar.wornFrame
        : '',
    group: account ? frameOf(account, handle) : '',
    rank: shown === 'headquarters' ? undefined : (shown ?? stored),
    maxRank: entry && typeof entry.maxRank === 'string' ? entry.maxRank : undefined,
    admin: admin || shown === 'headquarters' || admins.has(userId(handle)),
    mode,
    known: KNOWN_FRAMES,
  });
}

// 「最高段位」要用缓存里记的最高段位，可是这一项是这次才开始记的，之前写进去的条目里没有。
// 选了「最高段位」时，页面上缺这一项的人（缓存里有、但没有最高段位）合成一次请求补上，补到了全部重新看一遍。
// 每个人只补一次；只用「当前段位」时不补。缓存里还没有的人不在这里查，头像功能会去查，查到的条目里就有最高段位。
const backfilled = new Set();
function lacksMaxRank(handle, { cache, mode }) {
  if (mode !== 'max' || backfilled.has(userId(handle))) return false;
  const entry = cache.get(userId(handle));
  return Boolean(entry) && !entry.missing && typeof entry.maxRank !== 'string';
}
function backfillMaxRanks(handles) {
  if (!handles.length) return;
  for (const handle of handles) backfilled.add(userId(handle));
  requestProfiles(handles, { force: true })
    .then(() => applyFrames(true))
    .catch(() => {});
}

// 头像是谁的，鼠标停在哪里算「移到了这个人上面」（动效设成悬停时用），名字的提示在哪个链接上。
// 表格里头像是单独的一个链接，和名字一起包在头像那一行里；别处头像画在名字的链接里面。
function ownerOf(slot) {
  const avatar = slot.parentElement?.closest('a.cf-avatar-container');
  if (avatar) {
    const host = avatar.closest('.cf-avatar-line-wrapper') || avatar;
    const name = host.querySelector(`${USER_LINK}:not(.cf-avatar-container)`);
    return {
      handle: profileHandle(avatar.getAttribute('href')),
      host,
      title: name?.title,
      admin: Boolean(name?.classList.contains('user-admin')),
    };
  }
  const link = slot.closest(USER_LINK);
  if (!link) return null;
  return {
    handle: profileHandle(link.getAttribute('href')),
    host: link,
    title: link.title,
    admin: link.classList.contains('user-admin'),
  };
}

// 显示位置（设置里的「显示位置」）：在表格里的头像（榜单、提交记录这些表格）算 tables，别处的算 others；
// 个人主页的大头像是 profile，见 applyProfilePhoto。关掉的地方不戴，头像照旧。
// 头像本身在那一处不显示时也不戴（见 avatars/places.js），收起的头像上不留会动的图。
const shownAt = (place) =>
  appSettings.user.avatar.frameAt[place] !== false && (place === 'profile' || avatarShownAt(place));

// 个人主页的大头像上下留多少：这个头像框实际伸出去的那么多再多 6px（大头像 200px，一个单位 2.5px）。
// 写在大头像的两个变量上，换头像框时边距滑过去（样式里有过渡）。还没量好时不动，量不了时用样式里的默认值（按伸得最高的留）。
const PROFILE_UNIT = 200 / 80;
function fitProfileFrame(box, reach) {
  if (!reach) return;
  box.style.setProperty('--cf-frame-top', Math.round(reach.up * PROFILE_UNIT) + 6 + 'px');
  box.style.setProperty('--cf-frame-bottom', Math.round(reach.down * PROFILE_UNIT) + 6 + 'px');
}

// 个人主页：标题照片（任意比例的图）换成圆形的大头像，套上这个人的头像框；他不戴头像框时照旧显示原来的照片。
// 主页上的名字不在头像功能处理的范围里（原站自己有大照片），缓存里可能还没有这个人：没有就去读一次他的资料，
// 读到了再看一遍（「最高段位」要用资料里的最高段位）。每个主页只读一次。
let profileAsked = '';
function applyProfilePhoto(ctx) {
  const handle = profileHandle(location.pathname);
  const photo = handle && document.querySelector('.title-photo img:not(.cf-profile-photo)');
  if (!photo || photo.closest('.badge')) return;
  const holder = photo.parentElement;
  holder.dataset.cfProfileChecked = '';
  // 关掉了头像，或者主页不显示头像框：换回原来的照片（下面 id 为空的那一段），也不用去读资料。
  const wanted = appSettings.user.avatar.enabled && shownAt('profile');
  if (wanted && lacksMaxRank(handle, ctx)) backfillMaxRanks([handle]);
  if (wanted && !ctx.cache.has(userId(handle)) && profileAsked !== userId(handle)) {
    profileAsked = userId(handle);
    requestProfiles([handle])
      .then(() => applyFrames(true))
      .catch(() => {});
  }
  // 主页上段位写在名字上面那一行（管理员写着 Headquarters）。
  const name = document.querySelector('.main-info h1 a');
  const rankLine = document
    .querySelector('.main-info .user-rank')
    ?.textContent.trim()
    .toLowerCase();
  const admin = rankLine === 'headquarters' || Boolean(name?.classList.contains('user-admin'));
  const id = wanted ? frameFor(handle, name?.title, ctx, admin) : '';
  let box = holder.querySelector(':scope > .cf-profile-frame');
  if (!id) {
    if (box) {
      morphHeight(holder, () => {
        box.remove();
        holder.classList.remove('cf-photo-framed');
        holder.closest('.title-photo > div')?.classList.remove('cf-photo-box-framed');
      });
      photo.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
    }
    return;
  }
  // 第一次换上大头像前先量好这个头像框伸出去多少，换上时一步到位，不然高度要先滑一次、量好了再滑一次。
  if (!box && measuredReach(id) === undefined) {
    frameReach(id).then(() => applyProfilePhoto(context()));
    return;
  }
  if (!box) {
    box = document.createElement('span');
    box.className = 'cf-profile-frame cf-frame-host';
    const picture = document.createElement('img');
    picture.className = 'cf-profile-photo';
    picture.alt = '';
    picture.src = photo.currentSrc || photo.src;
    box.appendChild(picture);
    fitProfileFrame(box, measuredReach(id));
    morphHeight(holder, () => {
      holder.insertBefore(box, photo);
      holder.classList.add('cf-photo-framed');
      holder.closest('.title-photo > div')?.classList.add('cf-photo-box-framed');
    });
  }
  // 换了头像框（或者自定义的改了画）：量好新的再挪边距（已经量过的马上挪）。
  const art = frameImage(id, false);
  if (box.dataset.cfFrame !== id || box.dataset.cfFrameArt !== art)
    frameReach(id).then(
      (reach) =>
        box.dataset.cfFrame === id && box.dataset.cfFrameArt === art && fitProfileFrame(box, reach),
    );
  wearFrame(box, id);
}

// 给页面上的头像补上（或换掉、摘掉）头像框。all 为假时只看还没看过的头像（页面上新出现的）；
// 设置、分组变了时 all 为真，全部重新看一遍。
export function applyFrames(all = false) {
  // 关掉了头像：页面上的头像连同框由样式收起来；主页的大头像要换回原来的照片。
  if (!appSettings.user.avatar.enabled) {
    if (all && document.querySelector('.cf-profile-frame')) applyProfilePhoto(context());
    return;
  }
  const slots = [...document.querySelectorAll('.cf-avatar-slot')].filter(
    (slot) => (all || slot.dataset.cfFrame === undefined) && !slot.closest(PLUGIN_UI_SELECTOR),
  );
  // 个人主页的大头像：第一次、或者全部重新看时才看（不然页面上每有一点变化都要把头像缓存读一遍）。
  const onProfile =
    /^\/profile\//.test(location.pathname) &&
    (all || !document.querySelector('.title-photo [data-cf-profile-checked]'));
  if (!slots.length && !onProfile) return;
  const ctx = context();
  const missing = new Map();
  for (const slot of slots) {
    const owner = ownerOf(slot);
    if (!owner?.handle || !shownAt(pagePlaceOf(slot))) {
      wearFrame(slot, '');
      continue;
    }
    owner.host.classList.add('cf-frame-host');
    wearFrame(slot, frameFor(owner.handle, owner.title, ctx, owner.admin));
    if (lacksMaxRank(owner.handle, ctx)) missing.set(userId(owner.handle), owner.handle);
  }
  backfillMaxRanks([...missing.values()]);
  if (onProfile) applyProfilePhoto(ctx);
}
// 设置、分组变了：全部重新看一遍。
export const refreshFrames = () => applyFrames(true);
// 自定义头像框变了（新做的、改了的、删了的，这一页的或别的标签页的）：也全部重新看一遍。页面加载好之后调用一次。
export const watchCustomFrames = () => subscribeCustomFrames(refreshFrames);
