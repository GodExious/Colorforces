// 写满了字数上限（maxlength）的输入框：再粘贴、拖进来、打字都加不进去，浏览器却照样记一步「撤销」，
// 之后要按同样多次没有变化的 Ctrl+Z 才退回到写满之前。写满了（又没有选中要换掉的字）时直接拦下这次输入，不记这一步。
// 还有地方时照常让浏览器加（放不下的部分它自己截掉，记一步撤销，这一步是有变化的）。
// 用法：<input :maxlength="N" @beforeinput="keepWithinLimit" />。输入法拼字的过程拦不住，也不用拦。
export function keepWithinLimit(event) {
  const field = event.target;
  const limit = field?.maxLength;
  if (!(limit > 0) || event.isComposing || !String(event.inputType || '').startsWith('insert'))
    return;
  const selected = Math.abs((field.selectionEnd ?? 0) - (field.selectionStart ?? 0));
  if (field.value.length - selected >= limit) event.preventDefault();
}
