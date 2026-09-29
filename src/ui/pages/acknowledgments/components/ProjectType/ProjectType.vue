<script setup>
import { computed } from 'vue';
import { translate as t } from '../../../../../i18n/index.js';
import {
  projectExtensionIcon,
  projectUserscriptIcon,
  projectWebsiteIcon,
} from '../../../../../assets/index.js';
import InlineSvg from '../../../../components/icons/InlineSvg/InlineSvg.vue';
const props = defineProps({
  type: {
    type: String,
    required: true,
    validator: (value) => ['extension', 'userscript', 'website'].includes(value),
  },
});
const types = {
  extension: { icon: projectExtensionIcon, label: 'ackTypeExtension' },
  userscript: { icon: projectUserscriptIcon, label: 'ackTypeUserscript' },
  website: { icon: projectWebsiteIcon, label: 'ackTypeWebsite' },
};
// 类型与致谢理由分开呈现，不把品牌图标当作类型标记。
const item = computed(() => types[props.type]);
</script>
<template>
  <span class="cf-ack-project-type" :data-project-type="type">
    <InlineSvg :source="item.icon" /><span>{{ t(item.label) }}</span>
  </span>
</template>
<style>
.cf-ack-project-type {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 7px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--cf-ack-accent) 40%, var(--cf-content-surface));
  background: color-mix(in srgb, var(--cf-ack-accent) 24%, var(--cf-content-surface));
  color: color-mix(in srgb, var(--cf-ack-accent) 38%, #26374b);
  font-size: 11px;
  line-height: 18px;
  font-weight: 600;
  white-space: nowrap;
}
.cf-ack-project-type svg {
  width: 15px;
  height: 15px;
  flex: none;
}
</style>
