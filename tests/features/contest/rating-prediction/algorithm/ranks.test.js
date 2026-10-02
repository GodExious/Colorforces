import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RATING_RANKS,
  rankForRating,
  rankProgress,
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

test('实时比赛：最高档没有下一档，缺少评级不提示', () => {
  const top = rankProgress({ status: 'rated', reportedRating: 4100, rating: 4100 }, 5, 'live');
  assert.equal(top.direction, 'same');
  assert.equal(top.needed, null);
  assert.equal(top.next.name, 'Tourist');
  assert.equal(rankProgress({ status: 'rated', reportedRating: 1500 }, 5, 'live'), null);
});
