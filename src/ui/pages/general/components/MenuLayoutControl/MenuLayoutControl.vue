<script setup>
import { reactive, ref, watch } from 'vue';
import { translate as t } from '../../../../../i18n/index.js';
import { shortcutResetIcon as resetIcon } from '../../../../../assets/index.js';
import ToggleSwitch from '../../../../components/forms/ToggleSwitch/ToggleSwitch.vue';
import ActionButton from '../../../../components/forms/ActionButton/ActionButton.vue';
import InlineSvg from '../../../../components/icons/InlineSvg/InlineSvg.vue';
import ExpandTransition from '../../../../components/transitions/ExpandTransition/ExpandTransition.vue';
import InfoHint from '../../../../components/tooltips/InfoHint/InfoHint.vue';
import { tooltip } from '../../../../components/tooltips/FloatingTooltip/FloatingTooltip.vue';
import { toggleFromRow } from '../../../../../utils/row-toggle.js';
const props = defineProps({
  controller: Object,
  fields: Array,
  titleKey: String,
  hintKey: String,
  control: String,
  apply: Function,
});
const drafts = reactive({}),
  held = new Set(),
  editing = ref(null);
// 拖动及程序过渡同步显示值，但不覆盖用户正在输入的文字。
function syncDrafts() {
  for (const field of props.fields) {
    if (!props.controller.animating) held.delete(field.key);
    if (editing.value !== field.key && !held.has(field.key))
      drafts[field.key] = String(props.controller[field.key]);
  }
}
watch(
  () => [props.fields.map((field) => props.controller[field.key]), props.controller.animating],
  syncDrafts,
  { immediate: true },
);
// 完成输入再应用；输入中的目标值保持稳定，其余字段随实际布局平滑变化。
function commitDimension(key) {
  if (editing.value !== key) return;
  const raw = drafts[key],
    value = Number(raw);
  editing.value = null;
  if (String(raw).trim() && Number.isFinite(value)) {
    props.apply({ [key]: value });
    drafts[key] = String(props.controller.goal[key]);
    if (props.controller.animating) held.add(key);
  }
  syncDrafts();
}
// 清除输入草稿后恢复该项默认布局，让数值继续跟随平滑过渡。
function resetLayout() {
  tooltip.hide();
  editing.value = null;
  held.clear();
  props.controller.reset();
  syncDrafts();
}
</script>
<template>
  <div class="cf-setting-item cf-menu-layout-toggle" @click="toggleFromRow">
    <span class="cf-setting-label cf-menu-layout-label"
      ><label :for="control" data-cf-language-text>{{ t(titleKey) }}</label
      ><InfoHint :text="t(hintKey)"
    /></span>
    <div class="cf-menu-layout-actions">
      <ActionButton
        :aria-label="t('menuLayoutReset')"
        :data-tooltip="t('menuLayoutReset')"
        :disabled="!controller.enabled || controller.isDefault"
        :data-control="`${control}Reset`"
        @focus="tooltip.show($event.currentTarget, t('menuLayoutReset'))"
        @blur="tooltip.hide"
        @click="resetLayout"
      >
        <InlineSvg :source="resetIcon" />
        <span data-cf-language-text>{{ t('menuLayoutResetAction') }}</span>
      </ActionButton>
      <ToggleSwitch
        as="label"
        :input-id="control"
        :model-value="controller.enabled"
        :data-control="control"
        @update:model-value="controller.setEnabled"
      />
    </div>
  </div>
  <ExpandTransition :show="controller.enabled">
    <div class="cf-menu-layout-fields">
      <label v-for="field in fields" :key="field.key" class="cf-menu-layout-field">
        <span data-cf-language-text>{{ t(field.label) }}</span>
        <span class="cf-menu-layout-value">
          <input
            v-model="drafts[field.key]"
            type="number"
            inputmode="decimal"
            :step="field.step || 1"
            :min="field.min"
            :max="field.max"
            :data-control="field.control"
            @focus="editing = field.key"
            @input="editing = field.key"
            @change="commitDimension(field.key)"
            @blur="commitDimension(field.key)"
            @keydown.enter.prevent="$event.target.blur()"
          />
          <span class="cf-menu-layout-unit">{{ field.unit }}</span>
        </span>
      </label>
    </div>
  </ExpandTransition>
</template>
<style scoped>
.cf-menu-layout-toggle {
  margin: 0;
  cursor: pointer;
  user-select: none;
  gap: 10px;
}
.cf-menu-layout-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.cf-menu-layout-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 8px 0 0 14px;
}
.cf-menu-layout-actions {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 10px;
}
.cf-menu-layout-field {
  display: grid;
  gap: 5px;
  min-width: 0;
  color: var(--cf-gray-500);
  font-size: var(--cf-font-size-base);
}
.cf-menu-layout-value {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.cf-menu-layout-value input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 6px 8px;
  border: 1px solid color-mix(in srgb, var(--cf-menu-accent) 24%, #dce2eb);
  border-radius: 7px;
  background: color-mix(in srgb, var(--cf-menu-accent) 9%, var(--cf-gray-50));
  color: var(--cf-gray-700);
  font: inherit;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
}
.cf-menu-layout-value input:focus {
  border-color: color-mix(in srgb, var(--cf-menu-accent) 65%, #dce2eb);
  outline: 2px solid color-mix(in srgb, var(--cf-menu-accent) 18%, transparent);
}
/* 保留数值输入与键盘操作，只隐藏浏览器自带的上下箭头。 */
.cf-menu-layout-value input[type='number'] {
  appearance: textfield;
  -moz-appearance: textfield;
}
.cf-menu-layout-value input::-webkit-inner-spin-button,
.cf-menu-layout-value input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.cf-menu-layout-unit {
  flex-shrink: 0;
  font-size: var(--cf-font-size-xs);
}
</style>
