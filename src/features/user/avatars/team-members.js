/*
 * 队伍里被原站折叠掉的成员。
 *
 * 原站的榜单和提交记录里，一支队伍只把前两个成员写成带颜色的主页链接，其余的折成一个「...」，
 * 账号以逗号分隔写在它的悬停提示里：
 *   <a href="/profile/a" class="rated-user user-cyan">a</a>, <a …>b</a>, <span title="c, d, e">...</span>
 * 开着队伍格式化时把这些人也一人一行排出来。账号从那条提示里读，不另外请求；
 * 名字的颜色页面上没有，等头像功能查到这个人的头衔后补上（见 enhance.js），查不到就保持不带颜色的样子。
 */

// 账号只有字母、数字和这三种符号；别的内容（提示被别的东西改写过）不当成账号。
const HANDLE = /^[\w.-]{1,40}$/;

// 从「...」的提示里读出被折叠的账号，保持原来的先后。
export function hiddenMembers(title) {
  return (title || '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => HANDLE.test(name));
}

// 这个节点是不是原站那个折叠用的「...」。
export function isMoreMark(text) {
  return /^(\.{3}|…)$/.test((text || '').trim());
}

// 头衔 → 原站给名字上色用的类名。没有头衔的是未评级的账号，原站用黑色。
const RANK_CLASS = {
  newbie: 'user-gray',
  pupil: 'user-green',
  specialist: 'user-cyan',
  expert: 'user-blue',
  'candidate master': 'user-violet',
  master: 'user-orange',
  'international master': 'user-orange',
  grandmaster: 'user-red',
  'international grandmaster': 'user-red',
  'legendary grandmaster': 'user-legendary',
  tourist: 'user-4000',
};
export function rankClass(rank) {
  if (!rank) return 'user-black';
  return RANK_CLASS[rank.toLowerCase()] || 'user-black';
}

// 原站写在名字提示里的那句：头衔每个词首字母大写，后面跟账号；未评级的写 Unrated。
export function rankTitle(rank, handle) {
  if (!rank) return `Unrated, ${handle}`;
  const words = rank
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return `${words} ${handle}`;
}

/*
 * Ghost 队伍（现场赛导入榜单的队伍）在原站只有一段文字，写法由导入的人定，各场不一样。认得的几种：
 *   学校: 队名 (成员, 成员, 成员)      学校: 队名
 *   队名: 成员, 成员, 成员             —— 冒号后面带逗号的当成员名单，前面那段是队名（排版时放在学校的位置上）
 *   学校 - 队名 - 成员, 成员           学校 - 队名
 *   队名 (学校)                        其余的整段当队名
 * 返回学校、队名和成员名单；没写成员、或者写法不认得时成员是空的。
 */
export function parseGhostTeam(text) {
  text = (text || '').trim();
  let school = '',
    team = '',
    members = '';
  const paren = /^(.*?)\s*\((.*?)\)$/;
  if (text.includes(': ')) {
    const parts = text.split(': ');
    school = parts[0].trim();
    const rest = parts.slice(1).join(': ').trim();
    const match = rest.match(paren);
    if (match) {
      team = match[1].trim();
      members = match[2].trim();
    } else if (rest.includes(',')) members = rest;
    else team = rest;
  } else if (text.includes(' - ') && text.split(' - ').length >= 3) {
    const parts = text.split(' - ');
    school = parts[0].trim();
    team = parts[1].trim();
    members = parts.slice(2).join(' - ').trim();
  } else if (text.includes(' - ')) {
    const parts = text.split(' - ');
    school = parts[0].trim();
    team = parts[1].trim();
  } else if (paren.test(text)) {
    const match = text.match(paren);
    team = match[1].trim();
    school = match[2].trim();
  } else team = text;
  return {
    school,
    team,
    members: members
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  };
}
