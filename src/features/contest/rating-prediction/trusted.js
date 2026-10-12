/*
 * 「可信参赛者」：原站的官方榜单只列可信参赛者。Div. 3 / Div. 4 的公告里写明了条件
 *（参加过至少五场计分赛且每场至少过一题、历史最高分没到过 1900），并说明不满足的人只要分数低于本场的上限，
 * 照样正式参赛、照样计分，只是不进官方榜单。公告没提的 Educational 和 Div. 2 实际上也一样：
 * 拿已出分的比赛对过，官方榜单比评级变化的名单少三成到一半的人；只有 Div. 1 基本不缺。
 *
 * 原站的榜单接口只返回官方榜单。只拿它算的话，计分人群少了一大块，预测就不准（实测 Round 1122：误差中位数 29 分，补全后 8 分）。
 * 提交记录接口里有这些人的全部提交（身份是正式参赛），据此算出他们的成绩，补进计分人群：
 * ICPC 赛制（Div. 3、Div. 4、Educational）算过题数和罚时；按分数算的赛制（Div. 2、合场）按官方的计分公式算总分，
 * 只有 hack 的加减分拿不到。别的赛制（按子任务给分的）算不了，只能认出这些人、标上标签。
 * 出分之后用的是官方的评级变化，里面有所有计分的人，不再需要这一套。
 */

/*
 * 快照里「正式交过题、却不在参赛者名单里」的人（账号一律小写）。
 * 成绩补得出来的比赛，这些人已经在名单里了，这里是空的。剩下两种情况会有：
 * 算不了成绩的赛制，和旧版本缓存下来的比赛（那时没存逐题的统计）。谁交过题是记着的，
 * 所以还能认出他们、标上标签，只是没有预测。
 * 已经出分、或者提交记录没扫完时不判定。
 */
export function untrustedHandles(snapshot) {
  const found = new Set();
  if (!snapshot || !['live', 'pending'].includes(snapshot.phase)) return found;
  if (!snapshot.activity?.complete) return found;
  const listed = new Set((snapshot.participants || []).map((row) => row.handle.toLowerCase()));
  for (const handle of snapshot.activity.handles || []) {
    const key = handle.toLowerCase();
    if (!listed.has(key)) found.add(key);
  }
  return found;
}

// 这些结果不算一次被拒：编译错误、被跳过、还在评测，以及评测机自己出的错。
const NOT_REJECTED = new Set([
  'COMPILATION_ERROR',
  'SKIPPED',
  'TESTING',
  'SUBMITTED',
  'FAILED',
  'CRASHED',
  'INPUT_PREPARATION_CRASHED',
]);

// 这次提交有没有评测完。
export const isJudged = (verdict) => Boolean(verdict) && verdict !== 'TESTING';

/*
 * 把一次提交记进逐题统计。提交要按先后顺序一条条记。
 * tally 是 { 账号: { 题号: [首次通过在开赛后第几分钟（没过是 -1）, 通过之前被拒了几次] } }。
 * 一道题通过之后的提交不再算。被拒只算通过了至少一个测试点的：连第一个测试点都没过的不罚时，
 * 这一条和「编译错误不罚时」一样，是拿接口里可信参赛者的罚时逐个对出来的（见报告 2026-10-07）。
 */
export function applySubmission(tally, { handle, index, verdict, passed, seconds }) {
  const problems = (tally[handle] ||= {});
  const state = (problems[index] ||= [-1, 0]);
  if (state[0] >= 0) return;
  if (verdict === 'OK') state[0] = Math.floor(seconds / 60);
  else if (!NOT_REJECTED.has(verdict) && passed > 0) state[1]++;
}

/*
 * 按分数算的赛制（Div. 2、合场）的逐题统计，同样按先后顺序一条条记。
 * tally 是 { 账号: { 题号: [最后一次通过在开赛后第几秒（没过是 -1）, 那次通过之前算数的提交数, 到现在为止算数的提交数] } }。
 * 这种赛制一道题通过之后还能重交，算的是最后一次通过，之前的每一次算数的提交各扣 50 分。
 * 算数的：通过的，以及至少过了一个测试点的——被重交顶掉的那几次也在内（顶掉之后原站把它标成 SKIPPED，
 * 过的测试点数还留着）。不算的：编译错误、一个测试点都没过的（包括没过任何测试点的 SKIPPED）、
 * 还在评测的、评测机自己出错的。
 * 拿两场已出分的 Div. 2 的全部赛中提交对过：这样算出的总分和官方榜单逐人一致（见报告 2026-10-11）。
 */
