<script setup>
import { computed } from 'vue';
import { shownMark } from '../../../../../features/user/groups/store.js';
// 分组的标记：一个小圆，里面是分组的图标。没设图标的放一个色点，「好友」没设时是一颗星。
const props = defineProps({ group: { type: Object, required: true } });
const parts = computed(() => shownMark(props.group));
</script>
<template>
  <span
    class="cf-groups-mark"
    :class="{ 'is-dot': !parts.length, 'is-pair': parts.length > 1 }"
    :style="{ '--cf-group-color': group.color || null }"
    >{{ parts.join('') }}</span
  >
</template>
<style>
/* 颜色没设时用所在界面的主题色。 */
.cf-groups-mark {
  --cf-group-tone: var(--cf-group-color, var(--cf-menu-accent));
  display: grid;
  place-items: center;
  flex: none;
  width: 20px;
  height: 20px;
  border: 1px solid color-mix(in srgb, var(--cf-group-tone) 55%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--cf-group-tone) 20%, transparent);
  box-sizing: border-box;
  color: var(--cf-group-tone);
  font-size: var(--cf-font-size-base);
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  transition:
    background-color var(--cf-duration-fast) ease,
    border-color var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease;
}
/* 两个半角字符：字小一号才放得下。 */
.cf-groups-mark.is-pair {
  font-size: var(--cf-font-size-2xs);
}
.cf-groups-mark.is-dot::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--cf-group-tone);
}
</style>
