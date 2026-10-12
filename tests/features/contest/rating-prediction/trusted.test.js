import test from 'node:test';
import assert from 'node:assert/strict';
import {
  untrustedHandles,
  isJudged,
  applySubmission,
  icpcResult,
  cloneTally,
  settleTally,
  UNSETTLED_LIMIT,
} from '../../../../src/features/contest/rating-prediction/trusted.js';

const submit = (tally, index, verdict, minutes, passed = 3, handle = 'carol') =>
  applySubmission(tally, { handle, index, verdict, passed, seconds: minutes * 60 + 30 });

test('正式交过题却不在名单里的，认作不在官方榜单内的参赛者', () => {
  const snapshot = {
    name: 'Codeforces Round 1125 (Div. 3)',
    phase: 'live',
    participants: [{ handle: 'Alice' }, { handle: 'bob' }],
    activity: { complete: true, handles: ['alice', 'Bob', 'Carol', 'dave'] },
  };
  assert.deepEqual([...untrustedHandles(snapshot)].sort(), ['carol', 'dave']);
  assert.equal(untrustedHandles({ ...snapshot, phase: 'pending' }).size, 2);
  // 成绩补得出来的比赛，这些人已经在名单里，不会再认一遍。
  const complete = {
    ...snapshot,
    participants: [...snapshot.participants, { handle: 'carol' }, { handle: 'Dave' }],
  };
  assert.equal(untrustedHandles(complete).size, 0);
  // 不看比赛的名字：Div. 2、Educational 的官方榜单同样缺人。
  assert.equal(untrustedHandles({ ...snapshot, name: 'Codeforces Round 1124 (Div. 2)' }).size, 2);
  // 已经出分、提交记录没扫完时不判定。
  assert.equal(untrustedHandles({ ...snapshot, phase: 'final' }).size, 0);
  assert.equal(
    untrustedHandles({ ...snapshot, activity: { complete: false, handles: ['carol'] } }).size,
    0,
  );
  assert.equal(untrustedHandles({ ...snapshot, activity: null }).size, 0);
  assert.equal(untrustedHandles(null).size, 0);
});

test('罚时：通过时的分钟数加上之前每次被拒 10 分钟', () => {
  const tally = {};
  submit(tally, 'A', 'OK', 4);
  submit(tally, 'B', 'WRONG_ANSWER', 10);
  submit(tally, 'B', 'TIME_LIMIT_EXCEEDED', 15);
  submit(tally, 'B', 'OK', 21);
  // 没过的题不计分，也不带来罚时。
  submit(tally, 'C', 'WRONG_ANSWER', 30);
  assert.deepEqual(tally.carol, { A: [4, 0], B: [21, 2], C: [-1, 1] });
  assert.deepEqual(icpcResult(tally.carol), { points: 2, penalty: 4 + 21 + 20 });
});

test('编译错误、被跳过、还在评测、第一个测试点就没过的都不罚时', () => {
  const tally = {};
  submit(tally, 'A', 'COMPILATION_ERROR', 1, 0);
  submit(tally, 'A', 'SKIPPED', 2);
  submit(tally, 'A', 'TESTING', 3);
  submit(tally, 'A', 'WRONG_ANSWER', 4, 0);
  submit(tally, 'A', 'RUNTIME_ERROR', 5, 1);
  submit(tally, 'A', 'OK', 9);
  assert.deepEqual(icpcResult(tally.carol), { points: 1, penalty: 9 + 10 });
});

test('一道题通过之后的提交不再算', () => {
  const tally = {};
  submit(tally, 'A', 'OK', 7);
  submit(tally, 'A', 'WRONG_ANSWER', 20);
  submit(tally, 'A', 'OK', 40);
  assert.deepEqual(tally.carol.A, [7, 0]);
});

test('只交过不算数的提交也算参赛，成绩是零', () => {
  const tally = {};
  submit(tally, 'A', 'COMPILATION_ERROR', 1, 0);
  assert.deepEqual(icpcResult(tally.carol), { points: 0, penalty: 0 });
  assert.deepEqual(icpcResult(undefined), { points: 0, penalty: 0 });
});

test('评测完没有：没有结果或还在评测的不算', () => {
  assert.equal(isJudged('OK'), true);
  assert.equal(isJudged('WRONG_ANSWER'), true);
  assert.equal(isJudged('TESTING'), false);
  assert.equal(isJudged(undefined), false);
});

test('复制出来的统计和原来的互不影响', () => {
  const tally = {};
  submit(tally, 'A', 'WRONG_ANSWER', 3);
  const copy = cloneTally(tally);
  submit(copy, 'A', 'OK', 8);
  assert.deepEqual(tally.carol.A, [-1, 1]);
  assert.deepEqual(copy.carol.A, [8, 1]);
  assert.deepEqual(cloneTally(undefined), {});
});

// 一场里的几条提交：编号越大越晚。
const entry = (id, index, verdict, minutes, passed = 3) => ({
  id,
  handle: 'carol',
  index,
  verdict,
  passed,
  seconds: minutes * 60,
});

test('接着上次扫：分两次并进去和一次全并进去的结果一样', () => {
  const all = [
    entry(11, 'A', 'WRONG_ANSWER', 3),
    entry(12, 'A', 'OK', 6),
    entry(13, 'B', 'WRONG_ANSWER', 9),
    entry(14, 'B', 'OK', 15),
  ];
  const once = settleTally(undefined, all, { newestId: 14 });
  const first = settleTally(undefined, all.slice(0, 2).reverse(), { newestId: 12 });
  const second = settleTally(first.tally, all.slice(2).reverse(), { priorId: 12, newestId: 14 });
  assert.equal(second.settledId, 14);
  assert.deepEqual(second.tally, once.tally);
  assert.deepEqual(icpcResult(second.view.carol), { points: 2, penalty: 6 + 10 + 15 + 10 });
});

