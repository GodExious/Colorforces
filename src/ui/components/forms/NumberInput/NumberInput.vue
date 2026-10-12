<script setup>
import { computed, ref, watch } from 'vue';
// 设置行里的整数输入框，只能输入数字。输入完成（失焦或回车）后才提交；
// 不是 min 到 max 之间的整数时恢复原值，clamp 为真时超出范围的改为收到最近的那一头。
// live 为真时上下方向键立即加减一并提交（平时方向键只改框里的数，失焦才提交）。
const props = defineProps({
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 0 },
  max: { type: Number, default: Infinity },
  clamp: { type: Boolean, default: false },
  live: { type: Boolean, default: false },
  inputId: String,
  dataControl: String,
});
const emit = defineEmits(['update:modelValue', 'change']);
const draft = ref(String(props.modelValue));
watch(
  () => props.modelValue,
  (value) => (draft.value = String(value)),
);
// 没有上限时不写 max 属性。
const maxAttr = computed(() => (Number.isFinite(props.max) ? props.max : undefined));
const bounded = (value) => Math.min(props.max, Math.max(props.min, value));
// 框里现在写的整数；不是整数（空着、带小数）时是 null。
function typed() {
  const text = String(draft.value).trim();
  const value = Number(text);
  return text !== '' && Number.isInteger(value) ? value : null;
}
function set(value) {
  if (value !== props.modelValue) {
    emit('update:modelValue', value);
    emit('change', value);
  }
  draft.value = String(value);
}
function commit() {
  const value = typed();
  const inside = value !== null && value >= props.min && value <= props.max;
  set(inside ? value : value !== null && props.clamp ? bounded(value) : props.modelValue);
}
// 只让数字进来：数字输入框本来还收 e、小数点和正负号。
function digitsOnly(event) {
  const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
  if (plain && event.key.length === 1 && !/\d/.test(event.key)) event.preventDefault();
}
function nudge(event, direction) {
  if (!props.live) return;
  event.preventDefault();
  set(bounded((typed() ?? props.modelValue) + direction));
}
</script>

<template>
  <input
    v-model="draft"
    class="cf-number-input"
    type="number"
    inputmode="numeric"
    step="1"
    :min="min"
    :max="maxAttr"
    :id="inputId"
    :data-control="dataControl"
    @change="commit"
    @blur="commit"
    @keydown="digitsOnly"
    @keydown.enter.prevent="$event.target.blur()"
    @keydown.up="nudge($event, 1)"
    @keydown.down="nudge($event, -1)"
  />
</template>

<style>
.cf-number-input {
  width: 64px;
  box-sizing: border-box;
  padding: 3px 8px;
  border: 1px solid color-mix(in srgb, var(--cf-menu-accent) 24%, #dce2eb);
  border-radius: var(--cf-radius-sm);
  background: color-mix(in srgb, var(--cf-menu-accent) 9%, var(--cf-gray-50));
  color: var(--cf-gray-700);
  font: inherit;
  font-size: var(--cf-font-size-base);
  font-variant-numeric: tabular-nums;
  line-height: 18px;
  text-align: right;
  cursor: text;
}
.cf-number-input:focus {
  border-color: color-mix(in srgb, var(--cf-menu-accent) 65%, #dce2eb);
  outline: 2px solid color-mix(in srgb, var(--cf-menu-accent) 18%, transparent);
}
/* 保留数值输入与键盘操作，只隐藏浏览器自带的上下箭头。 */
.cf-number-input[type='number'] {
  appearance: textfield;
  -moz-appearance: textfield;
}
.cf-number-input::-webkit-inner-spin-button,
.cf-number-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
