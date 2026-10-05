<script setup>
// 图表标题栏里的图例：每项一个色块加一段文字，说明各组柱子各是什么。
defineProps({
  // [颜色, 文字] 的列表，文字是已经译好的。
  items: { type: Array, required: true },
});
</script>

<template>
  <div class="cf-analytics-legend">
    <span v-for="[color, text] in items" :key="text">
      <i :style="{ background: color }" aria-hidden="true"></i>
      <span data-cf-language-text>{{ text }}</span>
    </span>
  </div>
</template>

<style>
.cf-analytics-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--cf-gray-500);
  font-size: var(--cf-font-size-xs);
  line-height: 16px;
}
.cf-analytics-legend > span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.cf-analytics-legend i {
  width: 9px;
  height: 9px;
  border-radius: 2px;
}
</style>
