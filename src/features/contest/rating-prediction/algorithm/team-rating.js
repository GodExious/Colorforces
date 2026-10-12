/*
 * 队伍的评级。
 *
 * 团队计分的比赛（VK Cup 2015–2018）里，官方把一支队当成一个参赛者来排名和计分：先按下面的公式由队员的评级
 * 算出队伍的评级，拿它和别的队比，算出的涨跌分全队每人相同。公式是原站公布的：找一个评级 r，
 * 使「评级为 r 的人同时赢过每一个队员」的概率折算回来的评级正好等于 r，二分求解。
 * 两个评级相近的人组队，队伍的评级比两人高一百多分；一个人的队就是他自己的评级。
 *
 * 核对过：2016 年第二轮起的 11 场，一支队当一个参赛者、评级取这个公式四舍五入，用 calculator.js 重算，
 * 3309 行（两人队和单人）的涨跌分和官方逐行一致，只有一场里两行差 1；2016 年第一轮差在 3 分以内。
 * 2015 年的 5 场对不上——那时官方用的是旧的评级算法，个人赛也一样对不上，和队伍无关。
 */

// 评级为 a 的人赢过评级为 b 的人的概率。
const winProbability = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));

export function teamRating(ratings) {
  if (ratings.length === 1) return ratings[0];
  let left = 1;
  let right = 1e4;
  for (let step = 0; step < 100; step++) {
    const r = (left + right) / 2;
    let winsAll = 1;
    for (const rating of ratings) winsAll *= winProbability(r, rating);
    const rating = Math.log10(1 / winsAll - 1) * 400 + r;
    if (rating > r) left = r;
    else right = r;
  }
  return (left + right) / 2;
}
