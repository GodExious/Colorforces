import { isTeamCell } from '../../user/avatars/structure.js';

const heightProperty = '--cf-rating-row-height';
// 量到这么多行正式参赛的行就够了，不必在大榜单上逐行测量。
const sampleSize = 8;
// 赛后练习的行可能排在前面，往下多找一段才能碰到正式参赛的行；再往后就不找了。
const scanLimit = 80;

// 正式参赛的行，题目格里是「得分 + 用时」两行。只认有内容的用时：
// 赛后练习的行也可能带一个空的用时节点，它不占高度，不能算数。
function hasSolveTime(row) {
  for (const time of row.querySelectorAll('.cell-time')) if (time.textContent.trim()) return true;
  return false;
}

// 评分行要对齐的是正式参赛的行，而不是更矮的赛后练习行。依次尝试：
// 1. 带用时的行里最矮的一行（队伍行更高，取最矮的避免被带高）；
// 2. 认不出用时的时候，取单人行里最高的一行（单人行不折行，最高的就是两行的正式行）；
// 3. 都没有时，取所有选手行里最矮的一行。
function participantRowHeight(table) {
  const timed = [];
  const single = [];
  const all = [];
  let scanned = 0;
  for (const row of table.rows) {
    const who = row.querySelector('td.contestant-cell');
    if (!who) continue;
    if (++scanned > scanLimit) break;
    const height = row.getBoundingClientRect().height;
    if (!height) continue;
    all.push(height);
    if (!isTeamCell(who)) single.push(height);
    if (hasSolveTime(row)) {
      timed.push(height);
      if (timed.length >= sampleSize) break;
    }
  }
  if (timed.length) return Math.min(...timed);
  if (single.length) return Math.max(...single);
  return all.length ? Math.min(...all) : 0;
}

// 榜单评分行与下方选手行等高。选手行的高度会随头像开关、头像大小、原站重绘而变，
// 所以监听表格尺寸，变了就重新对齐；写入放到下一帧，避免在尺寸回调里直接改布局。
export function followParticipantRowHeight(table, ratingRow) {
  if (typeof ResizeObserver !== 'function') return;
  let frame = 0;
  const observer = new ResizeObserver(() => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!ratingRow.isConnected) {
        observer.disconnect();
        return;
      }
      const height = participantRowHeight(table);
      const value = height ? height + 'px' : '';
      if (ratingRow.style.getPropertyValue(heightProperty) === value) return;
      if (value) ratingRow.style.setProperty(heightProperty, value);
      else ratingRow.style.removeProperty(heightProperty);
    });
  });
  observer.observe(table);
}
