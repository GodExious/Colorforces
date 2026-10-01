// 行内已有自身行为的元素：按钮（含 ?/i/! 提示）、链接、输入框、标签和开关本体。
const SELF_HANDLED =
  'button, a, input, select, textarea, label, [contenteditable], .cf-toggle-switch, [data-row-toggle-ignore]';

// 设置行空白处的点击转交给行内开关，使整行都能切换。
export function toggleFromRow(event) {
  if (event.defaultPrevented) return;
  const row = event.currentTarget;
  const target = event.target;
  const handled = target && target.closest ? target.closest(SELF_HANDLED) : null;
  if (handled && row.contains(handled)) return;
  const input = row.querySelector('.cf-toggle-switch input[type="checkbox"]');
  if (input && !input.disabled) input.click();
}
