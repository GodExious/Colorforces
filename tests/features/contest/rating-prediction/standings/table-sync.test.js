import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileStandings } from '../../../../../src/features/contest/rating-prediction/standings/table-sync.js';

// 一个够对账用的假表格：只有标签、属性、子节点，和对账用到的那几个操作。
class Node {
  constructor(tag, attrs = {}, kids = []) {
    this.tag = tag;
    this.attrs = new Map(Object.entries(attrs));
    this.kids = [];
    this.parentNode = null;
    this.dataset = {};
    for (const kid of kids) this.append(kid);
    const self = this;
    this.classList = {
      contains: (name) => self.classes().includes(name),
      toggle(name, on) {
        const set = new Set(self.classes());
        if (on) set.add(name);
        else set.delete(name);
        if (set.size) self.attrs.set('class', [...set].join(' '));
        else self.attrs.delete('class');
      },
    };
  }
  classes() {
    return (this.attrs.get('class') || '').split(' ').filter(Boolean);
  }
  append(kid) {
    kid.parentNode?.drop(kid);
    kid.parentNode = this;
    this.kids.push(kid);
  }
  drop(kid) {
    this.kids.splice(this.kids.indexOf(kid), 1);
    kid.parentNode = null;
  }
  get rows() {
    return this.kids;
  }
  get cells() {
    return this.kids;
  }
  get childNodes() {
    return this.kids;
  }
  get innerHTML() {
    return this.kids.map((kid) => kid.text ?? kid.innerHTML).join('');
  }
  get textContent() {
    return this.innerHTML;
  }
  getAttributeNames() {
    return [...this.attrs.keys()];
  }
  getAttribute(name) {
    return this.attrs.get(name) ?? null;
  }
  hasAttribute(name) {
    return this.attrs.has(name);
  }
  setAttribute(name, value) {
    this.attrs.set(name, value);
  }
  removeAttribute(name) {
    this.attrs.delete(name);
  }
  querySelectorAll() {
    return [];
  }
  replaceChildren(...kids) {
    for (const kid of [...this.kids]) this.drop(kid);
    for (const kid of kids) this.append(kid);
  }
  get nextElementSibling() {
    const list = this.parentNode.kids;
    return list[list.indexOf(this) + 1] ?? null;
  }
  after(node) {
    node.parentNode?.drop(node);
    const list = this.parentNode.kids;
    list.splice(list.indexOf(this) + 1, 0, node);
    node.parentNode = this.parentNode;
  }
  replaceWith(node) {
    const parent = this.parentNode;
    const at = parent.kids.indexOf(this);
    node.parentNode?.drop(node);
    parent.kids[at] = node;
    node.parentNode = parent;
    this.parentNode = null;
  }
  remove() {
    this.parentNode?.drop(this);
  }
  clone() {
    const copy = new Node(this.tag, Object.fromEntries(this.attrs));
    copy.text = this.text;
    for (const kid of this.kids) copy.append(kid.clone());
    return copy;
  }
}
const text = (value) => Object.assign(new Node('#text'), { text: value });
const cell = (attrs, value) => new Node('td', attrs, [text(value)]);
// 一行：名次、选手、两道题。
const row = (id, rank, a, b, look = '') =>
  new Node('tr', { participantId: id }, [
    cell({ class: look + ' left' }, String(rank)),
    cell({ class: 'contestant-cell ' + look }, 'user' + id),
    cell(
      {
        participantId: id,
        problemId: '1',
        class: look,
        ...(a === '+' && { acceptedSubmissionId: 'x' + id }),
      },
      a,
    ),
    cell({ participantId: id, problemId: '2', class: look + ' right' }, b),
  ]);
const head = () =>
  new Node('tr', {}, [cell({}, '#'), cell({}, 'Who'), cell({}, 'A'), cell({}, 'B')]);
const adopt = (node) => node.clone();

