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
  transition: var(--cf-duration-base);
  border-radius: 18px;
}

.cf-toggle-slider:before {
  position: absolute;
  content: '';
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background-color: var(--cf-white-surface);
  transition: var(--cf-duration-base);
  border-radius: 50%;
}

/* 开启状态跟随当前页面的主题色，切页时随滑块自身的过渡平滑换色。 */
.cf-toggle-switch input:checked + .cf-toggle-slider {
  background-color: var(--cf-menu-accent, #1890ff);
}

.cf-toggle-switch input:checked + .cf-toggle-slider:before {
  transform: translateX(16px);
}

/*
 * 子选项里的开关：小一号，开着时的颜色也淡一些，和上面父选项的开关分出主次。
 * 子选项的行就是带着小标签（cf-setting-sublabel）的那些行，各页面不用单独标。
 * 右边缘仍和父选项的开关对齐（都是贴着行的右端）。
 */
.cf-setting-item:has(.cf-setting-sublabel) .cf-toggle-switch {
  width: 28px;
  height: 15px;
}

.cf-setting-item:has(.cf-setting-sublabel) .cf-toggle-slider {
  background-color: #d7dce5;
}

.cf-setting-item:has(.cf-setting-sublabel) .cf-toggle-slider:before {
  width: 11px;
  height: 11px;
}

.cf-setting-item:has(.cf-setting-sublabel) .cf-toggle-switch input:checked + .cf-toggle-slider {
  background-color: color-mix(in srgb, var(--cf-menu-accent, #1890ff) 66%, #fff);
}

.cf-setting-item:has(.cf-setting-sublabel)
  .cf-toggle-switch
  input:checked
  + .cf-toggle-slider:before {
  transform: translateX(13px);
}
</style>
