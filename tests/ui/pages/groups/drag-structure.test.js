import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 分组页里拖动调整先后的那一段，有几处靠页面的结构撑着。这里没有页面，量不了位置、拖不了，
// 只能核对源码里这几处约定还在。哪一条不过，说明改到了拖动依赖的东西：改完要在浏览器里实际拖一遍，
// 确认没问题之后再把这里对应的检查改成新的写法。
const source = readFileSync(
  fileURLToPath(new URL('../../../../src/ui/pages/groups/GroupsPage.vue', import.meta.url)),
  'utf8',
);
const template = source.slice(source.indexOf('<template>'), source.lastIndexOf('</template>'));
const script = source.slice(0, source.indexOf('<template>'));
const style = source.slice(source.lastIndexOf('<style'));
// 样式里某个选择器那一条的内容。
const rule = (selector) => {
  const at = style.indexOf(`\n${selector} {`);
  return at < 0 ? '' : style.slice(at, style.indexOf('}', at));
};

test('每一行分两层：外面是它占的位置（带分组的 id），里面是看得见的内容', () => {
  // 拖的时候挪的是里面那层；外面那层带着 id，好找到相邻的行。
  assert.match(
    template,
    /class="cf-groups-entry"[^>]*:data-group="group\.id"[^>]*>\s*(?:<!--[\s\S]*?-->\s*)?<div class="cf-groups-entry-body">/,
    '行的结构变了：外层 .cf-groups-entry 要带 :data-group，紧跟着里层 .cf-groups-entry-body',
  );
  assert.match(script, /closest\('\.cf-groups-entry'\)/);
  assert.match(script, /querySelector\('\.cf-groups-entry-body'\)/);
  assert.match(script, /\[data-group="/);
});

test('各行直接排在带滑动效果的列表里，列表是量位置的基准', () => {
  // 别的行让位靠的是这个列表自带的「换位置时滑过去」；相邻行的位置是相对这个列表量的，它得是定位容器。
  assert.match(
    template,
    /<TransitionGroup[^>]*class="cf-groups-rows"[^>]*>\s*<div\s+v-for="group in groups"[\s\S]*?class="cf-groups-entry"/,
    '行不再直接排在 .cf-groups-rows 这个 TransitionGroup 里',
  );
  assert.match(rule('.cf-groups-rows'), /position:\s*relative/, '.cf-groups-rows 要是定位容器');
});

test('相邻行的位置按排好的位置量，上边界取列表里的第一行', () => {
  // 按滑到一半的位置量会来回换，所以用 offsetTop，不用 getBoundingClientRect。
  assert.match(script, /row\.offsetTop \+ row\.offsetHeight \/ 2/);
  // 「好友」是列表的第一行，被拖的行不能越过它。
  assert.match(script, /rows\.firstElementChild\.getBoundingClientRect\(\)\.bottom/);
  // 换位的规则在 reorder.js 里，那边有测试。
  assert.match(script, /stepOrder\(order, drag\.id, top, bottom, middleOf\)/);
  assert.match(script, /arrangeGroups\(list, dragOrder\.value\)/);
});

test('被拖那一行的位置不带滑动，外层自己没有位移', () => {
  // 外层要是跟着滑，里面贴着鼠标的内容会晃。
  assert.match(rule('.cf-groups-entry.is-dragging'), /transition:\s*none\s*!important/);
  assert.doesNotMatch(
    rule('.cf-groups-entry'),
    /transform/,
    '外层 .cf-groups-entry 不能自己带位移',
  );
});

test('用的是指针事件，拖的过程中有挡板，没有退回浏览器自带的拖放', () => {
  assert.match(template, /@pointerdown="startDrag\(\$event, group\)"/);
  for (const name of ['pointermove', 'pointerup', 'pointercancel'])
    assert.match(script, new RegExp(`window\\.addEventListener\\('${name}'`), name);
  assert.doesNotMatch(
    template,
    /draggable|@dragstart|@dragover|@drop/,
    '不要用浏览器自带的拖放：会有重影',
  );
  // 挡板盖住整个窗口，别的东西才不会跟着出悬停和提示。
  assert.match(script, /shield\.id = 'cf-groups-drag-shield'/);
  const shield = rule('#cf-groups-drag-shield');
  assert.match(shield, /position:\s*fixed/);
  assert.match(shield, /inset:\s*0/);
});

test('拖的过程中只在页面里记先后，松手才存一次', () => {
  const move = script.slice(
    script.indexOf('function moveDrag'),
    script.indexOf('function endDrag'),
  );
  assert.doesNotMatch(move, /changeAccount|moveGroup/, '拖动的过程中不要往存储里写');
  const end = script.slice(script.indexOf('function endDrag'));
  assert.match(
    end,
    /changeAccount\(props\.owner, \(own\) => moveGroup\(own, id, order\.indexOf\(id\)\)\)/,
  );
});
