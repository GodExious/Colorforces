import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hiddenMembers,
  isMoreMark,
  parseGhostTeam,
  rankClass,
  rankTitle,
} from '../../../../src/features/user/avatars/team-members.js';

test('从「...」的提示里读出被折叠的账号', () => {
  assert.deepEqual(
    hiddenMembers(
      'hhiepit_k52, conan_doyle95, iamquang1508, sirdat_LS, khiyeuchuot1, Songuku95, dovietanh95, NGiUp',
    ),
    [
      'hhiepit_k52',
      'conan_doyle95',
      'iamquang1508',
      'sirdat_LS',
      'khiyeuchuot1',
      'Songuku95',
      'dovietanh95',
      'NGiUp',
    ],
  );
  assert.deepEqual(hiddenMembers('a.b-c'), ['a.b-c']);
});

test('不是账号的内容不当成成员', () => {
  assert.deepEqual(hiddenMembers(''), []);
  assert.deepEqual(hiddenMembers(null), []);
  assert.deepEqual(hiddenMembers('Ghost participant'), []);
  assert.deepEqual(hiddenMembers('ok_name, not a name, <b>'), ['ok_name']);
});

test('认出折叠用的「...」', () => {
  assert.ok(isMoreMark('...'));
  assert.ok(isMoreMark(' … '));
  assert.ok(!isMoreMark('..'));
  assert.ok(!isMoreMark('C11'));
  assert.ok(!isMoreMark(undefined));
});

test('头衔换成原站的颜色类名和提示', () => {
  assert.equal(rankClass('specialist'), 'user-cyan');
  assert.equal(rankClass('International Grandmaster'), 'user-red');
  assert.equal(rankClass('legendary grandmaster'), 'user-legendary');
  assert.equal(rankClass(''), 'user-black');
  assert.equal(rankClass('something new'), 'user-black');
  assert.equal(rankTitle('specialist', 'ConLonCon'), 'Specialist ConLonCon');
  assert.equal(rankTitle('candidate master', 'x'), 'Candidate Master x');
  assert.equal(rankTitle('', 'y'), 'Unrated, y');
});

test('Ghost 队伍的文字：认得的几种写法', () => {
  assert.deepEqual(parseGhostTeam('Volgograd STU #1: Nosov, Bulankin, Kovalev'), {
    school: 'Volgograd STU #1',
    team: '',
    members: ['Nosov', 'Bulankin', 'Kovalev'],
  });
  assert.deepEqual(parseGhostTeam('Saratov SU: Daegons (Ivanov, Petrov, Sidorov)'), {
    school: 'Saratov SU',
    team: 'Daegons',
    members: ['Ivanov', 'Petrov', 'Sidorov'],
  });
  assert.deepEqual(parseGhostTeam('MIPT - Shock Content - A, B'), {
    school: 'MIPT',
    team: 'Shock Content',
    members: ['A', 'B'],
  });
});

test('Ghost 队伍的文字：没写成员的，名单是空的', () => {
  assert.deepEqual(parseGhostTeam('Saratov SU: Daegons').members, []);
  assert.deepEqual(parseGhostTeam('MIPT - Shock Content').members, []);
  assert.deepEqual(parseGhostTeam('Daegons (Saratov SU)'), {
    school: 'Saratov SU',
    team: 'Daegons',
    members: [],
  });
  assert.deepEqual(parseGhostTeam('Just A Team'), { school: '', team: 'Just A Team', members: [] });
  assert.deepEqual(parseGhostTeam('').members, []);
  assert.deepEqual(parseGhostTeam(undefined).members, []);
});
