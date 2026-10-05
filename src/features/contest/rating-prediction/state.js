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
});
