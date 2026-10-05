<script setup>
import { computed } from 'vue';
import { appSettings } from '../../../../../../../../settings.js';
import { translate as t } from '../../../../../../../../i18n/index.js';
import BarList from '../../bases/BarList/BarList.vue';
import { countText, percentOf, percentText } from '../../../utils/numbers.js';
import { tintedTip } from '../../../utils/tips.js';

const props = defineProps({
  // [{ verdict, count }]，从多到少，见统计模块的 verdictDistribution。verdict 是接口里的写法。
  verdicts: { type: Array, required: true },
});

// 接口里全大写加下划线的写法改成原站页面上的写法：TIME_LIMIT_EXCEEDED → Time limit exceeded。
const plain = (code) => {
  const text = code.toLowerCase().replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};
// 常见的判题结果：缩写（和插件在提交记录页用的缩写一致）、柱子的颜色，以及和接口写法对不上的全称。
// 通过是绿色，各种没通过的各用一种颜色，编译错误、跳过这类不算尝试的用灰色。
const KNOWN = {
  OK: { short: 'AC', color: '#34b37a', full: 'Accepted' },
  WRONG_ANSWER: { short: 'WA', color: '#e5484d' },
  TIME_LIMIT_EXCEEDED: { short: 'TLE', color: '#f08c2e' },
  MEMORY_LIMIT_EXCEEDED: { short: 'MLE', color: '#a56be0' },
  RUNTIME_ERROR: { short: 'RE', color: '#d6a11f' },
  COMPILATION_ERROR: { short: 'CE', color: '#8b97a8' },
  IDLENESS_LIMIT_EXCEEDED: { short: 'ILE', color: '#e07a5f' },
  PRESENTATION_ERROR: { short: 'PE', color: '#c9627f' },
  SKIPPED: { short: 'SK', color: '#8b97a8' },
  CHALLENGED: { short: 'Hacked', color: '#d9558f', full: 'Hacked' },
};
// 其余少见的结果没有缩写，两种写法下都显示全称，用中性的灰蓝色。
const OTHER_COLOR = '#7a8fb5';

// 行首写缩写还是全称，跟随「判题结果缩写」的设置（默认快捷键 Shift+S），和提交记录页保持一致。
// 全称比缩写长得多，名称一栏的宽度不跟着变（各张条形图的柱子要对齐）；放不下的由条形列表省略，悬停显示全名。
const short = computed(() => appSettings.appearance.shortVerdict);

// 折叠时只列最多的几种，其余展开后可见。
const COLLAPSED = 8;
const total = computed(() => props.verdicts.reduce((sum, item) => sum + item.count, 0));
// 提示里写结果的名称，跟随菜单语言；没有译名的显示原站的写法。
const localName = (code) => t('analyticsVerdictNames')[code] || plain(code);
const rows = computed(() =>
  props.verdicts.map((item) => {
    const known = KNOWN[item.verdict];
    const full = known?.full || plain(item.verdict);
    const color = known?.color || OTHER_COLOR;
    return {
      name: short.value ? known?.short || full : full,
      value: item.count,
      color,
      tip: () =>
        tintedTip(
          localName(item.verdict),
          color,
          t(
            'analyticsSubmissionShareTip',
            countText(item.count),
            percentText(percentOf(item.count, total.value)),
          ),
        ),
    };
  }),
);
</script>

<template>
  <section class="cf-analytics-card">
    <header class="cf-analytics-card-head">
      <h4>
        <span data-cf-language-text>{{ t('analyticsChartVerdicts') }}</span>
      </h4>
    </header>
    <BarList
      :rows="rows"
      :collapsed="COLLAPSED"
      :more-text="t('analyticsVerdictsMore', verdicts.length)"
      :less-text="t('analyticsTagsLess')"
    />
  </section>
</template>
