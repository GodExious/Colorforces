/*
 * 已出分的比赛：计分的人群从官方的评级变化记录里来，一条记录是一个人。
 *
 * 个人：一条记录一个参赛者。
 * 队伍：团队计分的比赛里，官方把一支队当成一个参赛者（见 algorithm/team-rating.js），所以这里也把一支队合成一个：
 * 评级取队伍的评级，名次和涨跌分取记录里的（同队每人相同）。不合起来、每个队员各算一个人的话，
 * 人群多出近一倍，所有人的表现分和计评级名次都会算偏。
 * 哪些人是一队，看官方榜单上的行：一行里有不止一个成员、并且每个成员都有这一场的记录，才算一支计分的队。
 * 有的比赛只给个人计分、队伍不计分（2011 年的 School Regional Team Contest, Saratov），那里的队伍没有记录，不在这里。
 *
 * 队伍的参赛者用第一个队员的账号当标识，另带 members（全部队员的账号），榜单上据此把队伍的那一行对上。
 * 队伍没有「赛前评级」可显示（队员各不相同），reportedRating 留空；每个队员自己的赛前、赛后评级记在
 * memberRatings 里（和 members 一一对应），榜单上的头衔变化和单用户分析按成员分开时用。
 *
 * 这一场计不计分也在这里判断（unratedContest）：有评级变化记录的当然计分；没有的，名字里写明了不计分、
 * 或者已经结束三天以上（官方早该出分了），就是不计分。结束不久又没有记录的是还在等出分，不算。
 */
import { teamRating } from './algorithm/team-rating.js';

// 2020 年的新号规则之后，首场账号的记录里赛前评级写的是 0，实际按 1400 算。
const isInitial = (change, contestId) => contestId >= 1360 && change.oldRating === 0;
const validRating = (rating) => Number.isInteger(rating) && rating >= -500 && rating < 6000;
const validRank = (rank) => Number.isInteger(rank) && rank > 0;

function teamParticipant(records, contestId) {
  const [first] = records;
  const rating = Math.round(
    teamRating(records.map((change) => (isInitial(change, contestId) ? 1400 : change.oldRating))),
  );
  const deltas = records.map((change) => change.newRating - change.oldRating);
  return {
    handle: first.handle,
    members: records.map((change) => change.handle),
    memberRatings: records.map((change) => [change.oldRating, change.newRating]),
    points: -first.rank,
    penalty: 0,
    rank: first.rank,
    rating,
    reportedRating: null,
    initial: false,
    submitted: true,
    status: 'rated',
    reason: 'official',
    valid: validRating(rating) && validRank(first.rank),
    // 同队的涨跌分应当相同；万一不同就不显示官方的，按算出来的显示。
    officialDelta: deltas.every((delta) => delta === deltas[0]) ? deltas[0] : null,
  };
}

function soloParticipant(change, contestId) {
  const initial = isInitial(change, contestId);
  const rating = initial ? 1400 : change.oldRating;
  return {
    handle: change.handle,
    points: -change.rank,
    penalty: 0,
    rank: change.rank,
    rating,
    reportedRating: change.oldRating,
    newRating: change.newRating,
    initial,
    submitted: true,
    status: 'rated',
    reason: 'official',
    valid: validRating(rating) && validRank(change.rank) && Number.isInteger(change.newRating),
    officialDelta: change.newRating - change.oldRating,
  };
}

const UNRATED_NAME = /unrated|april fools|marathon|q#|kotlin heroes/i;
const SETTLED_AFTER = 3 * 86400;
// contest：接口里的比赛信息；hasChanges：有没有评级变化记录；now：现在的时刻（秒）。
export function unratedContest(contest, hasChanges, now = Date.now() / 1000) {
  if (hasChanges) return false;
  if (contest.isRated === false || UNRATED_NAME.test(contest.name || '')) return true;
  return (
    contest.phase === 'FINISHED' &&
    now - contest.startTimeSeconds - contest.durationSeconds > SETTLED_AFTER
  );
}

// changes：官方的评级变化记录；rows：官方榜单的行。返回计分的参赛者，顺序跟着记录。
export function officialParticipants(changes, rows, contestId) {
  const byHandle = new Map(changes.map((change) => [change.handle.toLowerCase(), change]));
  // 队员的账号（小写）→ 这支队的参赛者。
  const teamOf = new Map();
  for (const row of rows || []) {
    const members = (row.party?.members || []).map((member) => member.handle).filter(Boolean);
    if (members.length < 2) continue;
    const records = members.map((handle) => byHandle.get(handle.toLowerCase()));
    if (records.some((record) => !record)) continue;
    const team = teamParticipant(records, contestId);
    for (const handle of members) teamOf.set(handle.toLowerCase(), team);
  }
  const participants = [];
  const added = new Set();
  for (const change of changes) {
    const team = teamOf.get(change.handle.toLowerCase());
    if (!team) participants.push(soloParticipant(change, contestId));
    else if (!added.has(team)) {
      added.add(team);
      participants.push(team);
    }
  }
  return participants;
}
