// 原有持久化键名；升级时不可改名。
export const CACHE_KEY = 'cf_problems_ratings';

export const PARALLEL_CONTESTS_KEY = 'cf_parallel_contests';

export const CLIST_STORAGE_KEY = 'cf_clist_problems';

export const AVATAR_CACHE_KEY = 'cf_user_avatars_v2';

// 比赛快照与短租约独立于用户设置和头像数据。
export const PREDICTION_CACHE_KEY = 'cf_contest_prediction_v1';
export const PREDICTION_RATINGS_KEY = 'cf_prediction_ratings_v1';
export const PREDICTION_LOCK_KEY = 'cf_prediction_request_lease_v1';
export const PREDICTION_STORAGE_KEYS = [
  PREDICTION_CACHE_KEY,
  PREDICTION_RATINGS_KEY,
  PREDICTION_LOCK_KEY,
];

export const SETTINGS_KEY = 'cf_submissions_settings';

// 插件数据：运行中记下的几项小数据合存在这一个键里，与用户偏好分开统计和清理。读写一律经 storage/runtime.js。
export const RUNTIME_DATA_KEY = 'cf_plugin_data';

// 合并前各项数据各占一个键。这些旧键只用于把数据迁入上面的键，迁完即删。
// 左边是合并后的字段名：题库更新时间、题库语言标记、CList 同步时间、更新检查状态。
export const LEGACY_RUNTIME_KEYS = {
  ratingsTime: 'cf_problems_ratings_time',
  ratingsLocale: 'cf_problems_ratings_locale',
  clistSyncTime: 'cf_clist_last_sync_time',
  updateCheck: 'cf_update_check_state',
};
