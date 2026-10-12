// 请求官方比赛列表，响应解析交给评分缓存模块。
export function fetchContestList() {
  return fetch('https://codeforces.com/api/contest.list?gym=false&lang=en');
}
// 请求官方题库与解决人数统计。
export function fetchProblemset() {
  return fetch('https://codeforces.com/api/problemset.problems?lang=en');
}
// 重新取一遍当前这个页面（同源，带着登录状态，不走缓存），用来把页面上的榜单表格换成最新的。
export function fetchCurrentPage(signal) {
  return fetch(location.href, { signal, cache: 'no-store', credentials: 'same-origin' });
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
// 按账号查用户资料，用来补评级名单里漏掉的人。一次要查的人可能上千，放在地址里太长，所以用 POST。
// 返回的顺序和请求的一样；改过名的账号用旧名字也查得到。
export function fetchUsersByHandle(handles, signal) {
  return fetch('/api/user.info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ handles: handles.join(';') }),
    signal,
  });
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
