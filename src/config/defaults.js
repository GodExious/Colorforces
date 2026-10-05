// 设置的结构版本。第一层的归档方式或某一项的位置、名字变了，就把它加一，
// 并在 storage/migrations/settings.js 里写上从旧结构到新结构的迁移。只新增设置项不用改。
export const SETTINGS_VERSION = 2;
// 原版默认设置；组件不得另行维护默认值副本。
// 第一层按菜单页签归档：通用、外观、难度分、比赛、用户、快捷键。
export const DEFAULT_SETTINGS = {
  version: SETTINGS_VERSION,
  // 通用
  general: {
    lang: 'en',
    disableUpdateCheck: false,
    menuSize: { enabled: false, width: null, height: null },
    menuPosition: { enabled: false, x: null, y: null, reference: 'button', panelSize: null },
  },
  // 外观
  appearance: {
    acHighlight: { enabled: true, color: 'rgba(167, 219, 255, 0.39)' },
    langIcon: { enabled: true, size: 1.6 },
    shortVerdict: true,
    timeFormat: {
      enabled: true,
      format: 'YYYY/MM/DD HH:mm',
    },
    // 题目标签的隐藏：hide 是总开关，hideRating 连难度分标签一起隐藏，keepSolved 已通过的题目不隐藏。
    tags: { hide: false, hideRating: false, keepSolved: false },
  },
  // 难度分
  ratings: {
    enabled: true,
    // 难度分的样式：tag 标签，block 色块。
    style: 'tag',
    tagFillCell: true,
    // 在哪些页面显示难度分。
    show: {
      submissions: true,
      status: true,
      hacks: true,
      problemset: true,
      contestProblems: true,
      standings: true,
      problemTags: true,
    },
    clist: {
      enabled: false,
      authMode: 'cookie',
      isLoggedIn: true,
      apiKey: '',
    },
  },
  // 比赛（菜单页签的标识是 prediction）
  contest: {
    prediction: {
      enabled: true,
      delta: true,
      performance: true,
      rankChange: true,
      ratedRank: true,
      analysis: true,
      followRatingStyle: true,
      // 最多保留最近几场比赛的预测数据。
      cacheContests: 10,
    },
    participationTags: { enabled: true, rated: true, unrated: true, virtual: true },
  },
  // 用户
  user: {
    avatar: { enabled: true, size: 1.6 },
    formatTeams: true,
    // 用户数据图表分析。charts 里每项对应个人主页上的一块内容。
    analytics: {
      enabled: true,
      autoLoad: true,
      // 条目多的分析表（标签分布、未解决题目等）默认只列出前面的一部分；关掉后默认全部列出。
      // 两种情况下每张表都可以再各自展开或收起。
      collapse: true,
      followRatingSource: true,
      followRatingStyle: true,
      includeTeams: true,
      // 难度分布显示什么：count 题数、share 占已解决题数的比例、coverage 分段占比（覆盖了题库里这一档的多少）。
      // 在图表上切换，不在菜单里。
      ratingsMode: 'count',
      // 标签分布显示什么，取值同上；coverage 在这里是覆盖了题库里带这个标签的多少题。
      tagsMode: 'count',
      // 刷题作息统计多长时间以内的提交：all 全部、year 近一年、quarter 近 90 天、month 近 30 天、
      // week 近 7 天。在图表上切换，不在菜单里。
      hoursSpan: 'all',
      cacheUsers: 10,
      // 「近期平均难度」取最近多少道有难度分的已通过题目来平均。菜单和图表上都能改。
      recentCount: 50,
      // 「近期平均难度（按天数）」取多长时间里通过的题：week 近 7 天、month 近 30 天、quarter 近 90 天、
      // year 近一年。在图表上切换，不在菜单里。
      recentSpan: 'month',
      // 「参赛排名曲线对比」看哪一类比赛：all 全部、div1 到 div4、other 其余的。在图表上切换，不在菜单里。
      rankDivision: 'all',
      charts: {
        summary: true,
        heatmap: true,
        activity: true,
        hours: true,
        compare: true,
        compareRank: true,
        ratings: true,
        tags: true,
        weakness: true,
        recent: true,
        recentDays: true,
        attempts: true,
        verdicts: true,
        speed: true,
        types: true,
        languages: true,
        unsolved: true,
      },
    },
  },
  // 快捷键。键名是动作的标识，不是设置项的路径。
  shortcuts: {
    hideTags: 'Shift+H',
    menuLanguage: 'Shift+M', // Menu language：切换菜单语言，不与语言图标的 Shift+L 冲突。
    acHighlight: 'Shift+B', // Background：整行背景高亮，避开头像使用的 Shift+A。
    langIcon: 'Shift+L',
    shortVerdict: 'Shift+S',
    timeFormat: 'Shift+T',
    clistEnabled: 'Shift+C',
    colorRatings: 'Shift+R',
    displayStyle: 'Shift+F',
    predictionEnabled: 'Shift+P', // Prediction：比赛评分预测总开关。
    userAvatar: 'Shift+A',
  },
};
