import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readReply,
  noRatingChanges,
} from '../../../../src/features/contest/rating-prediction/api-reply.js';

test('接口答 OK：取结果', () => {
  assert.deepEqual(readReply({ status: 'OK', result: [1, 2] }), { result: [1, 2] });
  assert.deepEqual(readReply({ status: 'OK', result: [] }), { result: [] });
});

test('接口自己报错：算业务错误，带上原因（HTTP 状态是 400 也一样）', () => {
  const reply = readReply({
    status: 'FAILED',
    comment: 'contestId: Rating changes are unavailable for this contest',
  });
  assert.equal(reply.error, 'predictionApiError');
  assert.ok(noRatingChanges(reply.comment));
  assert.equal(readReply({ status: 'FAILED' }).comment, '');
});

test('正文读不出来或者不是接口的格式：算网络错误', () => {
  assert.equal(readReply(null).error, 'predictionNetworkError');
  assert.equal(readReply(undefined).error, 'predictionNetworkError');
  assert.equal(readReply({}).error, 'predictionNetworkError');
  assert.equal(readReply('<html>').error, 'predictionNetworkError');
});

test('只有「没有评级变化」才当成没出分或不计分，别的报错不算', () => {
  assert.ok(noRatingChanges('contestId: Rating changes are unavailable for this contest'));
  assert.ok(!noRatingChanges('Call limit exceeded'));
  assert.ok(!noRatingChanges('handles: User with handle abc not found'));
  assert.ok(!noRatingChanges(''));
  assert.ok(!noRatingChanges(undefined));
});
