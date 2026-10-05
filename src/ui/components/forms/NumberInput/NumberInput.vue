<script setup>
import { ref, watch } from 'vue';
// 设置行里的整数输入框。输入完成（失焦或回车）后才提交；不是不小于 min 的整数时恢复原值。
const props = defineProps({
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 0 },
  inputId: String,
  dataControl: String,
});
const emit = defineEmits(['update:modelValue', 'change']);
const draft = ref(String(props.modelValue));
watch(
  () => props.modelValue,
  (value) => (draft.value = String(value)),
);
function commit() {
  const value = Number(draft.value);
  const valid = String(draft.value).trim() !== '' && Number.isInteger(value) && value >= props.min;
  if (valid && value !== props.modelValue) {
    emit('update:modelValue', value);
    emit('change', value);
  }
  draft.value = String(valid ? value : props.modelValue);
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
    :id="inputId"
    :data-control="dataControl"
    @change="commit"
    @blur="commit"
    @keydown.enter.prevent="$event.target.blur()"
  />
</template>

<style>
.cf-number-input {
  width: 64px;
  box-sizing: border-box;
  padding: 3px 8px;
  border: 1px solid color-mix(in srgb, var(--cf-menu-accent) 24%, #dce2eb);
  border-radius: 7px;
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
