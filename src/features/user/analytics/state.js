import { shallowReactive } from 'vue';

// 个人主页的启动逻辑与面板组件共享的状态。数据集较大，不建立深层响应式代理。
export const analyticsState = shallowReactive({
  // 面板挂载的页面节点；不在个人主页或从未开启过时为 null。挂上后不再撤下，面板的显隐由 active 决定。
  host: null,
  // 面板是否显示，跟随总开关；收起和展开都有过渡。
  active: false,
  handle: '',
  // 取自主页本身的显示信息：用户名（保留大小写）、原站按评级着色的样式类、头像地址。
  profileName: '',
  rankClass: '',
  avatar: '',
  // 用户是否已经触发过加载（自动加载，或点了加载按钮）。
  started: false,
  loading: false,
  // 加载阶段：queue 排队、server 等服务器、receive 接收、compute 整理。加载结束后保留最后一个阶段，进度条收起时不回跳。
  stage: '',
  received: 0,
  queueUntil: 0,
  dataset: null,
  // 计算「最长连续」用的时区（相对 UTC 的小时数）。null 表示用查看者自己的时区。
  // 它只对当前这个账号生效，存在这个账号的缓存里。
  streakZone: null,
  // 出错时的类别（network、api、timeout）与接口给出的原因。
  error: '',
  errorComment: '',
});
