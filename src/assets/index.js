// 功能 SVG 由项目直接绘制；品牌标识保留原资源，菜单主题色由对应 SVG 提供。
import menuGeneralIcon from './icons/menu/general.svg?raw';
import menuAppearanceIcon from './icons/menu/appearance.svg?raw';
import menuRatingsIcon from './icons/menu/ratings.svg?raw';
import menuUserIcon from './icons/menu/user.svg?raw';
import menuShortcutsIcon from './icons/menu/shortcuts.svg?raw';
import menuStorageIcon from './icons/menu/storage.svg?raw';
import menuChangelogIcon from './icons/menu/changelog.svg?raw';
import menuRoadmapIcon from './icons/menu/roadmap.svg?raw';
import menuAcknowledgmentsIcon from './icons/menu/acknowledgments.svg?raw';
import codeforcesIcon from './icons/storage/cf.svg?raw';
import clistImage from './images/brands/clist-icon.png?inline';
import cfHelperImage from './images/brands/cf-helper-icon.png?inline';
// CF Analytics 保留用户提供的 Chrome 商店项目图标，不使用自绘图标替代。
import cfAnalyticsImage from './images/brands/cf-analytics-icon.png?inline';
import githubBrandIcon from './icons/brands/github-ack-icon.svg?raw';
import carrotImage from './images/brands/carrot-icon.png?inline';
import godexiousAvatar from './images/brands/godexious-avatar.png?inline';
import antigravityLogo from './images/brands/antigravity-logo.png?inline';
import chatgptLogo from './icons/brands/chatgpt.svg?inline';
import closeIcon from './icons/actions/close-icon.svg?raw';
import syncIcon from './icons/actions/sync-icon.svg?raw';
import shortcutInfoIcon from './icons/actions/shortcut-info-icon.svg?raw';
import shortcutClearIcon from './icons/actions/shortcut-clear-icon.svg?raw';
import resetIcon from './icons/actions/reset-icon.svg?raw';
import shortcutResetAllIcon from './icons/actions/shortcut-reset-all-icon.svg?raw';
import storageClearIcon from './icons/actions/storage-clear-icon.svg?raw';
import storageSettingsIcon from './icons/actions/storage-settings-icon.svg?raw';
import storageRuntimeIcon from './icons/storage/runtime.svg?raw';
import storageViewIcon from './icons/actions/storage-view-icon.svg?raw';
import storageCodeforcesIcon from './icons/actions/storage-codeforces-icon.svg?raw';
import storageAvatarIcon from './icons/actions/storage-avatar-icon.svg?raw';
import storageLocalIcon from './icons/actions/storage-local-icon.svg?raw';
import changelogChevronIcon from './icons/actions/changelog-chevron-icon.svg?raw';
import roadmapPlannedHeaderIcon from './icons/actions/roadmap-planned-header-icon.svg?raw';
import roadmapPlannedIcon from './icons/actions/roadmap-planned-icon.svg?raw';
import ideaBulbIcon from './icons/actions/idea-bulb.svg?raw';
import roadmapExternalLinkIcon from './icons/actions/roadmap-external-link-icon.svg?raw';
import roadmapCompletedHeaderIcon from './icons/actions/roadmap-completed-header-icon.svg?raw';
import roadmapCompletedIcon from './icons/actions/roadmap-completed-icon.svg?raw';
import brandExternalLinkIcon from './icons/actions/brand-external-link-icon.svg?raw';
import ojBetterIcon from './icons/actions/oj-better-icon.svg?raw';
import loadingIcon from './icons/actions/loading-icon.svg?raw';
import footerGithubIcon from './icons/actions/footer-github-icon.svg?raw';
import launcherIcon from './icons/actions/launcher-icon.svg?raw';
export { default as colorforcesMark } from './icons/brands/colorforces.svg?raw';
export { default as colorforcesAuroraMark } from './icons/brands/colorforces-aurora.svg?raw';
export { default as projectExtensionIcon } from './icons/project-types/extension.svg?raw';
export { default as projectUserscriptIcon } from './icons/project-types/userscript.svg?raw';
export { default as projectWebsiteIcon } from './icons/project-types/website.svg?raw';
export {
  menuGeneralIcon,
  menuAppearanceIcon,
  menuRatingsIcon,
  menuUserIcon,
  menuShortcutsIcon,
  menuStorageIcon,
  menuChangelogIcon,
  menuRoadmapIcon,
  menuAcknowledgmentsIcon,
  codeforcesIcon,
  clistImage,
  cfHelperImage,
  cfAnalyticsImage,
  githubBrandIcon,
  carrotImage,
  godexiousAvatar,
  antigravityLogo,
  chatgptLogo,
  closeIcon,
  syncIcon,
  shortcutInfoIcon,
  shortcutClearIcon,
  resetIcon as shortcutResetIcon,
  shortcutResetAllIcon,
  storageClearIcon,
  storageSettingsIcon,
  storageViewIcon,
  resetIcon as storageResetIcon,
  storageCodeforcesIcon,
  storageAvatarIcon,
  storageLocalIcon,
  changelogChevronIcon,
  roadmapPlannedHeaderIcon,
  roadmapPlannedIcon,
  ideaBulbIcon,
  roadmapExternalLinkIcon,
  roadmapCompletedHeaderIcon,
  roadmapCompletedIcon,
  brandExternalLinkIcon,
  ojBetterIcon,
  loadingIcon,
  footerGithubIcon,
  launcherIcon,
};
export const TAB_ICONS = {
  general: menuGeneralIcon,
  appearance: menuAppearanceIcon,
  ratings: menuRatingsIcon,
  user: menuUserIcon,
  shortcuts: menuShortcutsIcon,
  storage: menuStorageIcon,
  changelog: menuChangelogIcon,
  roadmap: menuRoadmapIcon,
  acknowledgments: menuAcknowledgmentsIcon,
};
export const STORAGE_ICONS = {
  settings: storageSettingsIcon,
  runtime: storageRuntimeIcon,
  cf: storageCodeforcesIcon,
  avatar: storageAvatarIcon,
  solved: storageCodeforcesIcon,
  local: storageLocalIcon,
};
export const CLIST_ICON_DATA_URI = clistImage;
export const CF_ICON_SVG = codeforcesIcon;
export const CF_HELPER_ICON_DATA_URI = cfHelperImage;
export const GITHUB_ACK_ICON_SVG = githubBrandIcon;
export const CARROT_ICON_DATA_URI = carrotImage;
export const GODEXIOUS_AVATAR_DATA_URI = godexiousAvatar;
export const ANTIGRAVITY_LOGO_DATA_URI = antigravityLogo;
export { default as dialogWarningIcon } from './icons/actions/dialog-warning.svg?raw';
export { default as dialogInfoIcon } from './icons/actions/dialog-info.svg?raw';
export { default as dialogDeleteIcon } from './icons/actions/dialog-delete.svg?raw';
export { default as timeFormatGuideIcon } from './icons/actions/time-format-guide-icon.svg?raw';
export { default as verdictGuideIcon } from './icons/actions/verdict-guide-icon.svg?raw';
export { default as clistKeyGuideIcon } from './icons/actions/clist-key-guide-icon.svg?raw';
export { default as clistSyncDialogIcon } from './icons/actions/clist-sync-dialog-icon.svg?raw';
export { default as clistSyncGuideIcon } from './icons/actions/clist-sync-guide-icon.svg?raw';
export { default as jsonDocumentIcon } from './icons/actions/json-document.svg?raw';
export { default as jsonCopyIcon } from './icons/actions/json-copy.svg?raw';
export { default as languageC } from './icons/languages/c.svg?inline';
export { default as languageD } from './icons/languages/d.svg?inline';
export { default as languageDelphi } from './icons/languages/delphi.svg?inline';
