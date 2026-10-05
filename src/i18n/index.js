import { appSettings } from '../settings.js';
import { fallbackLanguage } from './languages.js';
const files = import.meta.glob('./locales/*.js', { eager: true, import: 'default' });
const I18N = Object.fromEntries(
  Object.entries(files).map(([file, messages]) => [file.split('/').pop().slice(0, -3), messages]),
);
// 题目标签的译名按语言分文件放在 tags 目录下；英文就是原站的标签名，不需要文件。
const tagFiles = import.meta.glob('./tags/*.js', { eager: true, import: 'default' });
const TAGS = Object.fromEntries(
  Object.entries(tagFiles).map(([file, names]) => [file.split('/').pop().slice(0, -3), names]),
);
// 把原站的标签名换成当前语言的译名。这门语言没有译名表，或表里没有这个标签时，显示原名。
export function translateTag(tag, lang = appSettings.general.lang) {
  return TAGS[lang]?.[tag] ?? tag;
}

// 获取当前语言包，未注册语言按原版回退到中文，其次英文。
export function getLangDict(lang) {
  const targetLang =
    lang || (typeof appSettings !== 'undefined' && appSettings && appSettings.general.lang) || 'zh';
  const dict = I18N[targetLang] || I18N['zh'] || I18N['en'] || {};
  return new Proxy(dict, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (I18N['en'] && prop in I18N['en']) return I18N['en'][prop];
      if (I18N['zh'] && prop in I18N['zh']) return I18N['zh'][prop];
      return undefined;
    },
  });
}

// 按指定语言读取文案，并执行需要数量、时间等参数的翻译函数。
export function tGlobal(
  key,
  lang = (typeof appSettings !== 'undefined' && appSettings && appSettings.general.lang) || 'zh',
  ...args
) {
  if (!key) {
    return getLangDict(lang);
  }
  const dict = getLangDict(lang);
  const val = dict[key];
  if (typeof val === 'function') {
    return val(...args);
  }
  return val !== undefined ? val : key;
}

export const t = tGlobal;

// 菜单使用当前语言，并把其余参数传给原版插值函数。
export function translate(key, ...args) {
  return tGlobal(key, appSettings.general.lang, ...args);
}

export { fallbackLanguage };
