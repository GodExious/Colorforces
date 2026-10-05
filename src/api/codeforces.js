// 请求官方比赛列表，响应解析交给评分缓存模块。
export function fetchContestList() {
  return fetch('https://codeforces.com/api/contest.list?gym=false&lang=en');
}
// 请求官方题库与解决人数统计。
export function fetchProblemset() {
  return fetch('https://codeforces.com/api/problemset.problems?lang=en');
}
// 公开比赛获取全场榜单，不附带分页或语言参数。
export function fetchContestStandings(contestId, signal) {
  return fetch(`/api/contest.standings?contestId=${encodeURIComponent(contestId)}`, { signal });
}
// 获取本场官方评级记录，而不是用户现在的评级。
export function fetchContestRatingChanges(contestId, signal) {
  return fetch(`/api/contest.ratingChanges?contestId=${encodeURIComponent(contestId)}`, { signal });
}
// 只取本场参赛者当前评级，包含退役账号；这不是历史赛前评级接口。
export function fetchRatedUsers(contestId, signal) {
  return fetch(
    `/api/user.ratedList?activeOnly=false&includeRetired=true&contestId=${encodeURIComponent(contestId)}`,
    { signal },
  );
}
// 分页确认提交情况，后续仅追加新记录。
export function fetchContestSubmissions(contestId, from, signal) {
  return fetch(
    `/api/contest.status?contestId=${encodeURIComponent(contestId)}&from=${from}&count=10000`,
    { signal },
  );
}
// 请求用户的全部提交记录，保留同源访问。不带数量上限：带上限时超过一万条的账号会丢掉更早的记录。
export function fetchUserStatus(handle, signal) {
  return fetch(`/api/user.status?handle=${encodeURIComponent(handle)}&lang=en`, { signal });
}
// 请求用户参加过的每场评级比赛的评级变化，保留同源访问。
export function fetchUserRating(handle, signal) {
  return fetch(`/api/user.rating?handle=${encodeURIComponent(handle)}`, { signal });
}
// 请求用户信息以补齐头像缓存。
export function fetchUserInfo(handles) {
  const apiBase =
    typeof window !== 'undefined' &&
    window.location &&
    window.location.origin &&
    window.location.origin.includes('codeforces')
      ? `${window.location.origin}/api/user.info`
      : 'https://codeforces.com/api/user.info';
  return fetch(`${apiBase}?handles=${handles.map(encodeURIComponent).join(';')}&lang=en`);
}
