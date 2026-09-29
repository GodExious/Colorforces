import { createApp } from 'vue';
import App from './App.vue';
import { showConfirmPop } from './components/dialogs/ConfirmDialog/ConfirmDialog.vue';
import { openClistSyncProgress } from './pages/ratings/components/ClistSyncDialog/ClistSyncDialog.vue';
import { showUpdateModal } from './pages/general/components/UpdateDialog/UpdateDialog.vue';
import { configureClistUI } from '../features/ratings/clist.js';
import { configureUpdateUI } from '../features/general/updates.js';
// 安装唯一菜单，并向业务层提供明确的弹窗调用接口。
export function mountMenu() {
  if (document.getElementById('cf-ratings-settings-btn')) return;
  configureClistUI(showConfirmPop, openClistSyncProgress);
  configureUpdateUI(showUpdateModal);
  const host = document.createElement('div');
  host.id = 'colorforces-ui';
  document.body.appendChild(host);
  return createApp(App).mount(host);
}
