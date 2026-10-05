import test from 'node:test';
import assert from 'node:assert/strict';
import { inPluginUi, PLUGIN_UI_SELECTOR } from '../../../src/features/page/plugin-ui.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 最小的元素替身：只认「.类名」和「#id」这两种写法，沿父级向上查找。
function element({ id = '', className = '' } = {}, parent = null) {
  const node = { id, className, parent };
  node.matches = (selectors) =>
    selectors
      .split(',')
      .map((selector) => selector.trim())
      .some((selector) =>
        selector.startsWith('#')
          ? selector.slice(1) === id
          : className.split(' ').includes(selector.slice(1)),
      );
  node.closest = (selectors) => {
    for (let current = node; current; current = current.parent)
      if (current.matches(selectors)) return current;
    return null;
  };
  return node;
}

test('悬停提示、菜单、弹窗、数据分析面板里的元素都算插件自己的界面', () => {
  const roots = [
    { id: 'cf-floating-tooltip', className: 'cf-floating-tooltip cf-tip-top visible' },
    { className: 'cf-menu-theme' },
    { className: 'cf-clist-modal-overlay cf-aurora-dialog' },
    { className: 'cf-prediction-overlay' },
    { className: 'cf-analytics' },
  ];
  for (const root of roots) {
    const host = element(root);
    assert.equal(inPluginUi(host), true);
    assert.equal(inPluginUi(element({ className: 'cf-tip-rank-line' }, host)), true);
  }
});

test('原站页面上的元素不算，包括侧栏和插件处理过的时间', () => {
  const page = element({ id: 'pageContent' });
  assert.equal(inPluginUi(element({ className: 'format-humantime' }, page)), false);
  assert.equal(inPluginUi(element({ className: 'cf-formatted-time' }, page)), false);
  assert.equal(
    inPluginUi(element({ className: 'roundbox sidebox' }, element({ id: 'sidebar' }))),
    false,
  );
  assert.equal(inPluginUi(null), false);
});

// 悬停提示是这次出问题的地方：它的类名必须留在名单里，并且提示组件确实用了这个类名。
test('名单里的悬停提示类名与提示组件一致', () => {
  const source = readFileSync(
    fileURLToPath(
      new URL(
        '../../../src/ui/components/tooltips/FloatingTooltip/FloatingTooltip.vue',
        import.meta.url,
      ),
    ),
    'utf8',
  );
  assert.ok(PLUGIN_UI_SELECTOR.split(', ').includes('.cf-floating-tooltip'));
  assert.match(source, /class="cf-floating-tooltip"/);
});
