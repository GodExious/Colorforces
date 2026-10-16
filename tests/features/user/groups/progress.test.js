import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLACK_INK,
  TOP_RATING,
  blackFirstLetter,
  nameInk,
  ratingProgress,
} from '../../../../src/features/user/groups/progress.js';

test('经验条按现在的评分：这一档走了几成、离下一档还差几分、两头的颜色', () => {
  const master = ratingProgress(2187);
  assert.equal(master.kind, 'rank');
  assert.equal(master.next, 'International Master');
  assert.equal(master.gap, 113);
  assert.ok(Math.abs(master.share - 0.435) < 1e-9);
  assert.equal(master.from, '#ff8c00');
  assert.equal(master.to, '#ff8c00');
  // 最低一档的下边按 0 分算，低于 0 的算 0。
  assert.deepEqual(
    [ratingProgress(0).share, ratingProgress(600).share, ratingProgress(-50).share],
    [0, 0.5, 0],
  );
  assert.equal(ratingProgress(0).next, 'Pupil');
  assert.equal(ratingProgress(0).gap, 1200);
});

test('3000～3999 分的下一档是 4000 分（段位名是自己的名字），条走到黑；4000 分以上、管理员、未评级各是一种', () => {
  const legend = ratingProgress(3216);
  assert.equal(legend.kind, 'legend');
  assert.equal(legend.gap, TOP_RATING - 3216);
  assert.equal(legend.to, BLACK_INK);
  assert.equal(legend.next, undefined);
  assert.deepEqual(ratingProgress(4009), { kind: 'top' });
  assert.deepEqual(ratingProgress(4009, true), { kind: 'admin' });
  assert.deepEqual(ratingProgress(null), { kind: 'unrated' });
});

test('名字的颜色：4000 分以上全黑，3000～3999 首字母黑，未评级用默认色', () => {
  assert.equal(nameInk(4009), BLACK_INK);
  assert.equal(nameInk(3216), '#ff0000');
  assert.equal(nameInk(1500), '#03a89e');
  assert.equal(nameInk(null), null);
  assert.deepEqual(
    [
      blackFirstLetter(3216),
      blackFirstLetter(4009),
      blackFirstLetter(2900),
      blackFirstLetter(null),
    ],
    [true, false, false, false],
  );
});