test('榜单对账：成绩变了的格子留着原来的格子只改内容，行按新名次排，底色和边线按新位置重加', () => {
  const table = new Node('table', {}, [
    head(),
    row('1', 1, '+', '+', 'dark'),
    row('2', 2, '+', '-'),
    row('3', 3, '', '', 'dark'),
  ]);
  const [, first, second, third] = table.rows;
  const cellsOf = (target) => [...target.cells];
  const before = { first: cellsOf(first), second: cellsOf(second), third: cellsOf(third) };

  // 第一轮：内容一样，只是记下各格的内容，什么都不该动。
  let fresh = new Node('table', {}, [
    head(),
    row('1', 1, '+', '+'),
    row('2', 2, '+', '-'),
    row('3', 3, '', ''),
  ]);
  let info = reconcileStandings(table, fresh, adopt);
  assert.deepEqual([info.added.size, info.changed.size, info.removed, info.moved], [0, 0, 0, 0]);

  // 第二轮：3 号过了两道题升到第一；2 号掉出这一页，4 号进来。
  fresh = new Node('table', {}, [
    head(),
    row('3', 1, '+', '+'),
    row('1', 2, '+', '+'),
    row('4', 3, '', '-'),
  ]);
  info = reconcileStandings(table, fresh, adopt);
  assert.deepEqual(
    table.rows.slice(1).map((r) => r.getAttribute('participantId')),
    ['3', '1', '4'],
  );
  assert.equal(table.rows[1], third, '3 号还是原来那一行');
  // 成绩变了的格子：还是原来的格子，属性和内容是新的。
  cellsOf(third).forEach((current, index) =>
    assert.equal(current, before.third[index], `3 号第 ${index} 格没换`),
  );
  assert.equal(third.cells[2].textContent, '+');
  assert.equal(third.cells[2].getAttribute('acceptedSubmissionId'), 'x3');
  assert.equal(third.cells[2].getAttribute('participantId'), '3');
  assert.equal(third.cells[0].textContent, '1');
  // 没变的行，格子原样。
  cellsOf(first).forEach((current, index) => assert.equal(current, before.first[index]));
  assert.equal(first.cells[0].textContent, '2');
  assert.ok(info.changed.has(third) && !info.changed.has(first));
  assert.equal(info.added.size, 1);
  assert.equal(info.removed, 1);
  // 新进来的 4 号：格子是离开的 2 号留下的那几个（原站的操作还在），属性和内容是 4 号的。
  const fourth = table.rows[3];
  cellsOf(fourth).forEach((current, index) =>
    assert.equal(current, before.second[index], `4 号第 ${index} 格是 2 号留下的`),
  );
  assert.equal(fourth.getAttribute('participantId'), '4');
  assert.equal(fourth.cells[2].getAttribute('participantId'), '4');
  assert.equal(fourth.cells[2].hasAttribute('acceptedSubmissionId'), false);
  assert.equal(fourth.cells[1].textContent, 'user4');
  assert.equal(fourth.cells[3].textContent, '-');
  assert.equal(second.parentNode, null);
  // 隔行底色和边线按新位置重新加：第一行深、第二行浅、第三行深；首格 left、末格 right。
  assert.deepEqual(
    table.rows.slice(1).map((r) => r.cells[2].classList.contains('dark')),
    [true, false, true],
  );
  for (const r of table.rows.slice(1)) {
    assert.ok(r.cells[0].classList.contains('left'));
    assert.ok(r.cells[3].classList.contains('right'));
  }

  // 第三轮：3 号的第二题又变回没过（属性要去掉）。
  fresh = new Node('table', {}, [
    head(),
    row('3', 1, '', '+'),
    row('1', 2, '+', '+'),
    row('4', 3, '', '-'),
  ]);
  reconcileStandings(table, fresh, adopt);
  assert.equal(third.cells[2], before.third[2]);
  assert.equal(third.cells[2].hasAttribute('acceptedSubmissionId'), false);
  assert.equal(third.cells[2].textContent, '');
});

test('底部统计行的数字变了，不算谁的成绩变了', () => {
  const totals = (a, b) =>
    new Node('tr', {}, [cell({}, 'Accepted'), cell({}, ''), cell({}, a), cell({}, b)]);
  const table = new Node('table', {}, [head(), row('1', 1, '+', '+', 'dark'), totals('1', '1')]);
  const stats = table.rows[2];
  reconcileStandings(
    table,
    new Node('table', {}, [head(), row('1', 1, '+', '+'), totals('1', '1')]),
    adopt,
  );
  const info = reconcileStandings(
    table,
    new Node('table', {}, [head(), row('1', 1, '+', '+'), totals('7', '5')]),
    adopt,
  );
  assert.equal(table.rows[2], stats);
  assert.equal(stats.cells[2].textContent, '7');
  assert.equal(info.changed.size, 0);
});
