// 请求官方比赛列表，响应解析交给评分缓存模块。
export function fetchContestList() {
  return fetch('https://codeforces.com/api/contest.list?gym=false&lang=en');
}
// 请求官方题库与解决人数统计。
export function fetchProblemset() {
  return fetch('https://codeforces.com/api/problemset.problems?lang=en');
}
// 按原版批量上限请求用户提交记录，保留同源访问。
export function fetchUserStatus(handle) {
  return fetch(`/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=10000&lang=en`);
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
