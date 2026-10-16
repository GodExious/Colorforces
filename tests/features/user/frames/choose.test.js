import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  chooseFrame,
  rankFrame,
  rankFromTitle,
} from '../../../../src/features/user/frames/choose.js';

// 头像框的画稿按种类分在几个文件夹里：名字 → 「文件夹/名字.svg」。
const ART_DIR = fileURLToPath(new URL('../../../../src/assets/frames/', import.meta.url));
const files = new Map();
for (const kind of readdirSync(ART_DIR))
  for (const name of readdirSync(ART_DIR + kind).filter((item) => item.endsWith('.svg')))
    files.set(name.replace(/\.svg$/, ''), kind + '/' + name);
const known = new Set(files.keys());

test('原站的段位名对上头像框：大小写、首尾空白不影响；没有段位是 unrated；认不出的不戴', () => {
  assert.equal(rankFrame('expert'), 'expert');
  assert.equal(rankFrame('Candidate Master'), 'cm');
  assert.equal(rankFrame(' international grandmaster '), 'igm');
  assert.equal(rankFrame('legendary grandmaster'), 'lgm');
  assert.equal(rankFrame('tourist'), 'tourist');
  assert.equal(rankFrame('jiangly'), 'jiangly');
  assert.equal(rankFrame(''), 'unrated');
  assert.equal(rankFrame(undefined), 'unrated');
  assert.equal(rankFrame('headquarters'), '');
});

test('画稿按种类分文件夹：段位的在 ranks，4000 分以上的两位和管理员在 special，常规款在 decor；各文件夹里不重名', () => {
  const count = [...readdirSync(ART_DIR)].reduce(
    (sum, kind) => sum + readdirSync(ART_DIR + kind).filter((item) => item.endsWith('.svg')).length,
    0,
  );
  assert.equal(count, known.size, '有重名的画稿');
  for (const id of ['tourist', 'jiangly', 'headquarters'])
    assert.equal(files.get(id), `special/${id}.svg`);
  for (const id of ['wheat', 'pig', 'bow']) assert.equal(files.get(id), `decor/${id}.svg`);
});

test('每个段位都有画好的头像框，另有管理员和头像框库里的几个', () => {
  for (const rank of [
    '',
    'newbie',
    'pupil',
    'specialist',
    'expert',
    'candidate master',
    'master',
    'international master',
    'grandmaster',
    'international grandmaster',
    'legendary grandmaster',
    'tourist',
    'jiangly',
  ])
    assert.ok(files.has(rankFrame(rank)), rank || '(没有段位)');
  assert.ok(known.has('headquarters'));
});

test('分组的头像框优先，其次按设置看段位；管理员戴管理员的；不认识的头像框当作没有', () => {
  const base = { rank: 'expert', maxRank: 'master', known };
  assert.equal(chooseFrame({ ...base, group: 'pig', mode: 'off' }), 'pig');
  assert.equal(chooseFrame({ ...base, group: 'nope', mode: 'current' }), 'expert');
  assert.equal(chooseFrame({ ...base, mode: 'off' }), '');
  assert.equal(chooseFrame({ ...base, mode: 'current' }), 'expert');
  assert.equal(chooseFrame({ ...base, mode: 'max' }), 'master');
  assert.equal(chooseFrame({ ...base, mode: 'current', admin: true }), 'headquarters');
  assert.equal(chooseFrame({ ...base, mode: 'off', admin: true }), '');
});

test('自己从头像框库里戴的最先，比分组的、段位的、管理员的都先；戴着不认识的头像框当作没戴', () => {
  const base = { rank: 'expert', mode: 'current', known };
  assert.equal(chooseFrame({ ...base, worn: 'bow', group: 'pig' }), 'bow');
  assert.equal(chooseFrame({ ...base, worn: 'bow', admin: true }), 'bow');
  assert.equal(chooseFrame({ ...base, worn: 'wheat', mode: 'off' }), 'wheat');
  assert.equal(chooseFrame({ ...base, worn: 'nope', group: 'pig' }), 'pig');
  assert.equal(chooseFrame({ ...base, worn: 'nope' }), 'expert');
});

test('资料还没读到时不按段位戴；旧缓存里没有最高段位（或者是空的）时按现在的段位；没参加过计分比赛的是 unrated', () => {
  assert.equal(chooseFrame({ rank: undefined, mode: 'current', known }), '');
  assert.equal(chooseFrame({ rank: 'pupil', mode: 'max', known }), 'pupil');
  assert.equal(chooseFrame({ rank: '', maxRank: '', mode: 'max', known }), 'unrated');
  assert.equal(chooseFrame({ rank: 'pupil', maxRank: '', mode: 'max', known }), 'pupil');
});

test('从页面上用户名的提示读出段位：多个词的段位、未评级、管理员；名字对不上、别的语言、没有提示的读不出', () => {
  assert.equal(rankFromTitle('Expert fatalerror', 'fatalerror'), 'expert');
  assert.equal(rankFromTitle('Legendary Grandmaster tourist', 'Tourist'), 'legendary grandmaster');
  assert.equal(rankFromTitle('Unrated, new_face', 'new_face'), '');
  assert.equal(rankFromTitle('Headquarters MikeMirzayanov', 'MikeMirzayanov'), 'headquarters');
  assert.equal(rankFromTitle('Expert someone_else', 'fatalerror'), undefined);
  assert.equal(rankFromTitle('Эксперт fatalerror', 'fatalerror'), undefined);
  assert.equal(rankFromTitle('fatalerror', 'fatalerror'), undefined);
  assert.equal(rankFromTitle(undefined, 'fatalerror'), undefined);
});
