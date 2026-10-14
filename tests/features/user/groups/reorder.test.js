import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeGroups, stepOrder } from '../../../../src/features/user/groups/reorder.js';

// 一张假的列表：各行从 0 往下排，heights 是各分组的行高。middles(order) 给出按这个先后排好时每一行的中线。
function middles(order, heights) {
  const middle = new Map();
  let top = 0;
  for (const id of order) {
    middle.set(id, top + heights[id] / 2);
    top += heights[id];
  }
  return (id) => (middle.has(id) ? middle.get(id) : NaN);
}
// 被拖的那一行顶边在 top 时，按规则走一步。
const step = (order, id, top, heights) =>
  stepOrder(order, id, top, top + heights[id], middles(order, heights));
// 把被拖的那一行慢慢拖到 target（顶边的纵坐标），每移动 1px 走一步，返回最后的先后和一路上换位的次数。
function dragTo(order, id, from, target, heights) {
  let swaps = 0;
  const direction = Math.sign(target - from);
  for (
    let top = from;
    direction ? (target - top) * direction >= 0 : top === from;
    top += direction || 1
  ) {
    const next = step(order, id, top, heights);
    if (next !== order) swaps++;
    order = next;
  }
  return { order, swaps };
}
const EVEN = { a: 40, b: 40, c: 40, d: 40 };

test('往下拖：下边过了下一行的中线才换位，没过时原样返回', () => {
  const order = ['a', 'b', 'c'];
  // a 在第一格（0–40），下一行 b 的中线在 60。a 的下边到 60 之前不动。
  assert.equal(step(order, 'a', 0, EVEN), order);
  assert.equal(step(order, 'a', 20, EVEN), order);
  assert.deepEqual(step(order, 'a', 21, EVEN), ['b', 'a', 'c']);
});

test('往上拖：上边过了上一行的中线才换位', () => {
  const order = ['a', 'b', 'c'];
  // c 在第三格（80–120），上一行 b 的中线在 60。
  assert.equal(step(order, 'c', 80, EVEN), order);
  assert.equal(step(order, 'c', 60, EVEN), order);
  assert.deepEqual(step(order, 'c', 59, EVEN), ['a', 'c', 'b']);
});

test('一次只挪一格，接着拖才继续挪', () => {
  const order = ['a', 'b', 'c', 'd'];
  // a 的顶边一下子到了最底下：这一步只和 b 换。
  const first = step(order, 'a', 120, EVEN);
  assert.deepEqual(first, ['b', 'a', 'c', 'd']);
  assert.deepEqual(step(first, 'a', 120, EVEN), ['b', 'c', 'a', 'd']);
});

test('被挡在列表两头时，换得到第一个和最后一个位置', () => {
  const order = ['a', 'b', 'c', 'd'];
  // 列表从 0 到 160，被拖的行出不去：顶边最小是 0，最大是 120。
  assert.deepEqual(dragTo(order, 'd', 120, 0, EVEN).order, ['d', 'a', 'b', 'c']);
  assert.deepEqual(dragTo(order, 'a', 0, 120, EVEN).order, ['b', 'c', 'd', 'a']);
  // 只有两行时也一样。
  const pair = { a: 40, b: 40 };
  assert.deepEqual(dragTo(['a', 'b'], 'b', 40, 0, pair).order, ['b', 'a']);
  assert.deepEqual(dragTo(['a', 'b'], 'a', 0, 40, pair).order, ['b', 'a']);
});

test('换过去和换回来是同一条线：停在原处不会来回换', () => {
  const order = ['a', 'b', 'c'];
  const moved = step(order, 'a', 21, EVEN);
  // 换位之后列表重排了，鼠标没动：再算一遍不该换回去。
  assert.equal(step(moved, 'a', 21, EVEN), moved);
  // 往回退 1px 以上才换回去。
  assert.equal(step(moved, 'a', 20, EVEN), moved);
  assert.deepEqual(step(moved, 'a', 19, EVEN), order);
  // 整个拖过去，每越过一行只换一次。
  assert.equal(dragTo(['a', 'b', 'c', 'd'], 'a', 0, 120, EVEN).swaps, 3);
  assert.equal(dragTo(['a', 'b', 'c', 'd'], 'd', 120, 0, EVEN).swaps, 3);
});

test('行高不一样时（有的分组展开着）也是同一条线，来回都稳', () => {
  const heights = { a: 40, b: 200, c: 40 };
  const order = ['a', 'b', 'c'];
  // b 展开着，中线在 140；a 的下边过了 140 才换。
  assert.equal(step(order, 'a', 100, heights), order);
  const moved = step(order, 'a', 101, heights);
  assert.deepEqual(moved, ['b', 'a', 'c']);
  assert.equal(step(moved, 'a', 101, heights), moved);
  assert.deepEqual(step(moved, 'a', 99, heights), order);
  // 拖的是展开着的那一行。
  const tall = step(['b', 'a', 'c'], 'b', 21, heights);
  assert.deepEqual(tall, ['a', 'b', 'c']);
  assert.equal(step(tall, 'b', 21, heights), tall);
  assert.deepEqual(dragTo(order, 'a', 0, 240, heights).order, ['b', 'c', 'a']);
  assert.deepEqual(dragTo(order, 'c', 240, 0, heights).order, ['c', 'a', 'b']);
});

test('量不到相邻的行、被拖的不在名单里时，什么都不动', () => {
  const order = ['a', 'b'];
  assert.equal(
    stepOrder(order, 'a', 500, 540, () => NaN),
    order,
  );
  assert.equal(
    stepOrder(order, 'b', -500, -460, () => NaN),
    order,
  );
  assert.equal(step(order, 'zzz', 0, { ...EVEN, zzz: 40 }), order);
  // 只有一行时没有可换的。
  const single = ['a'];
  assert.equal(step(single, 'a', 999, EVEN), single);
  // 不改传进来的数组。
  const before = ['a', 'b', 'c'];
  step(before, 'a', 100, EVEN);
  assert.deepEqual(before, ['a', 'b', 'c']);
});

test('拖的过程中列表照临时的先后排：「好友」总在最前，不在名单里的排到最后', () => {
  const groups = [
    { id: 'friends', builtin: true },
    { id: 'g1', builtin: false },
    { id: 'g2', builtin: false },
    { id: 'g3', builtin: false },
  ];
  const ids = (list) => list.map((group) => group.id);
  assert.deepEqual(ids(arrangeGroups(groups, ['g3', 'g1', 'g2'])), ['friends', 'g3', 'g1', 'g2']);
  // 拖的过程中别处新建了 g4、g5：排在后面，彼此的先后不变。
  const more = [...groups, { id: 'g4', builtin: false }, { id: 'g5', builtin: false }];
  assert.deepEqual(ids(arrangeGroups(more, ['g2', 'g1', 'g3'])), [
    'friends',
    'g2',
    'g1',
    'g3',
    'g4',
    'g5',
  ]);
  // 名单里有已经不存在的分组：不管它。原来的列表不被改动。
  assert.deepEqual(ids(arrangeGroups(groups, ['gone', 'g2', 'g1'])), ['friends', 'g2', 'g1', 'g3']);
  assert.deepEqual(ids(groups), ['friends', 'g1', 'g2', 'g3']);
});
