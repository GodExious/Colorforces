import { appSettings } from '../../../../settings.js';
import { translate as t } from '../../../../i18n/index.js';
import { applyRatingStyle } from '../../../ratings/cells/style.js';
import { rankForRating, rankProgress } from '../algorithm/ranks.js';
import { getRatingTagStyle, getRatingBgColor } from '../../../ratings/rules.js';
import upIcon from '../../../../assets/icons/prediction/rank-up.svg?raw';
import downIcon from '../../../../assets/icons/prediction/rank-down.svg?raw';
import steadyIcon from '../../../../assets/icons/prediction/rank-steady.svg?raw';
const icons = { up: upIcon, down: downIcon, same: steadyIcon };

// 浅色分析面板按评分档位着色，实心块模式取色块色而非白色反字。
export function predictionNumberColor(value, delta = false) {
  if (!Number.isFinite(value) && value !== Infinity) return undefined;
  if (delta) return value > 0 ? '#008000' : '#808080';
  if (!appSettings.prediction.followRatingStyle || !appSettings.colorRatings)
    return rankForRating(value).color;
  return appSettings.displayStyle === 'tag'
    ? getRatingTagStyle(value).text
    : getRatingBgColor(value);
}

// 缺值是可见的 N/A，不沿用难度分组件的空值收起语义。
function plainValue(cell, value) {
  delete cell.dataset.cfRatingMode;
  delete cell.dataset.cfRatingEmpty;
  delete cell.dataset.rating;
  cell.style.removeProperty('background-color');
  let span = cell.querySelector('.cf-prediction-number');
  if (!span) {
    span = document.createElement('span');
    span.className = 'cf-prediction-number';
    cell.replaceChildren(span);
  }
  if (span.textContent !== value) span.textContent = value;
  span.classList.toggle('cf-prediction-unavailable', value === 'N/A');
}

// 表现分按评级着色；涨跌分始终绿色上涨、灰色下降，底板共用现有评分样式。
export function renderScore(cell, key, value) {
  const styled = appSettings.prediction.followRatingStyle && appSettings.colorRatings;
  cell.classList.toggle(
    'cf-prediction-legendary',
    !styled &&
      key === 'performance' &&
      Number.isFinite(value) &&
      rankForRating(value).legendary === true,
  );
  if (!Number.isFinite(value) && value !== Infinity) {
    plainValue(cell, 'N/A');
    return;
  }
  const delta = key === 'delta';
  applyRatingStyle(cell, delta ? (value > 0 ? 1300 : 1000) : value, {
    value,
    prefix: delta && value > 0 ? '+' : '',
    enabled: styled,
    preserveBackground: true,
    textColor: delta
      ? value > 0
        ? '#008000'
        : '#808080'
      : styled
        ? undefined
        : rankForRating(value).color,
  });
  cell.style.setProperty(
    '--cf-rating-selected-color',
    delta ? (value > 0 ? '#008000' : '#808080') : rankForRating(value).color,
  );
}

// 图标资源仅来自本项目，方向不依赖平台是否支持特殊 Unicode 字符。
export function setRankIcon(element, direction) {
  if (element.dataset.direction === direction) return;
  element.dataset.direction = direction;
  element.innerHTML = icons[direction];
}

// 档位缩写保留 CF 经典色，完整解释统一放在单元格。
function rankLabel(rank) {
  const span = document.createElement('span');
  span.className = 'cf-prediction-tier';
  span.textContent = rank.abbr;
  span.style.color = rank.color;
  span.classList.toggle('cf-prediction-tier-legendary', Boolean(rank.legendary));
  return span;
}

// 历史包含 P → P 之类的持平；实时显示到下一评级档位所需的增分。
export function renderRankProgress(cell, record, result, phase) {
  const progress = rankProgress(record, result?.delta, phase);
  // 以实际分数作渐变端点，缺值或分数完全持平时保留原站斑马纹。
  const before = progress?.final ? progress.before : record?.rating;
  const after = progress?.final
    ? progress.after
    : Number.isFinite(result?.delta)
      ? before + result.delta
      : null;
  const gradient =
    progress && Number.isFinite(before) && Number.isFinite(after) && before !== after;
  cell.classList.toggle('cf-prediction-rank-gradient', Boolean(gradient));
  if (gradient) {
    const solid =
      appSettings.prediction.followRatingStyle &&
      appSettings.colorRatings &&
      appSettings.displayStyle === 'block';
    const color = (rating) => (solid ? getRatingBgColor(rating) : getRatingTagStyle(rating).bg);
    cell.style.setProperty('--cf-rank-from', color(before));
    cell.style.setProperty('--cf-rank-to', color(after));
    cell.style.setProperty('--cf-rank-wash', solid ? '24%' : '75%');
  } else {
    cell.style.removeProperty('--cf-rank-from');
    cell.style.removeProperty('--cf-rank-to');
    cell.style.removeProperty('--cf-rank-wash');
  }
  const signature = JSON.stringify([progress, appSettings.lang]);
  if (cell.dataset.rankSignature === signature) return;
  cell.dataset.rankSignature = signature;
  cell.removeAttribute('data-tooltip-variant');
  if (!progress) {
    plainValue(cell, 'N/A');
    cell.dataset.tooltip = t('predictionNotApplicable');
    return;
  }
  const { current, next, direction, final, needed } = progress;
  const content = document.createElement('span');
  content.className = 'cf-prediction-rank-change';
  const icon = document.createElement('span');
  icon.className = 'cf-prediction-rank-arrow';
  setRankIcon(icon, direction);
  icon.style.color = next.color;
  if (final) {
    content.append(rankLabel(current), icon, rankLabel(next));
    const key =
      direction === 'up'
        ? 'predictionRankUp'
        : direction === 'down'
          ? 'predictionRankDown'
          : 'predictionRankSame';
    cell.dataset.tooltip = [
      `${current.name} → ${next.name}`,
      `${progress.before} → ${progress.after}`,
      t(key),
    ].join('\n');
    cell.dataset.tooltipVariant = 'prediction-rank';
  } else if (needed !== null) {
    const amount = document.createElement('span');
    amount.className = 'cf-prediction-rank-needed';
    amount.textContent = '+' + needed;
    content.append(amount, icon, rankLabel(next));
    cell.dataset.tooltip = t('predictionNextRank', needed, next.name);
  } else {
    content.append(rankLabel(next), icon, rankLabel(next));
    cell.dataset.tooltip = t('predictionTopRank');
  }
  cell.replaceChildren(content);
}
