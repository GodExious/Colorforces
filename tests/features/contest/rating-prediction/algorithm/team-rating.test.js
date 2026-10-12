import test from 'node:test';
import assert from 'node:assert/strict';
import { teamRating } from '../../../../../src/features/contest/rating-prediction/algorithm/team-rating.js';

test('一个人的队就是他自己的评级', () => {
  assert.equal(teamRating([1873]), 1873);
});

test('两人队的评级：VK Cup 2018 Round 1 前三名的实际数值', () => {
  assert.equal(teamRating([2472, 2115]).toFixed(1), '2508.3');
  assert.equal(teamRating([2387, 2665]).toFixed(1), '2717.3');
  assert.equal(teamRating([2141, 2232]).toFixed(1), '2343.8');
});

test('和队员的先后无关，不低于最强的队员，多一个人只会更高', () => {
  assert.equal(teamRating([1500, 2100]), teamRating([2100, 1500]));
  assert.ok(teamRating([1500, 2100]) > 2100);
  assert.ok(teamRating([1500, 2100, 1900]) > teamRating([1500, 2100]));
});
