/*
 * 评级名单里查不到的人，再按账号问一遍。
 *
 * 赛前评级取自「本场参赛者的评级名单」（user.ratedList 按比赛筛），但这份名单并不全：
 * 实测 Codeforces Round 1126（2271）进行中时，榜单上 8704 人里有 1124 人不在名单里，
 * 其中 505 人其实有评级（最高的 2600 多分），名单里查不到就当成首场账号（1400 分）是错的。
 * 所以名单里没有的人，用 user.info 按账号再查一次：一次请求能查完（用 POST，几千个账号也行），
 * 查过的记在评级数据的 looked 里（有评级记分数，确实没有评级记 null），以后不再查。
 */

// 一次请求最多查多少人（接口的上限是一万）。
export const LOOKUP_BATCH = 5000;

// 账号可以叫 constructor 之类的名字，只认对象自己的键。
const own = (map, key) => (map && Object.hasOwn(map, key) ? map[key] : undefined);

// 一个人的赛前评级：上一次快照里记下的优先（比赛期间评级数据可能更新），其次是名单，再次是按账号查到的。
// 都没有就是 null，按首场账号算。
export function resolveRating(handle, prior, source) {
  return (
    prior?.reportedRating ?? own(source?.ratings, handle) ?? own(source?.looked, handle) ?? null
  );
}

// 这些账号里还要去查的：哪里都没有它的评级，也还没查过。
export function pendingLookups(handles, source, previousRows) {
  const pending = new Set();
  for (const handle of handles) {
    if (!handle || Number.isInteger(previousRows.get(handle)?.reportedRating)) continue;
    if (Number.isInteger(own(source?.ratings, handle))) continue;
    if (own(source?.looked, handle) !== undefined) continue;
    pending.add(handle);
  }
  return [...pending];
}

// 把查到的结果对回账号。接口按请求的顺序返回；改过名的人返回的是新名字，所以按位置对，不按名字对。
export function readLookups(batch, users) {
  if (!Array.isArray(users) || users.length !== batch.length) return {};
  return Object.fromEntries(
    batch.map((handle, index) => [
      handle,
      Number.isInteger(users[index]?.rating) ? users[index].rating : null,
    ]),
  );
}

// 有一个账号查不到时接口整批报错，从报错里认出是哪一个，好把它去掉重查。
export function unknownHandle(comment) {
  return /User with handle (\S+) not found/.exec(comment || '')?.[1] ?? null;
}