test('有还在评测的提交时停在它前面，下次重读，结果不重复也不遗漏', () => {
  const round1 = [
    entry(21, 'A', 'WRONG_ANSWER', 3),
    entry(22, 'A', 'TESTING', 5),
    entry(23, 'B', 'OK', 8),
  ];
  const first = settleTally(undefined, round1, { newestId: 23, pendingId: 22 });
  // 只记到 21；23 已经评测完，算进这一次的成绩，但不存。
  assert.equal(first.settledId, 21);
  assert.deepEqual(first.tally.carol, { A: [-1, 1] });
  assert.deepEqual(icpcResult(first.view.carol), { points: 1, penalty: 8 });
  // 下一次从 21 之后重读：22 评测完了，是通过。
  const round2 = [entry(22, 'A', 'OK', 5), entry(23, 'B', 'OK', 8)];
  const second = settleTally(first.tally, round2, { priorId: 21, newestId: 23 });
  assert.equal(second.settledId, 23);
  assert.deepEqual(second.tally.carol, { A: [5, 1], B: [8, 0] });
  assert.deepEqual(icpcResult(second.view.carol), { points: 2, penalty: 5 + 10 + 8 });
});

test('卡在评测里太久的提交不再等，回头的距离有上限', () => {
  const stuck = 100;
  const newest = stuck + UNSETTLED_LIMIT + 50;
  const { settledId } = settleTally(undefined, [entry(stuck, 'A', 'TESTING', 1)], {
    newestId: newest,
    pendingId: stuck,
  });
  assert.equal(settledId, newest - UNSETTLED_LIMIT);
});

test('按分数算的赛制：一道题的得分', async () => {
  const { problemScore } =
    await import('../../../../src/features/contest/rating-prediction/trusted.js');
  // Round 1126（180 分钟）官方榜单上的几格。
  assert.equal(problemScore(500, 7, 0, 180), 491);
  assert.equal(problemScore(1000, 24, 1, 180), 886);
  assert.equal(problemScore(1250, 71, 0, 180), 1014);
  assert.equal(problemScore(1750, 27, 0, 180), 1624);
  assert.equal(problemScore(3000, 85, 0, 180), 2320);
  assert.equal(problemScore(500, 54, 0, 180), 428);
  // 扣到三成封底。
  assert.equal(problemScore(500, 170, 5, 180), 150);
  // 135 分钟和 120 分钟衰减一样（按半小时取整）。
  assert.equal(problemScore(1000, 60, 0, 135), problemScore(1000, 60, 0, 120));
});

test('按分数算的赛制：取最后一次通过，之前算数的提交各算一次', async () => {
  const { applyScoredSubmission, scoredResult } =
    await import('../../../../src/features/contest/rating-prediction/trusted.js');
  const tally = {};
  const submit = (index, verdict, minute, passed = 3) =>
    applyScoredSubmission(tally, { handle: 'u', index, verdict, passed, seconds: minute * 60 + 5 });
  // A：编译错误和第一个测试点就错的不算，一次真的答错算，然后通过。
  submit('A', 'COMPILATION_ERROR', 1, 0);
  submit('A', 'WRONG_ANSWER', 2, 0);
  submit('A', 'WRONG_ANSWER', 3, 2);
  submit('A', 'OK', 7);
  assert.deepEqual(tally.u.A, [7 * 60 + 5, 1, 2]);
  // B：通过之后又重交通过，算后一次，前一次通过也算一次提交。
  submit('B', 'OK', 10);
  submit('B', 'OK', 24);
  assert.deepEqual(tally.u.B, [24 * 60 + 5, 1, 2]);
  // C：被重交顶掉的（SKIPPED，过的测试点数还留着）也算，一个测试点都没过的 SKIPPED 不算；之后没再通过就是没过。
  submit('C', 'SKIPPED', 30, 6);
  submit('C', 'SKIPPED', 35, 0);
  submit('C', 'TIME_LIMIT_EXCEEDED', 40, 4);
  assert.deepEqual(tally.u.C, [-1, 0, 2]);
  // 还在评测的不算。
  submit('D', 'TESTING', 50, 0);
  assert.equal(tally.u.D, undefined);
  const result = scoredResult(tally.u, { A: 500, B: 1000, C: 1250 }, 180 * 60);
  assert.deepEqual(result, { points: 441 + 886, penalty: 0 });
});

test('按分数算的赛制的统计也能接着上次往后记', async () => {
  const { applyScoredSubmission } =
    await import('../../../../src/features/contest/rating-prediction/trusted.js');
  const first = settleTally(
    undefined,
    [{ id: 1, handle: 'u', index: 'A', verdict: 'WRONG_ANSWER', passed: 1, seconds: 60 }],
    { newestId: 1 },
    applyScoredSubmission,
  );
  const second = settleTally(
    first.tally,
    [{ id: 2, handle: 'u', index: 'A', verdict: 'OK', passed: 9, seconds: 300 }],
    { priorId: 1, newestId: 2 },
    applyScoredSubmission,
  );
  assert.deepEqual(second.tally.u.A, [300, 1, 2]);
  assert.deepEqual(first.tally.u.A, [-1, 0, 1]);
});
