/*
 * 新号规则。
 *
 * 原站从 2020 年 5 月（比赛编号 1360）起，新账号的实际评级从 1400 开始，但显示成 0；
 * 之后前六场计分比赛，每场除了正常的涨跌，显示评级再依次补 500、350、250、150、100、50，六场补完 1400。
 * 所以参赛不满六场的账号：
 * - 显示评级比实际评级低，低的就是还没补的那部分（hidden）。评级公式用的是实际评级。
 * - 这一场显示出来的涨跌 = 按实际评级算出的涨跌 + 这一场的补分（bonus）。
 * 插件平时只拿得到显示评级，不知道每个人打过几场，整张榜单上没法修正；
 * 单用户评分分析只看一个人，查一次他的评级记录就知道，可以按这里的规则算准。
 * 拿一个已经打了 32 场的账号回看过他的前六场：不修正时差 70～523 分，修正后差 17～35 分（和普通账号的误差一个量级）。
 */
export const NEWCOMER_BONUS = [500, 350, 250, 150, 100, 50];
export const NEWCOMER_RULES_FROM = 1360;

/*
 * 这个人在这一场比赛时算不算新号。
 * history 是他的评级记录（user.rating 的结果，按时间先后）；contestId 是正在看的这一场；
 * startSeconds 是这一场的开赛时间，只在记录里还没有这一场时用来数「此前打过几场」。
 * 看的是「当时」：这一场在记录里排第几，此前就打过几场，和他现在一共打了多少场无关。
 * 返回 { played, bonus, hidden }：此前打过几场、这一场的补分、赛前还没补的部分。不用修正时返回 null：
 * 老规则时期就有评级的账号、此前已经打满六场的账号、老规则时期的比赛。
 */
export function newcomerStanding(history, contestId, startSeconds = Infinity) {
  if (!Array.isArray(history) || !(contestId >= NEWCOMER_RULES_FROM)) return null;
  if (history.length && history[0].contestId < NEWCOMER_RULES_FROM) return null;
  const at = history.findIndex((entry) => entry.contestId === contestId);
  const played =
    at >= 0
      ? at
      : history.filter((entry) => !(entry.ratingUpdateTimeSeconds > startSeconds)).length;
  if (played >= NEWCOMER_BONUS.length) return null;
  return {
    played,
    bonus: NEWCOMER_BONUS[played],
    hidden: NEWCOMER_BONUS.slice(played).reduce((sum, bonus) => sum + bonus, 0),
  };
}

// 赛前：显示评级 → 实际评级（没有显示评级的首场账号按 0 算，实际就是 1400）。
export const actualBefore = (displayed, standing) => (displayed ?? 0) + standing.hidden;
// 赛后：实际评级 ↔ 显示评级。这一场的补分补上之后，还没补的部分少了 bonus。
export const displayedAfter = (actual, standing) => actual - (standing.hidden - standing.bonus);
export const actualAfter = (displayed, standing) => displayed + (standing.hidden - standing.bonus);
