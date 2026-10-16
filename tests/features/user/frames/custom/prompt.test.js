import test from 'node:test';
import assert from 'node:assert/strict';
import {
  framePrompt,
  promptText,
  promptParts,
  MAX_DESIGNS,
} from '../../../../../src/features/user/frames/custom/prompt/index.js';
import { languages } from '../../../../../src/i18n/languages.js';

test('写明插件支持的界面语言和语言代码，元数据的示例按这张表写', () => {
  const zh = framePrompt('zh', { idea: '一只猫' });
  const listed = languages.map((lang) => `${lang.code}（${lang.label}）`).join('、');
  assert.ok(zh.includes(`插件现在支持的界面语言：${listed}。`));
  for (const { code } of languages) assert.ok(zh.includes(`"${code}": `), code);
  const en = framePrompt('en', { idea: 'a cat' });
  assert.ok(en.includes(languages.map((lang) => `${lang.code} (${lang.label})`).join(', ')));
});

test('写明画板的坐标范围、留余量的范围，最后要求输出前核对每个图形在范围里', () => {
  const zh = framePrompt('zh', { idea: '猫' });
  for (const part of ['x 和 y 都是从 -20 到 140', 'x 在 -16～136、y 在 -16～126', '【输出前检查】'])
    assert.ok(zh.includes(part), part);
  const en = framePrompt('en', { idea: 'cat' });
  for (const part of [
    'run from -20 to 140',
    'x within -16 to 136 and y within -16 to 126',
    '[Check before output]',
  ])
    assert.ok(en.includes(part), part);
  // 核对放在输出要求前面。
  assert.ok(zh.indexOf('【输出前检查】') < zh.indexOf('【输出】'));
});

test('作者由做的一方署名：新建时请 AI 署自己的模型名；编辑时保持原来的作者，改过几次不用动', () => {
  const fresh = framePrompt('zh', { idea: '猫' });
  assert.ok(fresh.includes('"author": "你的完整型号和版本号"'));
  // 要写到具体型号，只写品牌名不算；不确定时不要编。
  assert.ok(fresh.includes('只写品牌名') && fresh.includes('不要编'));
  assert.ok(fresh.includes('不要写成用户的名字') && !fresh.includes('【修改时】'));
  const editing = framePrompt('zh', { idea: '改', code: '<svg/>' });
  assert.ok(editing.includes('"author": "保持原来的作者"') && editing.includes('【修改时】'));
  assert.ok(editing.includes('插件保存时会自己加一'));
  const en = framePrompt('en', { idea: 'x', code: '<svg/>' });
  assert.ok(en.includes('[When editing]') && en.includes('"author": "Keep the original author"'));
  const freshEn = framePrompt('en', { idea: 'x' });
  assert.ok(freshEn.includes('A brand alone') && freshEn.includes('do not make one up'));
});

test('version 是格式的版本号：新建、编辑都说明它不是第几版，原样照抄', () => {
  for (const code of ['', '<svg/>']) {
    const zh = framePrompt('zh', { idea: '猫', code });
    assert.ok(zh.includes('version 是这套格式的版本号') && zh.includes('原样照抄'));
    const en = framePrompt('en', { idea: 'cat', code });
    assert.ok(
      en.includes('version is the version of this format') && en.includes('Copy both exactly'),
    );
  }
});

test('几个方案：多于一个时写明要几个、各不相同，输出改成几个代码块；一个时和原来一样；最多 MAX_DESIGNS 个', () => {
  const one = framePrompt('zh', { idea: '猫' });
  assert.equal(framePrompt('zh', { idea: '猫', count: 1 }), one);
  assert.ok(!one.includes('【方案数】') && one.includes('只输出一个'));
  const three = framePrompt('zh', { idea: '猫', count: 3 });
  assert.ok(three.includes('请给出 3 个不同的方案') && three.includes('只输出 3 个'));
  assert.ok(three.indexOf('【方案数】') > three.indexOf('【我的想法】'));
  assert.ok(framePrompt('zh', { idea: '改', code: '<svg/>', count: 2 }).includes('2 种不同的改法'));
  assert.ok(framePrompt('zh', { count: 99 }).includes(`${MAX_DESIGNS} 个不同的方案`));
  assert.equal(framePrompt('zh', { count: 2.5 }), framePrompt('zh'));
  const en = framePrompt('en', { idea: 'x', count: 4 });
  assert.ok(en.includes('Give 4 different designs') && en.includes('Output only 4'));
});

test('合法的 XML：写明 <style> 里、连 CSS 注释也不能直接写 & 和 <，输出前再查一遍', () => {
  const zh = framePrompt('zh', { idea: '猫' });
  assert.ok(zh.includes('连 CSS 注释（/* */）里都不能直接写 & 和 <'));
  assert.ok(zh.includes('再查一遍代码里有没有单独的 & 和 <'));
  const en = framePrompt('en', { idea: 'cat' });
  assert.ok(
    en.includes('even in CSS comments') &&
      en.includes('check the code once more for any bare & or <'),
  );
});

test('想法前后有标记：查看时分成三段，复制的去掉标记；没写想法时有一句占位', () => {
  const text = framePrompt('zh', { idea: '  一只猫  ' });
  const [before, idea, after] = promptParts(text);
  assert.equal(idea, '一只猫');
  assert.equal(before + idea + after, promptText(text));
  assert.ok(!promptText(text).includes('<<'));
  assert.equal(promptParts(framePrompt('zh'))[1], '（还没写想法）');
  assert.equal(promptParts(framePrompt('en'))[1], '(no idea written yet)');
  assert.deepEqual(promptParts('没有标记'), ['没有标记', '', '']);
});

test('编辑时带上现在的代码；不要动效时只有一句；没有连着的空行', () => {
  const editing = framePrompt('zh', { idea: '闪一下', code: '<svg>x</svg>', motion: false });
  assert.ok(editing.includes('【现在的代码】') && editing.includes('```svg\n<svg>x</svg>\n```'));
  assert.ok(editing.includes('【想怎么改】') && !editing.includes('【我的想法】'));
  assert.ok(editing.includes('【动效】不要动效') && !editing.includes('@keyframes 和 animation'));
  const fresh = framePrompt('zh', { idea: '猫' });
  assert.ok(!fresh.includes('【现在的代码】') && fresh.includes('【我的想法】'));
  for (const text of [editing, fresh, framePrompt('en', { code: 'x', motion: false })])
    assert.ok(!text.includes('\n\n\n'));
});

test('这门语言还没有提示词时用英文的；英文的不用分号（&amp; 这类写法里的不算）', () => {
  assert.equal(framePrompt('ja', { idea: 'x' }), framePrompt('en', { idea: 'x' }));
  for (const motion of [true, false])
    for (const code of ['', '<svg/>'])
      assert.ok(!framePrompt('en', { motion, code }).replace(/&\w+;/g, '').includes(';'));
});
