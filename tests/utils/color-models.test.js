import test from 'node:test';
import assert from 'node:assert/strict';
import { hexToHsl, hexToHsv, hslToHex, hsvToHex, readHex } from '../../src/utils/color-models.js';

// 一串固定的色值，加上按固定规律铺开的一千多个，免得测试每次跑的不一样。
const SAMPLES = ['#000000', '#ffffff', '#808080', '#ff0000', '#00ff00', '#0000ff', '#bc7bc5'];
for (let n = 0; n < 1200; n++)
  SAMPLES.push('#' + ((n * 13999 + 7) % 0x1000000).toString(16).padStart(6, '0'));

test('色值换成 HSL、HSV 再换回来，和原来的一样', () => {
  for (const hex of SAMPLES) {
    const hsl = hexToHsl(hex);
    const hsv = hexToHsv(hex);
    assert.equal(hslToHex(hsl.h ?? 0, hsl.s, hsl.l), hex, `HSL ${hex}`);
    assert.equal(hsvToHex(hsv.h ?? 0, hsv.s, hsv.v), hex, `HSV ${hex}`);
  }
});

test('灰色、黑、白没有色相；纯色的色相、饱和度、亮度和明度', () => {
  for (const hex of ['#000000', '#ffffff', '#4a4a4a']) {
    assert.equal(hexToHsl(hex).h, null);
    assert.equal(hexToHsv(hex).h, null);
    assert.equal(hexToHsl(hex).s, 0);
  }
  assert.deepEqual(hexToHsl('#ff0000'), { h: 0, s: 1, l: 0.5 });
  assert.deepEqual(hexToHsv('#0000ff'), { h: 240, s: 1, v: 1 });
  assert.equal(hexToHsl('#00ff00').h, 120);
  assert.equal(hslToHex(0, 1, 0), '#000000');
  assert.equal(hslToHex(200, 1, 1), '#ffffff');
  assert.equal(hsvToHex(120, 0.7, 0), '#000000');
  assert.equal(hsvToHex(300, 0, 1), '#ffffff');
});

test('色值输入框：可以不写 #、可以写三位、大小写都行；认不出的返回空串', () => {
  assert.equal(readHex('#ABCDEF'), '#abcdef');
  assert.equal(readHex('abcdef'), '#abcdef');
  assert.equal(readHex(' fff '), '#ffffff');
  assert.equal(readHex('#0a3'), '#00aa33');
  for (const text of ['', '#', '12345', '#1234567', 'ggg', 'red', null, undefined])
    assert.equal(readHex(text), '', String(text));
});
