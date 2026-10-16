import test from 'node:test';
import assert from 'node:assert/strict';
import { paintPixels } from '../../../../../src/ui/components/forms/EffortSlider/pixels.js';

// 一张假画布：记下画了几格、每格的透明度和画在哪。
function canvas() {
  const cells = [];
  let alpha = 1;
  const context = {
    clearRect() {},
    fillRect(x, y, w, h) {
      cells.push({ x, y, w, h, alpha });
    },
    set globalAlpha(value) {
      alpha = value;
    },
    get globalAlpha() {
      return alpha;
    },
    set fillStyle(value) {
      assert.match(value, /^rgb\(\d+ \d+ \d+\)$/);
    },
  };
  return { context, cells };
}
const paint = (progress, elapsed = 1600) => {
  const { context, cells } = canvas();
  paintPixels(context, { width: 244, height: 28, progress, elapsed, flow: 0.3 });
  return cells;
};

test('第一档不画；往上一档比一档多、一档比一档浓；透明度都在 0～1', () => {
  assert.equal(paint(0).length, 0);
  const levels = [0.25, 0.5, 0.75, 1].map((progress) => paint(progress));
  const average = (cells) => cells.reduce((sum, cell) => sum + cell.alpha, 0) / cells.length;
  for (let i = 1; i < levels.length; i += 1) {
    assert.ok(levels[i].length > levels[i - 1].length, `第 ${i + 2} 档比上一档多`);
    assert.ok(average(levels[i]) > average(levels[i - 1]), `第 ${i + 2} 档比上一档浓`);
  }
  for (const cell of levels.flat()) assert.ok(cell.alpha > 0 && cell.alpha <= 1);
});

test('只画在滑块左边填过的那段；最后一档整条都画', () => {
  // 第三档：滑块圆心在 13 + (244 - 26) × 0.5 = 122。
  for (const cell of paint(0.5)) assert.ok(cell.x < 122, `x = ${cell.x}`);
  assert.ok(paint(1).some((cell) => cell.x > 236));
});

test('同一时刻画出来的一样（每格的「随机数」是固定的）；过一会儿闪的样子会变', () => {
  assert.deepEqual(paint(0.75, 2000), paint(0.75, 2000));
  assert.notDeepEqual(paint(0.75, 2000), paint(0.75, 2600));
});
