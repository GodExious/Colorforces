// 一个人戴哪个头像框。只做判断，不碰页面和存储，页面、菜单里各处都按这里的结果画。
// 先看分组：这个人所在的分组里，按分组的先后第一个设了头像框的（分组设头像框在头像框库里做）；
// 都没有时看段位头像框的设置：不使用、按现在的段位、按到过的最高段位。管理员不按段位，戴管理员的那个。

// 原站的段位名（接口里的 rank、maxRank，小写）→ 头像框。4000 分以上的两位有自己的段位名。
const RANK_FRAMES = {
  newbie: 'newbie',
  pupil: 'pupil',
  specialist: 'specialist',
  expert: 'expert',
  'candidate master': 'cm',
  master: 'master',
  'international master': 'im',
  grandmaster: 'gm',
  'international grandmaster': 'igm',
  'legendary grandmaster': 'lgm',
  tourist: 'tourist',
  jiangly: 'jiangly',
};
export const RANK_FRAME_MODES = ['off', 'current', 'max'];

// 段位名 → 头像框。没有段位（还没参加过计分比赛）是 unrated；认不出的段位名不戴。
export function rankFrame(rank) {
  const name = typeof rank === 'string' ? rank.trim().toLowerCase() : '';
  if (!name) return 'unrated';
  return RANK_FRAMES[name] || '';
}

// 页面上用户名链接的提示（title）是「段位 名字」，比如「Expert fatalerror」「Legendary Grandmaster tourist」，
// 是原站按这个人现在的段位写的，比缓存里记的新。从里面读出段位名（小写；未评级的是空串，管理员是 'headquarters'）。
// 读不出来（没有提示、界面是别的语言、写法对不上）返回 undefined，这时用缓存里记的。
export function rankFromTitle(title, handle) {
  if (typeof title !== 'string' || typeof handle !== 'string' || !handle) return undefined;
  const text = title.trim();
  if (!text.toLowerCase().endsWith(handle.toLowerCase())) return undefined;
  const name = text
    .slice(0, text.length - handle.length)
    .replace(/[\s,]+$/, '')
    .trim()
    .toLowerCase();
  if (name === 'unrated') return '';
  if (name === 'headquarters') return name;
  return name in RANK_FRAMES ? name : undefined;
}

// 这个人戴哪个头像框，不戴时是空串。
//   group    所在分组里排最前的那个头像框（没有时是空串）
//   rank     现在的段位名；还不知道（资料还没读到）时是 undefined，这时不按段位戴
//   maxRank  到过的最高段位名；旧的缓存里没记这一项（undefined）或者是空的，这时按现在的段位算
//   admin    是不是管理员（页面上名字的样子是管理员的）
//   mode     段位头像框的设置：'off'、'current'、'max'
//   known    有哪些头像框（catalog 里的），不认识的头像框当作没有
export function chooseFrame({ group = '', rank, maxRank, admin = false, mode = 'off', known }) {
  const has = (id) => Boolean(id) && (!known || known.has(id));
  if (has(group)) return group;
  if (mode !== 'current' && mode !== 'max') return '';
  if (admin) return has('headquarters') ? 'headquarters' : '';
  if (rank === undefined) return '';
  const id = rankFrame(mode === 'max' && maxRank ? maxRank : rank);
  return has(id) ? id : '';
}
