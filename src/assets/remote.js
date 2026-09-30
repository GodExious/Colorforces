// Pickr JS 与 nano 主题共用固定版本，避免 CDN 默认版本变化。
const PICKR_DIST_URL = 'https://cdn.jsdelivr.net/npm/@simonwep/pickr@1.10.2/dist';
export const PICKR_SCRIPT = `${PICKR_DIST_URL}/pickr.min.js`;
export const PICKR_STYLESHEET = `${PICKR_DIST_URL}/themes/nano.min.css`;

// 沿用原版 Devicon 路径，不在此次重构中更换远程图标版本。
export function getDeviconUrl(iconName, fileName) {
  return `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${iconName}/${fileName}`;
}

// 头像失败回退使用原站的默认头像与反代路径。
export const DEFAULT_AVATAR_URL = 'https://codeforces.com/userpic.codeforces.org/no-avatar.jpg';
