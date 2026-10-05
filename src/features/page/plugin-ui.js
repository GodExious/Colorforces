// 插件自己画的界面：菜单、弹窗、悬停提示、数据分析面板等。
// 这些地方的内容由界面组件维护。会改写页面节点的增强功能（比如时间格式化）不能动里面的东西：
// 组件之后只会更新它自己的那部分，被塞进去的节点会一直留着，直到刷新页面。
export const PLUGIN_UI_SELECTOR =
  '.cf-menu-theme, .cf-analytics, .cf-settings-modal, .cf-prediction-overlay, .cf-clist-modal-overlay, .cf-storage-json-modal, .cf-confirm-pop-overlay, .cf-guide-modal-overlay, .cf-toast-notification, .cf-floating-tooltip, #cf-ratings-settings-btn, .pcr-app';

// 这个元素是否在插件自己的界面里。
export const inPluginUi = (element) => Boolean(element?.closest?.(PLUGIN_UI_SELECTOR));
