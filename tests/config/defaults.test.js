import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SETTINGS, SETTINGS_VERSION } from '../../src/config/defaults.js';
import { MENU_TAB_IDS } from '../../src/config/menu-tabs.js';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
// src 下所有脚本和组件文件。
function sources(directory = SRC) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(js|vue)$/.test(entry.name) ? [path] : [];
  });
}
// 默认设置里有没有这条路径。
function exists(path) {
  let value = DEFAULT_SETTINGS;
  for (const key of path) {
    if (!value || typeof value !== 'object' || !(key in value)) return false;
    value = value[key];
  }
  return true;
}

test('默认设置第一层只有结构版本号和各页签的分组', () => {
  assert.equal(DEFAULT_SETTINGS.version, SETTINGS_VERSION);
  const groups = Object.keys(DEFAULT_SETTINGS).filter((key) => key !== 'version');
  assert.deepEqual(groups, ['general', 'appearance', 'ratings', 'contest', 'user', 'shortcuts']);
  for (const group of groups) assert.equal(typeof DEFAULT_SETTINGS[group], 'object', group);
  // 分组名和页签标识一致；只有「比赛」页签的标识是 prediction，分组叫 contest。
  for (const group of groups) {
    assert.ok(MENU_TAB_IDS.includes(group === 'contest' ? 'prediction' : group), group);
  }
});

test('代码里读写的每一条设置路径，默认设置里都有', () => {
  // appSettings.a.b.c 这样的写法，以及 setSetting('a.b', …) / choose('a.b', …) 里的路径。
  const direct = /appSettings((?:\.[A-Za-z_$][\w$]*)+)/g;
  const byName = /\b(?:setSetting|choose)\('([\w.]+)'/g;
  const missing = [];
  let checked = 0;
  for (const file of sources()) {
    const text = readFileSync(file, 'utf8');
    const paths = [
      ...[...text.matchAll(direct)].map((match) => match[1].slice(1)),
      ...[...text.matchAll(byName)].map((match) => match[1]),
    ];
    for (const path of paths) {
      checked++;
      if (!exists(path.split('.'))) missing.push(`${relative(SRC, file)}: ${path}`);
    }
  }
  assert.ok(checked > 100, `只找到 ${checked} 处设置路径，扫描规则可能失效了`);
  assert.deepEqual(missing, []);
});
