import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RATING_RANKS,
  rankForRating,
  rankProgress,
  shownRating,
} from '../../../../../src/features/contest/rating-prediction/algorithm/ranks.js';

test('档位边界：下限含、上限不含', () => {
  assert.equal(rankForRating(1199).name, 'Newbie');
  assert.equal(rankForRating(1200).name, 'Pupil');
  assert.equal(rankForRating(1899).name, 'Expert');
  assert.equal(rankForRating(1900).name, 'Candidate Master');
  assert.equal(rankForRating(3999).name, 'Legendary Grandmaster');
  assert.equal(rankForRating(4000).name, 'Tourist');
  assert.equal(rankForRating(-50).name, 'Newbie');
});

test('档位表首尾相接', () => {
  for (let i = 1; i < RATING_RANKS.length; i++)
    assert.equal(RATING_RANKS[i].low, RATING_RANKS[i - 1].high);
});

test('缺少评级不当作 Newbie', () => {
  assert.equal(rankForRating(null).name, 'Unrated');
  assert.equal(rankForRating(undefined).name, 'Unrated');
  assert.equal(rankForRating(NaN).name, 'Unrated');
});

test('非计分记录没有晋级信息', () => {
  assert.equal(rankProgress({ status: 'unrated', reportedRating: 1500 }, 10, 'final'), null);
  assert.equal(rankProgress(null, 10, 'final'), null);
});

test('历史比赛优先使用官方赛后评级', () => {
  const result = rankProgress(
    { status: 'rated', reportedRating: 1590, newRating: 1610 },
    -100,
    'final',
  );
  assert.equal(result.direction, 'up');
  assert.equal(result.current.name, 'Specialist');
  assert.equal(result.next.name, 'Expert');
  assert.equal(result.before, 1590);
  assert.equal(result.after, 1610);
  assert.equal(result.final, true);
});

test('历史比赛缺少官方评级时用预测涨跌分推算', () => {
  const down = rankProgress({ status: 'rated', reportedRating: 1610 }, -20, 'final');
  assert.equal(down.direction, 'down');
  assert.equal(down.next.name, 'Specialist');
  const same = rankProgress({ status: 'rated', reportedRating: 1610 }, 20, 'final');
  assert.equal(same.direction, 'same');
  assert.equal(rankProgress({ status: 'rated', reportedRating: 1610 }, NaN, 'final'), null);
});

test('实时比赛只提示距下一档的差距', () => {
  const result = rankProgress({ status: 'rated', reportedRating: 1590, rating: 1590 }, 30, 'live');
  assert.equal(result.direction, 'up');
  assert.equal(result.next.name, 'Expert');
  assert.equal(result.needed, 10);
  assert.equal(result.final, false);
});

test('实时比赛：新号按显示的 0 分算距下一档的差距，不按算分用的 1400', () => {
  const fresh = rankProgress({ status: 'rated', reportedRating: 0, rating: 1400 }, 500, 'live');
  assert.equal(fresh.next.name, 'Pupil');
  assert.equal(fresh.needed, 1200);
  // 比赛进行中还没有评级的新号：读到的显示评级是 null，也按 0 分算。
  const unseen = rankProgress(
    { status: 'rated', reportedRating: null, rating: 1400, initial: true },
    500,
    'live',
  );
  assert.equal(unseen.next.name, 'Pupil');
  assert.equal(unseen.needed, 1200);
  // 不是新号、又读不到显示的评级：用算分的起点。
  const other = rankProgress({ status: 'rated', reportedRating: null, rating: 1500 }, 5, 'live');
  assert.equal(other.next.name, 'Expert');
  assert.equal(other.needed, 100);
});

test('赛前显示的评级：有就用它；没有评级的新号是 0；别的读不到时用算分的起点', () => {
  assert.equal(shownRating({ reportedRating: 1534, rating: 1534 }), 1534);
  assert.equal(shownRating({ reportedRating: null, rating: 1400, initial: true }), 0);
  assert.equal(shownRating({ reportedRating: null, rating: 1500 }), 1500);
});

test('出分前的首场新号：从显示的 0 分算起，补过分的涨跌直接加上去', () => {
  const result = rankProgress(
    { status: 'rated', reportedRating: null, initial: true, rating: 1400 },
    1250,
    'final',
  );
  assert.equal(result.current.name, 'Newbie');
  assert.equal(result.next.name, 'Pupil');
  assert.equal(result.before, 0);
  assert.equal(result.after, 1250);
  assert.equal(
    rankProgress({ status: 'rated', reportedRating: null, rating: 1500 }, 10, 'final'),
    null,
  );
});

test('实时比赛：最高档没有下一档，缺少评级不提示', () => {
  const top = rankProgress({ status: 'rated', reportedRating: 4100, rating: 4100 }, 5, 'live');
  assert.equal(top.direction, 'same');
  assert.equal(top.needed, null);
  assert.equal(top.next.name, 'Tourist');
  assert.equal(rankProgress({ status: 'rated', reportedRating: 1500 }, 5, 'live'), null);
});
