<script setup>
import { translate as t } from '../../../../../../../../i18n/index.js';
import { usesClist } from '../../../composables/rating-source.js';

// 标题栏里的一个小标注：这张图里的难度分是官方的还是 CList 的。来源切换时淡出旧的、淡入新的。
// 和难度分有关的图表都放一个，样子和位置一致。
</script>

<template>
  <Transition name="cf-analytics-swap" mode="out-in">
    <span :key="usesClist" class="cf-analytics-source" data-cf-language-text>{{
      t(usesClist ? 'analyticsSourceClist' : 'analyticsSourceOfficial')
    }}</span>
  </Transition>
</template>
