<script setup>
import { translate as t } from '../../../../../../../../i18n/index.js';

// 临时的提醒，放在数据分析面板的标题栏下面：后续版本要做主题配色，所以不再适配其他插件的深色主题。
// 一直显示，不能关。榜单页比赛评分预测的状态栏下面也有同样的一条（见 rating-prediction 的 render.js）。
// 主题功能上线后，这个组件、榜单页的那一条和文案一起删掉。
</script>

<template>
  <div class="cf-analytics-notice" role="note">
    <span data-cf-language-text>{{ t('themeNotice') }}</span>
  </div>
</template>

<style>
/* 和出错提示是同样的一条，换成暖色：是提醒，不是出错。 */
.cf-analytics-notice {
  padding: 7px 12px;
  border: 1px solid #ecdcae;
  border-left: 3px solid #d9a93f;
  border-radius: var(--cf-radius-md);
  background: #fffaf0;
  color: #77572e;
  font-size: var(--cf-font-size-base);
}
</style>
