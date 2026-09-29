// 原版 Pickr 外部主题地址；Vue 本身由构建产物内置。
export const PICKR_STYLESHEET =
  'https://cdn.jsdelivr.net/npm/@simonwep/pickr/dist/themes/nano.min.css';

// 沿用原版 Devicon 路径，不在此次重构中更换远程图标版本。
export function getDeviconUrl(iconName, fileName) {
  return `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${iconName}/${fileName}`;
}

// 头像失败回退使用原站的默认头像与反代路径。
export const DEFAULT_AVATAR_URL = 'https://codeforces.com/userpic.codeforces.org/no-avatar.jpg';
