import { DEFAULT_SETTINGS } from '../../config/defaults.js';
import { getRuntimeValue, setRuntimeValues } from '../runtime.js';
import { hexToRgba } from '../../utils/color.js';

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
// 旧版对这几项只要求「有值就按真假算」。
const flag = (value) => (value === undefined ? undefined : Boolean(value));

// 旧结构里 show 下面混放着各页签的开关，其中这几项是「在哪些页面显示难度分」。
const RATING_PAGES = [
  'submissions',
  'status',
  'hacks',
  'problemset',
  'contestProblems',
  'standings',
  'problemTags',
];
// 更早的版本默认用 Alt 组合键，后来改成了 Shift；还停在旧默认值上的跟着换成新的默认值。
const LEGACY_ALT_SHORTCUTS = {
  hideTags: 'Alt+H',
  shortVerdict: 'Alt+S',
  timeFormat: 'Alt+T',
  langIcon: 'Alt+L',
  clistEnabled: 'Alt+C',
  colorRatings: 'Alt+R',
  displayStyle: 'Alt+F',
  userAvatar: 'Alt+A',
};

// 高亮色：更早的版本把颜色和透明度分成两项保存，合并成一个颜色字符串。
function highlightColor(old) {
  const color = old.acBgColor;
  if (typeof color !== 'string' || !color.startsWith('#')) return color;
  return old.acBgAlpha !== undefined && old.acBgAlpha < 1 ? hexToRgba(color, old.acBgAlpha) : color;
}

// 语言图标大小：更早的版本存的是像素，现在是相对文字大小的倍数。
function langIconSize(old) {
  const size = parseFloat(old.langIconSize);
  return size >= 5 ? parseFloat((size / 14).toFixed(1)) : size;
}

// CList 设置：更早的版本把同步时间也放在这里，现在归插件数据管，挪过去之后从设置里去掉。
function clistSettings(old) {
  if (!isObject(old.clist)) return undefined;
  const { lastSyncTime, ...clist } = old.clist;
  const legacySyncTime = Number(lastSyncTime);
  const storedSyncTime = Number(getRuntimeValue('clistSyncTime')) || 0;
  if (Number.isFinite(legacySyncTime) && legacySyncTime > storedSyncTime) {
    setRuntimeValues({ clistSyncTime: legacySyncTime });
  }
  return clist;
}

function shortcutSettings(old) {
  if (!isObject(old.shortcuts)) return undefined;
  const shortcuts = { ...old.shortcuts };
  for (const [key, binding] of Object.entries(LEGACY_ALT_SHORTCUTS)) {
    if (shortcuts[key] === binding) shortcuts[key] = DEFAULT_SETTINGS.shortcuts[key];
  }
  return shortcuts;
}

// 把第一版（没有 version 字段、各项平铺在第一层）的设置改写成按菜单页签归档的结构。
// 这里只管「原来在哪、现在在哪」和旧格式的换算；值合不合法由读取设置时统一检查，
// 所以旧数据里没有的项在这里就是 undefined，读取时会落到默认值上。
export function upgradeLegacySettings(old) {
  const show = isObject(old.show) ? old.show : {};
  return {
    general: {
      lang: old.lang,
      disableUpdateCheck: flag(old.disableAutoCheckUpdate),
      menuSize: old.menuSize,
      menuPosition: old.menuPosition,
    },
    appearance: {
      acHighlight: { enabled: show.acHighlight, color: highlightColor(old) },
      langIcon: { enabled: show.langIcon, size: langIconSize(old) },
      shortVerdict: show.shortVerdict,
      timeFormat: old.timeFormat,
      tags: {
        hide: flag(old.hideTags),
        hideRating: flag(old.hideRatingTag),
        keepSolved: flag(old.notHideAcTags),
      },
    },
    ratings: {
      enabled: flag(old.colorRatings),
      style: old.displayStyle,
      tagFillCell: flag(old.tagFillCell),
      show: Object.fromEntries(RATING_PAGES.map((key) => [key, show[key]])),
      clist: clistSettings(old),
    },
    contest: {
      prediction: old.prediction,
      participationTags: old.participationTags,
    },
    user: {
      avatar: { enabled: show.userAvatar, size: old.avatarSize },
      formatTeams: show.formatTeams,
      analytics: old.analytics,
    },
    shortcuts: shortcutSettings(old),
  };
}
