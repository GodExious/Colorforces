import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Script } from 'node:vm';
import userscript from '../userscript.config.js';

const root = new URL('../', import.meta.url);
const newline = String.fromCharCode(10);

// 只读取脚本头部，避免误用正文中的版本或地址。
function readMetadata(code, key) {
  const start = code.indexOf('// ==UserScript==');
  const end = code.indexOf('// ==/UserScript==');
  assert.ok(start >= 0 && end > start, '缺少有效的用户脚本元数据。');
  const pattern = new RegExp('^//[ ]*@' + key + '[ ]+(.+)$', 'm');
  return code.slice(start, end).match(pattern)?.[1].trim();
}

// 复用当前版本的已有日志，不生成重复维护的发布文档。
function readChangelog(file) {
  const lines = readFileSync(new URL(file, root), 'utf8').split(newline);
  const start = lines.findIndex((line) => line.trim() === `### v${userscript.version}`);
  assert.ok(start >= 0, `${file} 中没有 v${userscript.version} 的更新日志。`);
  const next = lines.findIndex((line, index) => index > start && line.startsWith('### '));
  const section = lines.slice(start + 1, next < 0 ? undefined : next);
  while (section.length && ['', '---'].includes(section.at(-1).trim())) section.pop();
  const text = section.join(newline).trim();
  assert.ok(text, `${file} 的当前版本日志为空。`);
  return text;
}

// 发布前核对版本、产物和兼容入口，再输出供GitHub使用的双语说明。
function prepareRelease() {
  const [tag, notesFile] = process.argv.slice(2);
  assert.ok(notesFile, '用法：npm run release:prepare -- v版本号 发布说明输出路径');
  assert.match(userscript.version, /^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$/);
  assert.equal(tag, `v${userscript.version}`, '标签必须与 package.json 的正式版本一致。');
  const code = readFileSync(new URL('dist/colorforces.user.js', root), 'utf8');
  new Script(code, { filename: 'colorforces.user.js' });
  for (const key of ['version', 'namespace', 'updateURL', 'downloadURL']) {
    assert.equal(readMetadata(code, key), userscript[key], `打包产物的 ${key} 与配置不一致。`);
  }
  const compatibilityFile = new URL('colorforces.user.js', root);
  if (existsSync(compatibilityFile)) {
    const compatibility = readFileSync(compatibilityFile, 'utf8');
    if (readMetadata(compatibility, 'version') === userscript.version) {
      for (const key of ['updateURL', 'downloadURL']) {
        assert.equal(
          readMetadata(compatibility, key),
          userscript[key],
          '请先执行 npm run build:compat 更新当前版本的根目录兼容副本。',
        );
      }
    }
  }
  const notes = [
    '## 简体中文',
    '',
    readChangelog('docs/CHANGELOG_zh.md'),
    '',
    '---',
    '',
    '## English',
    '',
    readChangelog('docs/CHANGELOG.md'),
    '',
  ].join(newline);
  writeFileSync(notesFile, notes);
  console.log(`发布校验通过：${tag}，双语发布说明已生成。`);
}

try {
  prepareRelease();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
