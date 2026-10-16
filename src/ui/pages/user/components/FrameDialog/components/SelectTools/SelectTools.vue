<script setup>
import { computed } from 'vue';
import { translate as t } from '../../../../../../../i18n/index.js';
import * as assets from '../../../../../../../assets/index.js';
import InlineSvg from '../../../../../../components/icons/InlineSvg/InlineSvg.vue';
import SmoothText from '../../../../../../components/transitions/SmoothText/SmoothText.vue';
// 选择时的一行工具（批量导出头像框、批量保存粘贴进来的几段代码共用）：左边「已选 N / 共几个」；
// 右边「全选 / 取消全选」「退出」，再是这次要做的事（插槽里给，比如「导出选中的」）。按钮都是同款小按钮。
//   count  选了几个；total 一共能选几个；kind 选的是什么：'frames' 头像框、'blocks' 代码
const props = defineProps({
  count: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  kind: { type: String, default: 'frames' },
});
defineEmits(['all', 'none', 'exit']);
const every = computed(() => props.total > 0 && props.count === props.total);
// 「已选 3 / 5 个」：三段，中间的数加粗。
const parts = computed(() => t('frameSelected', props.count, props.total, props.kind));
</script>
<template>
  <span class="cf-frame-select-tools">
    <span class="cf-frame-select-count"
      >{{ parts[0] }}<b><SmoothText :text="String(count)" /></b>{{ parts[2] }}</span
    >
    <span class="cf-frame-select-gap"></span>
    <button
      type="button"
      class="cf-aurora-btn cf-aurora-btn--soft cf-frame-small"
      @click="every ? $emit('none') : $emit('all')"
    >
      <Transition name="cf-frame-fade" mode="out-in"
        ><InlineSvg
          :key="every ? 'none' : 'all'"
          :source="
            every ? assets.FRAME_EDITOR_ICONS.selectNone : assets.FRAME_EDITOR_ICONS.selectAll
          "
      /></Transition>
      <SmoothText :text="every ? t('frameSelectNone') : t('frameSelectAll')" />
    </button>
    <button
      type="button"
      class="cf-aurora-btn cf-aurora-btn--soft cf-frame-small"
      @click="$emit('exit')"
    >
      <InlineSvg :source="assets.FRAME_EDITOR_ICONS.exit" />{{ t('frameSelectExit') }}
    </button>
    <slot />
  </span>
</template>
<style>
.cf-frame-select-tools {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.cf-frame-select-gap {
  flex: 1;
}
.cf-frame-select-count {
  margin-right: 2px;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
  white-space: nowrap;
}
.cf-frame-select-count b {
  color: var(--cf-control-ink);
  font-size: var(--cf-font-size-base);
  font-weight: var(--cf-font-weight-semibold);
}
</style>
