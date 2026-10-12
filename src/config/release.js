const REPOSITORY_RAW_URL = 'https://raw.githubusercontent.com/GodExious/Colorforces/main';

// 正式版本从 Release 附件更新；根目录仅保留旧版升级的兼容入口。
export const SCRIPT_UPDATE_URL =
  'https://github.com/GodExious/Colorforces/releases/latest/download/colorforces.user.js';
export const SCRIPT_FALLBACK_UPDATE_URL = `${REPOSITORY_RAW_URL}/colorforces.user.js`;

// 各语言的更新日志文档。更新提示从这里读出新版本的更新内容。
export const CHANGELOG_URLS = {
  zh: `${REPOSITORY_RAW_URL}/docs/CHANGELOG_zh.md`,
  en: `${REPOSITORY_RAW_URL}/docs/CHANGELOG.md`,
};