const UNCOUNTED = new Set([
  'COMPILATION_ERROR',
  'TESTING',
  'SUBMITTED',
  'FAILED',
  'CRASHED',
  'INPUT_PREPARATION_CRASHED',
]);
export function applyScoredSubmission(tally, { handle, index, verdict, passed, seconds }) {
  const counted = verdict === 'OK' || (!UNCOUNTED.has(verdict) && passed > 0);
  if (!counted) return;
  const problems = (tally[handle] ||= {});
  const state = (problems[index] ||= [-1, 0, 0]);
  if (verdict === 'OK') {
    state[0] = seconds;
    state[1] = state[2];
  }
  state[2]++;
}

/*
 * 一道题的得分：满分 points，开赛后第 minutes 分钟通过，之前有 attempts 次算数的提交，比赛时长 duration 分钟。
 * 官方的算法是 max(0.3·满分, 满分 − 满分·分钟 ÷ (62.5·⌊时长÷30⌋) − 50·次数) 向上取整，
 * 拿 16 场比赛（八种时长）的官方榜单逐格对过。这里全用整数算，不经过小数，免得取整差一分。
 */
export function problemScore(points, minutes, attempts, duration) {
  const steps = Math.floor(duration / 30);
  if (!(points > 0) || steps <= 0) return 0;
  // 62.5 × steps = 125 × steps ÷ 2。满分和扣分都是整数，向上取整只落在随时间扣掉的那一项上。
  const decayed = points - 50 * attempts - Math.floor((2 * points * minutes) / (125 * steps));
  return Math.max(Math.ceil((3 * points) / 10), decayed);
}

// 按分数算的赛制算成绩：各题得分相加。maxPoints 是「题号 → 满分」，durationSeconds 是比赛时长。
// hack 的加减分这里拿不到（不在官方榜单里的人，接口不给），不算；近年每场有 hack 的不到十个人。
export function scoredResult(problems, maxPoints, durationSeconds) {
  let points = 0;
  for (const [index, [solvedAt, attempts]] of Object.entries(problems || {})) {
    if (solvedAt < 0) continue;
    points += problemScore(
      maxPoints[index],
      Math.floor(solvedAt / 60),
      attempts,
      durationSeconds / 60,
    );
  }
  return { points, penalty: 0 };
}

// 按 ICPC 赛制算成绩：过一题得一分；罚时是每道过了的题「通过时的分钟数 + 之前每次被拒 10 分钟」之和。
export function icpcResult(problems) {
  let points = 0;
  let penalty = 0;
  for (const [solvedAt, rejected] of Object.values(problems || {})) {
    if (solvedAt < 0) continue;
    points++;
    penalty += solvedAt + 10 * rejected;
  }
  return { points, penalty };
}

// 还在评测的提交最多回头等这么多个编号。评测队列卡得再久，下一次也只多重读不到一页。
export const UNSETTLED_LIMIT = 5000;

/*
 * 把这一次新扫到的提交并进统计。提交记录是「接着上次扫」的：每次只读比上次记到的编号更新的提交。
 * previous 是上次存下的统计（记到 priorId 为止）；items 是这次新读到的正式提交，顺序随意；
 * newestId 是这次读到的最大编号；pendingId 是其中还没评测完的最小编号，没有就是 Infinity。
 *
 * 返回：
 * - settledId：这次记到哪个编号为止。有还在评测的提交时停在它前面，下次把它之后的重读一遍——
 *   不然它评测完的结果永远不会被记进去。回头等的距离有上限（UNSETTLED_LIMIT），卡太久的就不等了。
 * - tally：到 settledId 为止的统计，存下来给下次接着用。
 * - view：当前的统计，tally 再加上 settledId 之后已经评测完的那几条。只用来算这一次的成绩，不存。
 * apply 是把一条提交记进统计的那个函数，两种赛制各有一个（applySubmission、applyScoredSubmission）。
 */
export function settleTally(
  previous,
  items,
  { priorId = 0, newestId, pendingId = Infinity },
  apply = applySubmission,
) {
  const settledId =
    pendingId === Infinity
      ? newestId
      : Math.max(pendingId - 1, newestId - UNSETTLED_LIMIT, priorId);
  const ordered = [...items].sort((a, b) => a.id - b.id);
  const tally = cloneTally(previous);
  for (const item of ordered) if (item.id <= settledId) apply(tally, item);
  const view = cloneTally(tally);
  for (const item of ordered) if (item.id > settledId && isJudged(item.verdict)) apply(view, item);
  return { settledId, tally, view };
}

// 复制一份逐题统计，改动副本不影响原来那份。
export function cloneTally(tally) {
  const copy = {};
  for (const [handle, problems] of Object.entries(tally || {})) {
    copy[handle] = {};
    for (const [index, state] of Object.entries(problems)) copy[handle][index] = [...state];
  }
  return copy;
}
