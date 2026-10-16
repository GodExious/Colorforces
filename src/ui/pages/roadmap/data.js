// 路线图 ID、完成状态与排序；译文在 locales 下。
// 计划中的按预计提供的先后排，最近要做的在上；已实现的按完成的先后排，最新完成的在上。
// 页面上是一条时间线，每项左边写日期（只到日，按查看者的本地时间，标出本机时区）：
//   已实现的写 version（完成它的那一版），日期取更新日志里这一版的发布时间（changelog/data.js），不另外记；
//   计划中的可以写 eta（预计完成的时刻，Unix 毫秒时间戳，行尾注释写对应的北京时间，换算同更新日志），没写时显示「待定」。
export default [
  {
    id: 'ui-themes',
    completed: false,
  },
  {
    id: 'i18n',
    completed: false,
  },
  {
    id: 'contest-analysis',
    completed: false,
  },
  {
    id: 'translation',
    completed: false,
  },
  {
    id: 'problem-filter',
    completed: false,
  },
  {
    id: 'achievements',
    completed: false,
  },
  {
    id: 'friend-groups',
    completed: true,
    version: 'v 1.9.0',
  },
  {
    id: 'data-analytics',
    completed: true,
    version: 'v 1.8.0',
  },
  {
    id: 'rating-prediction',
    completed: true,
    version: 'v 1.7.0',
  },
  {
    id: 'storage-management',
    completed: true,
    version: 'v 1.5.7',
  },
  {
    id: 'shortcuts',
    completed: true,
    version: 'v 1.5.7',
  },
  {
    id: 'clist-data',
    completed: true,
    version: 'v 1.5.7',
  },
  {
    id: 'enhanced-page-presentation',
    completed: true,
    version: 'v 1.5.4',
  },
  {
    id: 'cf-official-data',
    completed: true,
    version: 'v 1.3.5',
  },
];
