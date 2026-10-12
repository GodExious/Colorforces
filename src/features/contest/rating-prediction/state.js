import { shallowReactive } from 'vue';

// 页面增强与单实例 Vue 面板共享状态，大型比赛快照不建立深层响应式代理。
export const predictionState = shallowReactive({
  snapshot: null,
  results: {},
  loading: false,
  error: '',
  // 加载到了哪一段：standings 榜单、ratings 评级数据、submissions 核对提交记录、compute 计算。
  // 还没开始请求（或直接用了缓存）时为空。加载结束后保留最后一段，进度收起时不回跳。
  stage: '',
  // 核对提交记录时已经扫描的条数。
  progress: 0,
  openHandle: null,
  computing: false,
  analysisResult: null,
  analysisError: '',
  // 单用户分析里正在看的这个人的新号修正（见 algorithm/newcomer.js）；不是新号、还没查到时是 null。
  // { handle, played, bonus, hidden, before, current }：此前打过几场、这一场的补分、赛前还没补的部分、
  // 赛前的显示评级、按修正后的评级算出的当前结果（{ rank, rating }，评级是显示评级）。
  newcomer: null,
  // 单用户分析里正在看的人是计分队伍的成员时（见 index.js 的 teamMember）：
  // { handle, unit, shift, before, teamRating, size, current }：模型里对应的参赛者（他所在的队）、
  // 队伍评级比他自己的评级高多少、他自己的赛前评级、队伍评级、队伍人数、当前结果（{ rank, rating }，评级是他自己的）。
  member: null,
});
