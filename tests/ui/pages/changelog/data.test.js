import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import entries from '../../../../src/ui/pages/changelog/data.js';

const source = readFileSync(
  new URL('../../../../src/ui/pages/changelog/data.js', import.meta.url),
  'utf8',
);

test('每个版本都有时间戳，并且从新到旧排列', () => {
  for (const entry of entries) assert.ok(Number.isInteger(entry.time), entry.version);
  for (let index = 1; index < entries.length; index++)
    assert.ok(entries[index - 1].time > entries[index].time, entries[index].version);
});

test('时间戳与行尾注释里的北京时间对得上', () => {
  const lines = [...source.matchAll(/time: (\d+), \/\/ (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) UTC\+8/g)];
  // 每个版本的时间都带着这样一条注释，手写时间戳时靠它核对。
  assert.equal(lines.length, entries.length);
  for (const [, time, day, clock] of lines)
    assert.equal(Number(time), Date.parse(`${day}T${clock}:00+08:00`), `${day} ${clock}`);
});
