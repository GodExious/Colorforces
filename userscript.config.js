import { readFileSync } from 'node:fs';
import { SCRIPT_UPDATE_URL } from './src/config/release.js';
import { PICKR_SCRIPT } from './src/assets/remote.js';

// 从唯一版本源生成元数据，更新检查同时允许 Release 附件及其下载重定向。
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
export default {
  name: { '': 'Colorforces', 'zh-CN': 'Colorforces 算法竞赛视觉增强' },
  namespace: 'https://github.com/GodExious/Colorforces',
  version,
  description: {
    '': 'Enhance Codeforces with CF/CList problem ratings, verdict abbreviations, avatars, custom time formats, tag visibility controls, keyboard shortcuts, and an animated settings menu. Led by GodExious with AI-assisted development by Antigravity and Codex.',
    'zh-CN':
      '增强 Codeforces 视觉与使用体验，支持 CF/CList 难度分、判题状态缩写、头像、自定义时间格式、标签显示控制、快捷键及动态设置菜单。由 GodExious 主导，Antigravity 与 Codex 协助开发。',
  },
  author: 'GodExious & Antigravity & Codex',
  supportURL: 'https://github.com/GodExious/Colorforces/issues',
  match: ['*://codeforces.com/*', '*://*.codeforces.com/*'],
  icon: 'https://codeforces.com/favicon.ico',
  updateURL: SCRIPT_UPDATE_URL,
  downloadURL: SCRIPT_UPDATE_URL,
  'run-at': 'document-start',
  require: [PICKR_SCRIPT],
  license: 'MIT',
  connect: [
    'clist.by',
    'raw.githubusercontent.com',
    'github.com',
    'release-assets.githubusercontent.com',
    'objects.githubusercontent.com',
  ],
  grant: ['GM_xmlhttpRequest', 'GM_setValue', 'GM_getValue', 'GM_deleteValue', 'GM_listValues'],
};
