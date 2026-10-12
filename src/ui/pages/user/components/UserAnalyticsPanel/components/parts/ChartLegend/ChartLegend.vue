<script setup>
// 图表标题栏里的图例：每项一个色块加一段文字，说明各组柱子各是什么。
defineProps({
  // [颜色, 文字] 的列表，文字是已经译好的。
  items: { type: Array, required: true },
});
</script>

<template>
  <div class="cf-analytics-legend">
    <!-- 各项按位置对应，不按文字：换语言时文字变了，还是原来那一项，才能原地换字、带着过渡挪位置。 -->
    <span v-for="([color, text], index) in items" :key="index">
      <i :style="{ background: color }" aria-hidden="true"></i>
      <span>{{ text }}</span>
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
  border-radius: var(--cf-radius-2xs);
}
</style>
