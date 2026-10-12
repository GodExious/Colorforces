/*
 * 用页面上的成绩，把预测用的成绩补到和页面一致。
 *
 * 预测用的成绩来自接口的榜单（contest.standings），而接口的结果是原站缓存过的：实测比赛进行中每 60 秒才换一次，
 * 所以它最多比真实情况旧一分钟。页面上的榜单是实时的。这一分钟里过了题的人，页面上是新分数、新名次，
 * 预测却还按旧分数算，表现分、涨跌分、计评级名次都和左右的人对不上。
 * 所以算之前先看页面（或刚取来准备换上去的那张表格）：上面有的人，分数以它为准。
 * 不在这一页的人改不了，仍是接口里的成绩——名次可能因此差几名，但每一行自己的成绩是对的，不会出现低分的人排在高分的人前面。
 */

// 格子里的数字；不是数字（空的、带别的字）返回 null。
function numberIn(cell) {
  const text = (cell?.textContent || '').replace(/\s+/g, '');
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : null;
}

/*
 * 读出一张榜单表格里各人的成绩：账号（小写）→ { points, penalty }。
 * 「=」那一列是成绩（按分数算的赛制是总分，ICPC 赛制是过题数）；它后面要是紧跟着罚时一列就一起读，没有的话 penalty 是 null。
 * handleOf 从选手格里取账号，isOfficial 判断这一行是不是正式参赛的行（赛后练习、虚拟参赛、不计分的行不读）。
 * 同一个账号出现两次的不读，分不清哪一行是它的正式成绩。
 */
export function readScores(table, { handleOf, isOfficial }) {
  const scores = new Map();
  const head = table?.rows?.[0];
  if (!head) return scores;
  const titles = [...head.cells].map((cell) => (cell.textContent || '').trim());
  const pointsAt = titles.indexOf('=');
  if (pointsAt < 0) return scores;
  const after = head.cells[pointsAt + 1];
  const penaltyAt =
    after && titles[pointsAt + 1] !== '*' && !after.querySelector('a[href*="/problem/"]')
      ? pointsAt + 1
      : -1;
  const twice = new Set();
  for (const row of [...table.rows].slice(1)) {
    const who = [...row.cells].find((cell) => cell.classList.contains('contestant-cell'));
    if (!who || !isOfficial(who)) continue;
    const handle = handleOf(who);
    if (!handle || twice.has(handle)) continue;
    if (scores.has(handle)) {
      scores.delete(handle);
      twice.add(handle);
      continue;
    }
    const points = numberIn(row.cells[pointsAt]);
    const penalty = penaltyAt < 0 ? null : numberIn(row.cells[penaltyAt]);
    if (points === null || (penaltyAt >= 0 && penalty === null)) continue;
    scores.set(handle, { points, penalty });
  }
  return scores;
}

const differs = (a, b) => Math.abs(a - b) > 1e-6;

// 把快照里这些人的成绩换成页面上的。没有要换的就原样返回；有的话返回一份新的快照，原来那份不动（它是存着的）。
export function patchScores(snapshot, scores) {
  if (!scores.size) return snapshot;
  let patched = 0;
  const participants = snapshot.participants.map((participant) => {
    const score = scores.get(participant.handle.toLowerCase());
    if (!score) return participant;
    const penalty = score.penalty ?? participant.penalty;
    if (!differs(score.points, participant.points) && !differs(penalty, participant.penalty))
      return participant;
    patched++;
    return { ...participant, points: score.points, penalty };
  });
  return patched ? { ...snapshot, participants } : snapshot;
}
