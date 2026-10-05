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

// 数据分析：各个账号的数据集合存在这一个键里，结构见 features/user/analytics/store.js。
export const ANALYTICS_KEY = 'cf_user_analytics_v2';
// 合并前每个账号各占一个键，键名是这个前缀加小写账号名。这些旧键只用于把数据迁入上面的键，迁完即删。
export const LEGACY_ANALYTICS_PREFIX = 'cf_user_analytics_v1_';

// 设置：按菜单页签归档的结构存在这个键里。
export const SETTINGS_KEY = 'cf_plugin_settings';
// 1.8.0 之前的设置键，各项平铺在第一层。新键还没有时从这里读一次迁过去，之后不读也不写：
// 两种结构各用各的键，升级时还开着的旧版本页面不会读到看不懂的新结构、再把默认值写回来；
// 降回旧版本时原来的设置也还在。它会出现在存储页的「已弃用的缓存」里，可以清理。
export const LEGACY_SETTINGS_KEY = 'cf_submissions_settings';

// 1.5.6 及更早的版本把数据存在网站自己的本地存储里，用过的就是这几个键；1.5.7 起改存油猴存储。
// 「已弃用的缓存」在网站本地存储里只认这几个键。那里别的键属于原站或别的脚本（有的也以 cf_ 开头），一概不读。
export const LEGACY_LOCAL_KEYS = [
  'cf_submissions_settings',
  'cf_ratings_settings',
  'cf_problems_ratings',
  'cf_problems_ratings_time',
  'cf_user_avatars',
];

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
