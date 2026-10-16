<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { highlightSvg, splitLines, visibleRange } from '../../../../utils/code-highlight.js';
// 能直接改的代码框：底下一层是上了色的代码，上面一层是透明的输入框（光标、选中、输入都在它上面），左边是行号。
// 上了色的那层和行号只放看得见的那几十行，滚动时再换：贴进来几千行，浏览器每次要排的也只有这几十行。
// 输入、滚动合并到每帧最多处理一次。行高、留白从输入框的样式里读（字号会跟着「插件字体大小」变），不写死。
// 颜色是 --cf-code-* 这几个变量（见下面的样式），以后的主题只改它们。
//   modelValue   代码
//   placeholder  空着时的占位文字（可以分几行）
//   label        给读屏软件的名字
const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  label: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'paste']);
const input = ref(null);
const layer = ref(null);
const gutter = ref(null);
// 整段上好色、按行切开的 HTML；文字变了才重算（上色本身很快，两千多行十几毫秒），滚动时不用。
let lines = [''];
let shown = null;
let frame = 0;
function paint() {
  frame = 0;
  const box = input.value;
  if (!box || !layer.value || !gutter.value) return;
  if (shown !== props.modelValue) {
    shown = props.modelValue;
    lines = splitLines(highlightSvg(shown));
  }
  const style = getComputedStyle(box);
  const line = parseFloat(style.lineHeight) || 17;
  const [first, last] = visibleRange({
    scrollTop: box.scrollTop,
    height: box.clientHeight,
    total: lines.length,
    line,
    padding: parseFloat(style.paddingTop) || 0,
  });
  layer.value.innerHTML = lines.slice(first, last).join('\n');
  gutter.value.textContent = Array.from({ length: last - first }, (v, i) => first + i + 1).join(
    '\n',
  );
  // 画出来的第一行挪到它该在的地方：第 first 行的上边 = 留白 + first × 行高 − 滚动的距离（留白两层都有）。
  const top = first * line - box.scrollTop;
  layer.value.style.transform = `translate(${-box.scrollLeft}px, ${top}px)`;
  gutter.value.style.transform = `translateY(${top}px)`;
}
const schedule = () => {
  if (!frame) frame = requestAnimationFrame(paint);
};
function onInput(event) {
  emit('update:modelValue', event.target.value);
  schedule();
}
// 外面换了代码（比如进入编辑时放进原来的代码）。
watch(() => props.modelValue, schedule);
let resize = null;
onMounted(() => {
  paint();
  // 框的大小、字号变了（行高跟着变）时重画。
  if (typeof ResizeObserver === 'function') {
    resize = new ResizeObserver(schedule);
    resize.observe(input.value);
  }
});
onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  resize?.disconnect();
});
defineExpose({ focus: () => input.value?.focus() });
</script>
<template>
  <div class="cf-code-box" :class="{ 'is-empty': !modelValue }">
    <div class="cf-code-gutter" aria-hidden="true">
      <div ref="gutter" class="cf-code-gutter-in"></div>
    </div>
    <div class="cf-code-area">
      <pre ref="layer" class="cf-code-layer" aria-hidden="true"></pre>
      <textarea
        ref="input"
        class="cf-code-input cf-scrollbar"
        spellcheck="false"
        wrap="off"
        autocomplete="off"
        :aria-label="label || null"
        :placeholder="placeholder"
        :value="modelValue"
        @input="onInput"
        @scroll="schedule"
        @paste="emit('paste', $event)"
      ></textarea>
    </div>
  </div>
</template>
<style>
/* 浅色的一套（用户定的）。深色的一套以后并进主题。 */
.cf-code-box {
  --cf-code-surface: #fbfcff;
  --cf-code-gutter: #f0f2fa;
  --cf-code-line-number: #a3aac2;
  --cf-code-ink: #3a4466;
  --cf-code-caret: #3a4466;
  --cf-code-selection: #8f9fd84d;
  --cf-code-hint: #a3aac2;
  --cf-code-tag: #3557c4;
  --cf-code-attr: #7a49c4;
  --cf-code-string: #23845a;
  --cf-code-punct: #8a93b3;
  --cf-code-comment: #9aa2b8;
  --cf-code-selector: #b5651d;
  --cf-code-property: #1f7bb5;
  --cf-code-number: #c4532f;
  --cf-code-key: #7a49c4;
  --cf-code-at: #c23d78;
  --cf-code-text: #56627b;
  --cf-code-fence: #a3aac2;
  display: flex;
  height: 200px;
  overflow: hidden;
  border: 1px solid var(--cf-surface-border);
  border-radius: var(--cf-radius-md);
  background: var(--cf-code-surface);
  box-sizing: border-box;
  font-family: Consolas, 'Cascadia Mono', Menlo, monospace;
  font-size: var(--cf-font-size-xs);
  line-height: calc(17px * var(--cf-font-scale));
  transition:
    border-color var(--cf-duration-fast) ease,
    box-shadow var(--cf-duration-fast) ease;
}
.cf-code-box:focus-within {
  border-color: color-mix(in srgb, var(--cf-menu-accent) 70%, var(--cf-surface-border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--cf-menu-accent) 22%, transparent);
}
.cf-code-gutter {
  flex: none;
  min-width: 34px;
  overflow: hidden;
  background: var(--cf-code-gutter);
  color: var(--cf-code-line-number);
  text-align: right;
  user-select: none;
}
.cf-code-gutter-in {
  padding: 8px 8px 8px 6px;
  white-space: pre;
}
.cf-code-area {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
/* 上色的那层和输入框的字一模一样地排：同样的字体、行高、留白，都不折行。 */
.cf-code-layer,
.cf-code-input {
  margin: 0;
  padding: 8px 10px;
  font: inherit;
  line-height: inherit;
  letter-spacing: 0;
  tab-size: 2;
  white-space: pre;
}
.cf-code-layer {
  position: absolute;
  top: 0;
  left: 0;
  min-width: 100%;
  box-sizing: border-box;
  color: var(--cf-code-ink);
  pointer-events: none;
}
.cf-code-input {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  outline: none;
  background: transparent;
  box-sizing: border-box;
  color: transparent;
  caret-color: var(--cf-code-caret);
  overflow: auto;
  resize: none;
}
/* 空着时只有几行短的占位文字，不出滚动条。 */
.cf-code-box.is-empty .cf-code-input {
  overflow: hidden;
}
.cf-code-input::placeholder {
  color: var(--cf-code-hint);
}
.cf-code-input::selection {
  background: var(--cf-code-selection);
  color: transparent;
}
.cf-code-tag {
  color: var(--cf-code-tag);
}
.cf-code-attr {
  color: var(--cf-code-attr);
}
.cf-code-string {
  color: var(--cf-code-string);
}
.cf-code-punct {
  color: var(--cf-code-punct);
}
.cf-code-comment {
  color: var(--cf-code-comment);
  font-style: italic;
}
.cf-code-selector {
  color: var(--cf-code-selector);
}
.cf-code-property {
  color: var(--cf-code-property);
}
.cf-code-number {
  color: var(--cf-code-number);
}
.cf-code-key {
  color: var(--cf-code-key);
}
.cf-code-at {
  color: var(--cf-code-at);
}
.cf-code-text {
  color: var(--cf-code-text);
}
.cf-code-fence {
  color: var(--cf-code-fence);
}
@media (prefers-reduced-motion: reduce) {
  .cf-code-box {
    transition: none;
  }
}
</style>
