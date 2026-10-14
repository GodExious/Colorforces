// 设置的结构版本。第一层的归档方式或某一项的位置、名字变了，就把它加一，
// 并在 storage/migrations/settings.js 里写上从旧结构到新结构的迁移。只新增设置项不用改。
export const SETTINGS_VERSION = 2;
// 插件字体大小：一个整数。base 是设计时的正文字号，各档字号按「填的数 / base」等比放大缩小。
export const FONT_SIZE = { base: 12, min: 10, max: 16 };
// 比赛评分预测最多缓存几场比赛：设置里能填的范围。所有比赛的数据存在一个键里，场数越多读写越慢，所以有上限。
export const PREDICTION_CACHE_CONTESTS = { min: 1, max: 25 };
// 原版默认设置；组件不得另行维护默认值副本。
// 第一层按菜单页签归档：通用、外观、难度分、比赛、用户、快捷键。
export const DEFAULT_SETTINGS = {
  version: SETTINGS_VERSION,
  // 通用
  general: {
    lang: 'en',
    disableUpdateCheck: false,
    fontSize: FONT_SIZE.base,
    menuSize: { enabled: false, width: null, height: null },
    menuPosition: { enabled: false, x: null, y: null, reference: 'button', panelSize: null },
  },
  // 外观
  appearance: {
    // 整行高亮提交过的题目：color 是已通过的底色，rejectedColor 是提交过但没通过的底色。
    acHighlight: {
      enabled: true,
      color: 'rgba(167, 219, 255, 0.39)',
      rejectedColor: 'rgba(255, 167, 167, 0.3)',
    },
    langIcon: { enabled: true, size: 1.6 },
    shortVerdict: true,
    // 隐藏判题状态里的测试点信息（on test 3 这样的）。
    hideVerdictTests: false,
    timeFormat: {
      enabled: true,
      format: 'YYYY/MM/DD HH:mm',
    },
    // 题目标签的隐藏：hide 是总开关，hideRating 连难度分标签一起隐藏，keepSolved 已通过的题目不隐藏。
    tags: { hide: false, hideRating: false, keepSolved: false },
    // 侧栏「最新动态」排成规整的两行一条：作者一行，标题另起一行完整显示，条目之间有分隔线。
    formatRecentActions: true,
    // 格式化之后，标题要不要缩进到和作者名的左边对齐；默认不缩进，从这一条的最左边起，在头像的正下方。
    indentRecentActionTitles: false,
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
      // 刷新预测时把页面上的榜单表格也换成最新的。
      syncStandings: true,
      // 最多保留最近几场比赛的预测数据。
      cacheContests: 10,
    },
    participationTags: {
      enabled: true,
      rated: true,
      unrated: true,
      virtual: true,
      untrusted: true,
      practice: true,
      ghost: true,
    },
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
      // 难度分布和标签分布显示什么，两张图共用，在哪一张上切换都一样：count 题数、share 占已解决题数的比例、
      // coverage 题库覆盖（覆盖了题库里这一档、或带这个标签的题的多少）。在图表上切换，不在菜单里。
      // 这一项原来只管难度分布，标签分布另有一项；合并时沿用了它的名字，没有改名：
      // 改名的话，升级时还开着的旧版本页面不认新名字，保存设置时会把它丢掉。
      ratingsMode: 'count',
      // 参赛类型分布数什么：submissions 提交次数，contests 比赛场数。在图表上切换。
      typesMode: 'submissions',
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
  // 分组：用户分组的总开关，以及页面上要不要在用户名后面显示分组标签。
  // 分组本身（成员、备注、好友名单）不是设置，另存在自己的键里。
  groups: {
    enabled: true,
    showTags: true,
    // 标签的样子：'name' 写分组名，'mark' 只画分组的小标（图标）。
    tagStyle: 'name',
    // 自定义分组颜色时用哪种调法：'board' 一块色板加一条色相，'sliders' 三条滑杆。记着上次用的。
    colorMode: 'board',
  },
  // 快捷键。键名是动作的标识，不是设置项的路径。
  shortcuts: {
    // 先后照菜单里的页签和各页里选项的顺序。
    menuLanguage: 'Shift+M', // Menu language：切换菜单语言，不与语言图标的 Shift+L 冲突。
    hideTags: 'Shift+H',
    hideVerdictTests: 'Shift+N', // Number：测试点编号；Shift+T 已经给了时间格式。
    acHighlight: 'Shift+B', // Background：整行背景高亮，避开头像使用的 Shift+A。
    langIcon: 'Shift+L',
    shortVerdict: 'Shift+S',
    timeFormat: 'Shift+T',
    clistEnabled: 'Shift+C',
    colorRatings: 'Shift+R',
    displayStyle: 'Shift+F',
    predictionEnabled: 'Shift+P', // Prediction：比赛评分预测总开关。
    userAvatar: 'Shift+A',
    userAnalytics: 'Shift+D', // Data：用户数据分析总开关。
    groupsEnabled: 'Shift+G', // Groups：用户分组总开关。
  },
};
