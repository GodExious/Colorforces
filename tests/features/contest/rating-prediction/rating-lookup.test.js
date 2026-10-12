import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRating,
  pendingLookups,
  readLookups,
  unknownHandle,
} from '../../../../src/features/contest/rating-prediction/rating-lookup.js';

const source = {
  ratings: { Um_nik: 3387 },
  looked: { anmichi: 2503, newcomer: null },
};

test('赛前评级依次取上一次快照、名单、按账号查到的', () => {
  assert.equal(resolveRating('Um_nik', undefined, source), 3387);
  assert.equal(resolveRating('anmichi', undefined, source), 2503);
  assert.equal(resolveRating('Um_nik', { reportedRating: 3400 }, source), 3400);
  assert.equal(resolveRating('newcomer', undefined, source), null);
  assert.equal(resolveRating('nobody', undefined, source), null);
  assert.equal(resolveRating('nobody', undefined, null), null);
});

test('上一次快照里没查到评级的人，后来查到了就用查到的', () => {
  assert.equal(resolveRating('anmichi', { reportedRating: null }, source), 2503);
});

test('账号叫 constructor 也不会取到对象自带的东西', () => {
  assert.equal(resolveRating('constructor', undefined, source), null);
  assert.deepEqual(pendingLookups(['constructor'], source, new Map()), ['constructor']);
});

test('只查哪里都没有评级、也没查过的人', () => {
  const previousRows = new Map([
    ['old', { reportedRating: 1500 }],
    ['blank', { reportedRating: null }],
  ]);
  const handles = ['Um_nik', 'anmichi', 'newcomer', 'old', 'blank', 'fresh', 'fresh', ''];
  assert.deepEqual(pendingLookups(handles, source, previousRows), ['blank', 'fresh']);
  assert.deepEqual(pendingLookups(handles, null, previousRows), [
    'Um_nik',
    'anmichi',
    'newcomer',
    'blank',
    'fresh',
  ]);
});

test('查到的结果按位置对回账号', () => {
  const users = [{ handle: 'Kurumi961', rating: 1200 }, { handle: 'b' }];
  assert.deepEqual(readLookups(['Kuromi961', 'b'], users), { Kuromi961: 1200, b: null });
  assert.deepEqual(readLookups(['a', 'b'], [{ handle: 'a', rating: 1 }]), {});
  assert.deepEqual(readLookups(['a'], null), {});
});

test('从报错里认出查不到的账号', () => {
  assert.equal(unknownHandle('handles: User with handle Kuromi961 not found'), 'Kuromi961');
  assert.equal(unknownHandle('Call limit exceeded'), null);
  assert.equal(unknownHandle(undefined), null);
});
