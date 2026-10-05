import { ref, watch } from 'vue';
import { appSettings } from '../../../../../../settings.js';

// 条目多的分析表（标签分布、未解决题目等）是展开着还是折叠着。
// 「折叠过长的分析表」决定默认的状态：开着时默认折叠，关掉时默认展开。
// 每张表仍可以用表下方的一栏各自展开或收起；设置一改，各张表都回到设置所指的状态。
export function useFold() {
  const expanded = ref(!appSettings.user.analytics.collapse);
  watch(
    () => appSettings.user.analytics.collapse,
    (collapse) => {
      expanded.value = !collapse;
    },
  );
  return expanded;
}
