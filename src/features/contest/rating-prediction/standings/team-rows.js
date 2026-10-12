/*
 * 榜单上队伍的那一行对应快照里的哪条记录。
 *
 * 个人的行靠那一格里唯一的账号去找记录；队伍的格子里有好几个账号，哪个都不是这一行的标识。
 * 快照里队伍的记录带 members（全部队员的账号，见 official.js 和 data.js），这里按队员的账号反查。
 * 账号一律小写。
 */

// 队员的账号 → 这支队的记录。
export function teamIndex(participants) {
  const teams = new Map();
  for (const record of participants || [])
    for (const member of record.members || []) teams.set(member.toLowerCase(), record);
  return teams;
}

// 格子里的账号可能只是队员的一部分（原站把第三个以后的成员折叠掉），都指到同一条记录上才算对上了。
export function teamRecordFor(handles, teams) {
  const found = new Set(handles.map((handle) => teams.get(handle)));
  return found.size === 1 ? ([...found][0] ?? null) : null;
}

/*
 * 这一行是队伍的话有几个人，不是队伍返回 0。有队名的就是队伍，一个人的队也算。
 * shown：格子里露出来的成员数；hidden：原站折叠进「...」里的成员数。
 */
export function teamSize(shown, hasTeamName, hidden = 0) {
  return shown > 1 || hasTeamName ? shown + hidden : 0;
}

/*
 * 计分队伍那一行按成员分开时，每一段是谁：给出账号和他自己的赛前、赛后评级，先后照记录里的
 *（就是原站榜单上成员的先后）。格子里不一定露出全部成员（原站把第三个以后的折叠掉），照样按全队分。
 * 队伍的记录里没有成员的评级（旧版本缓存的）、或者格子里有不属于这支队的人时返回 null，不分。
 */
export function memberParts(record, handles) {
  const ratings = record?.memberRatings;
  if (!ratings || !record.members || record.members.length < 2) return null;
  const own = new Set(record.members.map((name) => name.toLowerCase()));
  if (!handles.length || handles.some((handle) => !own.has(handle))) return null;
  return record.members.map((handle, index) => ({
    handle,
    before: ratings[index][0],
    after: ratings[index][1],
  }));
}

/*
 * root 里排在 stop 节点之前的文字，skip 认定的节点里面的不算。
 * 用来看选手格里名字前面有没有原站写的星号（非正式参赛的记号）：队伍的格子里队名排在成员前面，
 * 队名自己带星号的不少（「abacaba*0.(6)」「***」），得把队名那个链接跳过去，不然计分的队会被当成非正式参赛。
 */
export function textBefore(root, stop, skip = () => false) {
  let text = '';
  const walk = (node) => {
    if (node === stop) return true;
    if (node.nodeType === 3) text += node.data;
    else if (node.nodeType === 1 && !skip(node))
      for (const child of node.childNodes) if (walk(child)) return true;
    return false;
  };
  walk(root);
  return text;
}

/*
 * 已出分的比赛里，一支在快照里找不到记录的队伍能不能断定不计分。
 * 不能断定的只有一种：快照是旧版本缓存的，那时队员各记各的、没有队伍的记录——队员有计分记录，这支队其实是计分的。
 * records：账号 → 记录（个人的）。
 */
export function teamIsUnrated(handles, records) {
  return handles.length > 1 && !handles.some((handle) => records.get(handle)?.status === 'rated');
}
