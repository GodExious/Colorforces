import './styles/index.css';
import { PICKR_STYLESHEET } from './assets/remote.js';
import { mountMenu } from './ui/index.js';
import { startFeatures } from './features/index.js';
import { checkScriptUpdate } from './features/general/updates.js';
// DOM 就绪后启动菜单和页面增强，不让远程请求阻塞菜单。
function start() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = PICKR_STYLESHEET;
  document.head.appendChild(link);
  mountMenu();
  startFeatures().catch((error) => console.error('Colorforces: initialization failed', error));
  setTimeout(() => checkScriptUpdate(), 1500);
}
if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
