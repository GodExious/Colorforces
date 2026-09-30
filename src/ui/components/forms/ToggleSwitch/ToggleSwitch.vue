<script setup>
defineOptions({ inheritAttrs: false });
defineProps({
  modelValue: Boolean,
  as: { type: String, default: 'div' },
  inputClass: String,
  inputId: String,
  dataControl: String,
});
const emit = defineEmits(['update:modelValue', 'change']);
// 先更新绑定值，再通知所属页面保存设置。
function change(event) {
  emit('update:modelValue', event.target.checked);
  emit('change', event);
}
</script>
<template>
  <component :is="as" class="cf-toggle-switch" v-bind="$attrs">
    <input
      type="checkbox"
      :id="inputId"
      :class="inputClass"
      :data-control="dataControl"
      :checked="modelValue"
      @change="change"
    />
    <span class="cf-toggle-slider"></span>
  </component>
</template>

<style>
.cf-toggle-switch {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 18px;
  flex-shrink: 0;
  vertical-align: middle;
}

.cf-toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.cf-toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.2s;
  border-radius: 18px;
}

.cf-toggle-slider:before {
  position: absolute;
  content: '';
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
}

.cf-toggle-switch input:checked + .cf-toggle-slider {
  background-color: #1890ff;
}

.cf-toggle-switch input:checked + .cf-toggle-slider:before {
  transform: translateX(16px);
}
</style>
