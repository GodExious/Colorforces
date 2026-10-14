import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isOwnPage,
  parseFriendsPage,
  parseProfileStar,
} from '../../../../src/features/user/groups/friends.js';

// 照着原站好友页的写法拼一页：页头是登录的账号，下面一张表，一行一个好友。
const row = (index, handle, star) =>
  `<tr> <td>${index}</td> <td style="text-align:left;"><a href="/profile/${handle}" title="Master ${handle}" class="rated-user user-orange">${handle}</a></td> <td>${star}</td> </tr>`;
const followed = (id) =>
  `<img class="removeFriend friendStar" friendUserId="${id}" title="Click to remove from users you are following" src="//codeforces.com/star_yellow_24.png"/>`;
const page = (owner, rows) =>
  `<html><body><div class="lang-chooser"><a href="/profile/${owner}">${owner}</a> | <a href="/logout">Logout</a></div>
  <div class="datatable"><table class=""> <thead> <tr> <th>&nbsp;</th> <th>Who</th> <th>&nbsp;</th> </tr> </thead> <tbody>${rows.join('\n')}</tbody></table></div></body></html>`;

test('从好友页读出名单：名字、原站的用户编号，先后和页面上一样', () => {
  const html = page('Owner', [
    row(1, 'Alice', followed(77498)),
    row(2, 'b.o-b_2', followed(1956905)),
  ]);
  assert.deepEqual(parseFriendsPage(html), [
    { handle: 'Alice', id: 77498 },
    { handle: 'b.o-b_2', id: 1956905 },
  ]);
});

test('不算好友的行：没有星标的、星标是「未关注」的、名字不像账号的、重复的', () => {
  const html = page('Owner', [
    row(1, 'Alice', followed(1)),
    row(2, 'NoStar', ''),
    row(3, 'Gone', '<img class="addFriend friendStar" friendUserId="3" src="star_gray_24.png"/>'),
    row(4, 'bad%20name', followed(4)),
    row(5, 'alice', followed(5)),
    row(6, 'NoId', '<img class="friendStar removeFriend" src="star_yellow_24.png"/>'),
  ]);
  assert.deepEqual(parseFriendsPage(html), [
    { handle: 'Alice', id: 1 },
    { handle: 'NoId', id: 0 },
  ]);
});

test('读不出东西时是空名单，不报错', () => {
  assert.deepEqual(parseFriendsPage(''), []);
  assert.deepEqual(parseFriendsPage(null), []);
  assert.deepEqual(parseFriendsPage(page('Owner', [])), []);
  assert.deepEqual(parseFriendsPage(page('Owner', [row(1, '%E0%A4%A', followed(1))])), []);
});

test('认得出是不是这个账号登录着时的页面', () => {
  const html = page('Owner', [row(1, 'Alice', followed(1))]);
  assert.equal(isOwnPage(html, 'Owner'), true);
  assert.equal(isOwnPage(html, 'owner'), true);
  // 别的账号、名字里带点号的不会被当成通配。
  assert.equal(isOwnPage(html, 'Own'), false);
  assert.equal(isOwnPage(page('a.b', []), 'axb'), false);
  assert.equal(isOwnPage(page('a.b', []), 'a.b'), true);
  // 没登录时会被转到登录页。
  const login =
    '<html><body><form id="enterForm"><a href="/profile/Owner">Owner</a></form></body></html>';
  assert.equal(isOwnPage(login, 'Owner'), false);
  assert.equal(isOwnPage('<html></html>', 'Owner'), false);
  assert.equal(isOwnPage(html, ''), false);
  assert.equal(isOwnPage(null, 'Owner'), false);
});

// 照着原站个人主页的写法：名字的链接后面紧跟着关注用的那颗星。
const profile = (handle, star) =>
  `<html><body><div class="lang-chooser"><a href="/profile/Owner">Owner</a></div>
  <div class="userbox"><div class="main-info"><h1>
  <a href="/profile/${handle}" title="Legendary Grandmaster ${handle}" class="rated-user user-legendary"><span class="legendary-user-first-letter">${handle[0]}</span>${handle.slice(1)}</a>                            ${star}
  </h1></div></div></body></html>`;

test('从个人主页读出关注用的那颗星：名字、用户编号、关注了没有', () => {
  const gray =
    '<img class="addFriend friendStar" friendUserId="1234" title="Click to add to users you are following" src="star_gray_24.png"/>';
  assert.deepEqual(parseProfileStar(profile('Alice', gray)), {
    handle: 'Alice',
    id: 1234,
    following: false,
  });
  assert.deepEqual(parseProfileStar(profile('b.o-b_2', followed(77))), {
    handle: 'b.o-b_2',
    id: 77,
    following: true,
  });
});

test('主页上没有那颗星时读不出来：自己的主页、被转到别的页面、编号缺了', () => {
  assert.equal(parseProfileStar(profile('Owner', '')), null);
  assert.equal(parseProfileStar('<html><body>Codeforces</body></html>'), null);
  assert.equal(parseProfileStar(null), null);
  assert.equal(
    parseProfileStar(profile('Alice', '<img class="addFriend friendStar" src="star.png"/>')),
    null,
  );
  // 好友页上星标和名字不挨着，不会被当成个人主页。
  assert.equal(parseProfileStar(page('Owner', [row(1, 'Alice', followed(1))])), null);
});
