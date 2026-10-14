// 保留原缓存有效期和请求冷却时间。
export const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

export const CLIST_SYNC_COOLDOWN = 10 * 60 * 1000;

export const UPDATE_CHECK_COOLDOWN = 3 * 60 * 60 * 1000;

// 按快照时间调度，不将缓存有效期叠加到轮询间隔上。
// 比赛进行中每 60 秒刷新一次；比赛结束后、官方出分前（包括公开 hack 阶段）每 15 分钟一次。
export const PREDICTION_REFRESH = 60 * 1000;
export const PREDICTION_PENDING_REFRESH = 15 * 60 * 1000;
export const PREDICTION_FINAL_CACHE = 24 * 60 * 60 * 1000;
export const PREDICTION_API_GAP = 2200;

// 用户提交记录的缓存有效期；已通过题目与数据分析共用这一份。
export const USER_STATUS_CACHE = 15 * 60 * 1000;

// 好友名单隔这么久自动同步一次；手动同步和打开原站的好友页时不看这个间隔。
export const FRIENDS_SYNC_INTERVAL = 24 * 60 * 60 * 1000;
