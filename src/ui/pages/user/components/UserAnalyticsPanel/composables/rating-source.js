import { computed } from 'vue';
import { appSettings } from '../../../../../../settings.js';

// 数据分析里的难度分用的是哪一种：开着「沿用难度分来源」并且启用了 CList 时用 CList 难度分，否则用官方难度分。
// 和难度分有关的几张图（统计摘要、难度热力图、难度分布、近期平均难度、未解决题目）都按它取分，也都标出它。
export const usesClist = computed(
  () => appSettings.user.analytics.followRatingSource && Boolean(appSettings.ratings.clist.enabled),
);
