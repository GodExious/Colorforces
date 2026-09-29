// 原有持久化键名；升级时不可改名。
export const CACHE_KEY = 'cf_problems_ratings';

export const CACHE_TIME_KEY = 'cf_problems_ratings_time';

// 标记已成功拉取的题库语言，旧版无标记缓存会在后台更新。
export const CACHE_LOCALE_KEY = 'cf_problems_ratings_locale';

export const PARALLEL_CONTESTS_KEY = 'cf_parallel_contests';

export const CLIST_STORAGE_KEY = 'cf_clist_problems';

export const CLIST_LAST_SYNC_KEY = 'cf_clist_last_sync_time';

export const AVATAR_CACHE_KEY = 'cf_user_avatars_v2';

export const UPDATE_CHECK_KEY = 'cf_update_check_state';

export const SETTINGS_KEY = 'cf_submissions_settings';

// 运行元数据与用户偏好独立统计和清理，保留原版实际键名。
export const RUNTIME_STORAGE_KEYS = [
  CACHE_TIME_KEY,
  CACHE_LOCALE_KEY,
  CLIST_LAST_SYNC_KEY,
  UPDATE_CHECK_KEY,
];
