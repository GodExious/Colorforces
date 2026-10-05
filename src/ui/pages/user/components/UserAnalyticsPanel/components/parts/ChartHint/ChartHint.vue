<script setup>
// 图表下方的一行小字提示，前面一个伸出食指的小手图标：告诉用户这张图能怎么点。
// 用在提示可以点击固定的图表上（难度热力图、评级曲线对比、参赛排名曲线对比、近期平均难度）。
defineProps({
  // 这一行从左边缩进多少像素：和上面图表里内容开始的位置（比如坐标轴的左下角）对齐。
  inset: { type: Number, default: 0 },
});
</script>

<template>
  <p class="cf-analytics-hint" :style="{ paddingLeft: `${inset}px` }">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 13.5V4.5a1.5 1.5 0 0 1 3 0V11M12 9.5a1.5 1.5 0 0 1 3 0v2M15 10.5a1.5 1.5 0 0 1 3 0V12M18 11.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2.2a6 6 0 0 1-4.9-2.5L4.3 14.2a1.5 1.5 0 0 1 .5-2.1 1.8 1.8 0 0 1 2.2.3l2 2.1"
      />
    </svg>
    <span data-cf-language-text><slot /></span>
  </p>
</template>

<style>
.cf-analytics-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  /* 贴近上面的图表一些：卡片里各块之间的间隔对这样一行小字来说太松。 */
  margin: -4px 0 -2px;
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-xs);
  line-height: 16px;
}
.cf-analytics-hint svg {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
