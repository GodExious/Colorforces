import { shallowReactive } from 'vue';

// 页面增强与单实例 Vue 面板共享状态，大型比赛快照不建立深层响应式代理。
export const predictionState = shallowReactive({
  snapshot: null,
  results: {},
  loading: false,
  error: '',
  progress: 0,
  openHandle: null,
  computing: false,
  analysisResult: null,
  analysisError: '',
});
