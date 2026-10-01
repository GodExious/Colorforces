import { appSettings } from '../../settings.js';
import { isDarkTheme } from '../page/theme.js';
import { getRatingTagStyle, getRatingBgColor } from './rules.js';
import { updateRatingValue } from './value-motion.js';

// 共用评分底板与数字过渡，允许涨跌分独立提供显示值和方向色。
export function applyRatingStyle(cell, rating, options = {}) {
  const displayValue = options.value ?? rating;
  const prefix = options.prefix || '';
  const hasRating =
    (Number.isFinite(rating) || rating === Infinity) &&
    (Number.isFinite(displayValue) || displayValue === Infinity);
  if (hasRating) cell.dataset.rating = rating;
  else delete cell.dataset.rating;
  cell.dataset.cfRatingEmpty = String(!hasRating);
  cell.style.textAlign = 'center';
  cell.style.verticalAlign = 'middle';
  let value = cell.querySelector('.cf-rating-value');
  if (!value) {
    value = document.createElement('span');
    value.className = 'cf-rating-value';
    cell.replaceChildren(value);
  }
  updateRatingValue(value, hasRating ? displayValue : null, prefix);
  if (!hasRating) {
    cell.dataset.cfRatingMode ||= 'plain';
    return;
  }
  const enabled = options.enabled ?? appSettings.colorRatings;
  const tag = appSettings.displayStyle === 'tag';
  const compact = tag && appSettings.tagFillCell === false;
  const palette = getRatingTagStyle(rating);
  cell.dataset.cfRatingMode = !enabled ? 'plain' : compact ? 'compact' : tag ? 'filled' : 'block';
  cell.style.setProperty(
    '--cf-rating-bg',
    !enabled ? 'transparent' : tag ? palette.bg : getRatingBgColor(rating),
  );
  cell.style.setProperty(
    '--cf-rating-color',
    options.textColor ??
      (!enabled
        ? 'inherit'
        : tag
          ? palette.text
          : isDarkTheme()
            ? '#EEEEEE'
            : rating >= 1600
              ? 'white'
              : 'black'),
  );
  cell.style.setProperty('--cf-rating-border', compact && enabled ? palette.border : 'transparent');
  cell.style.setProperty(
    '--cf-rating-digits',
    (displayValue === Infinity ? 2 : String(prefix + displayValue).length) + 'ch',
  );
  // 预测列需要保留原站条纹与选中背景，仅让独立色层做过渡。
  if (!options.preserveBackground)
    cell.style.setProperty('background-color', 'transparent', 'important');
  cell.style.removeProperty('color');
  cell.style.removeProperty('font-weight');
  cell.style.removeProperty('box-shadow');
}
