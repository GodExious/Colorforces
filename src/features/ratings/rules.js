import { isDarkTheme } from '../page/theme.js';

// 依据评分段获取原版评分块背景色。
export function getRatingBgColor(rating) {
  if (isDarkTheme()) {
    if (rating < 1200) return '#444444'; // Gray
    if (rating < 1400) return '#1A4D1A'; // Green
    if (rating < 1600) return '#1A4D4D'; // Cyan
    if (rating < 1900) return '#1A1A4D'; // Blue
    if (rating < 2100) return '#4D1A4D'; // Violet
    if (rating < 2300) return '#705300'; // Yellow (Master)
    if (rating < 2400) return '#804000'; // Orange (International Master)
    if (rating < 2600) return '#661414'; // Light Red (Grandmaster)
    if (rating < 3000) return '#851515'; // Red (International Grandmaster)
    return '#800000'; // Dark Red
  }
  if (rating < 1200) return '#CCCCCC'; // Gray (Newbie)
  if (rating < 1400) return '#77FF77'; // Green (Pupil)
  if (rating < 1600) return '#77DDBB'; // Cyan (Specialist)
  if (rating < 1900) return '#AAAAFF'; // Blue (Expert)
  if (rating < 2100) return '#FF88FF'; // Violet (Candidate Master)
  if (rating < 2300) return '#FFCC88'; // Light Orange (Master)
  if (rating < 2400) return '#FFBB55'; // Orange (International Master)
  if (rating < 2600) return '#FF7777'; // Light Red (Grandmaster)
  if (rating < 3000) return '#FF3333'; // Red (International Grandmaster)
  return '#CC2222'; // Dark Red (Legendary Grandmaster+)
}

// 依据评分段获取原版边框色。
export function getRatingBorderColor(rating) {
  if (rating < 1200) return '#AAAAAA'; // Gray
  if (rating < 1400) return '#44CC44'; // Green
  if (rating < 1600) return '#44AA88'; // Cyan
  if (rating < 1900) return '#7777CC'; // Blue
  if (rating < 2100) return '#CC55CC'; // Violet
  if (rating < 2300) return '#CC9955'; // Light Orange
  if (rating < 2400) return '#CC8822'; // Orange
  if (rating < 2600) return '#CC4444'; // Light Red
  if (rating < 3000) return '#CC0000'; // Red
  return '#990000'; // Dark Red
}

// 依据评分段获取原版文字色。
export function getRatingTextColor(rating) {
  if (rating < 1200) return '#808080';
  if (rating < 1400) return '#008000';
  if (rating < 1600) return '#03A89E';
  if (rating < 1900) return '#0000FF';
  if (rating < 2100) return '#AA00AA';
  if (rating < 2300) return '#FF8C00';
  if (rating < 2400) return '#FF8C00';
  if (rating < 2600) return '#FF5555'; // Light Red (Grandmaster)
  if (rating < 3000) return '#FF0000'; // Red (International Grandmaster)
  return '#AA0000';
}

// 返回当前主题下评分标签的背景、边框和文字配色。
export function getRatingTagStyle(rating) {
  let bg, border, text;
  const isDark = isDarkTheme();
  if (rating < 1200) {
    bg = isDark ? '#444444' : '#f7f7f7';
    border = isDark ? '#666666' : '#cccccc';
    text = isDark ? '#e6e6e6' : '#808080';
  } // Gray
  else if (rating < 1400) {
    bg = isDark ? '#135200' : '#f6ffed';
    border = isDark ? '#237804' : '#a8e67a';
    text = isDark ? '#73d13d' : '#389e0d';
  } // Green
  else if (rating < 1600) {
    bg = isDark ? '#00474f' : '#e6fffb';
    border = isDark ? '#006d75' : '#76ded3';
    text = isDark ? '#36cfc9' : '#08979c';
  } // Cyan
  else if (rating < 1900) {
    bg = isDark ? '#002c8c' : '#e6f7ff';
    border = isDark ? '#003eb3' : '#80c8f8';
    text = isDark ? '#40a9ff' : '#096dd9';
  } // Blue
  else if (rating < 2100) {
    bg = isDark ? '#531dab' : '#f9f0ff';
    border = isDark ? '#722ed1' : '#c79cf0';
    text = isDark ? '#b37feb' : '#531dab';
  } // Violet
  else if (rating < 2300) {
    bg = isDark ? '#8c6900' : '#feffe6';
    border = isDark ? '#d4b106' : '#fffb8f';
    text = isDark ? '#fffb8f' : '#d4b106';
  } // Yellow (Master)
  else if (rating < 2400) {
    bg = isDark ? '#994d00' : '#fffbe6';
    border = isDark ? '#fa8c16' : '#ffe58f';
    text = isDark ? '#ffe58f' : '#d48806';
  } // Orange (International Master)
  else if (rating < 2600) {
    bg = isDark ? '#a8071a' : '#fff7f7';
    border = isDark ? '#ff4d4f' : '#ffccc7';
    text = isDark ? '#ffd8d6' : '#db2734';
  } // Light Red (Grandmaster)
  else if (rating < 3000) {
    bg = isDark ? '#820014' : '#fff1f0';
    border = isDark ? '#cf1322' : '#ffa39e';
    text = isDark ? '#ff7875' : '#cf1322';
  } // Deep Red (International Grandmaster)
  else {
    bg = isDark ? '#780650' : '#fff0f6';
    border = isDark ? '#c41d7f' : '#ff9ec7';
    text = isDark ? '#ffadd2' : '#c41d7f';
  } // Dark Red / Magenta (Legendary)
  return { bg, border, text };
}
