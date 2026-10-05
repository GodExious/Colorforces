<script setup>
import { computed } from 'vue';
import { translate as t, translateTag } from '../../../../../../../../i18n/index.js';
import { appSettings, saveSettings } from '../../../../../../../../settings.js';
import BarList from '../../bases/BarList/BarList.vue';
import ModeSwitch from '../../controls/ModeSwitch/ModeSwitch.vue';
import { tintedTip } from '../../../utils/tips.js';

const props = defineProps({
  // 每个标签：tag 名称、count 通过的题数、covered 覆盖了题库里的多少题、total 题库里共有多少题。
  tags: { type: Array, required: true },
  // 已解决的题数，用来算每个标签占多少。
  solved: { type: Number, required: true },
});
// 图表显示哪一种数值，由标题栏的切换按钮决定；选择记在设置里，换页面后保持。
// 题数：带这个标签的题通过了多少。
// 解决占比：带这个标签的通过题数 ÷ 全部已解决的题数（一道题有多个标签，所以各标签加起来会超过 100%）。
// 全部占比：覆盖了题库里带这个标签的多少题 ÷ 题库里带这个标签的共有多少题。
const modes = [
  ['count', 'analyticsModeCount'],
  ['share', 'analyticsModeShare'],
  ['coverage', 'analyticsModeAll'],
];
function setMode(id) {
  appSettings.user.analytics.tagsMode = id;
  saveSettings();
}
const percentOf = (part, whole) => (whole > 0 ? (part / whole) * 100 : 0);
const percentText = (value) => (value >= 99.95 ? '100%' : `${value.toFixed(1)}%`);
// 某个标签在当前模式下要画的数值；两种占比都是百分数。
function valueOf(item) {
  const mode = appSettings.user.analytics.tagsMode;
  if (mode === 'coverage') return percentOf(item.covered, item.total);
  if (mode === 'share') return percentOf(item.count, props.solved);
  return item.count;
}
// 标签有近四十个，折叠时只列最多的一部分，其余展开后可见。
const COLLAPSED = 12;
// 各行。排列顺序始终按通过题数从多到少，切换数值时各行不换位置，只是柱长和数字变。
// 悬停提示里三种数值都写出来，不管当前切到哪一种。
// 标签名跟随菜单语言显示译名；没有译名的标签显示原站的名字。
const rows = computed(() =>
  props.tags.map((item) => ({
    name: translateTag(item.tag),
    value: valueOf(item),
    tip: () =>
      tintedTip(
        translateTag(item.tag),
        null,
        t(
          'analyticsCoverageTip',
          item.count,
          percentText(percentOf(item.count, props.solved)),
          item.covered,
          item.total,
          percentText(percentOf(item.covered, item.total)),
        ),
      ),
  })),
);
// 数字滚动时是小数：题数取整后显示，占比保留一位。
const format = computed(() =>
  appSettings.user.analytics.tagsMode === 'count'
    ? (value) => String(Math.round(value))
    : percentText,
);
</script>

<template>
  <section class="cf-analytics-card">
    <header class="cf-analytics-card-head">
      <h4>
        <span data-cf-language-text>{{ t('analyticsTagsTitle') }}</span>
      </h4>
      <div class="cf-analytics-card-tools">
        <ModeSwitch
          :modes="modes"
          :model-value="appSettings.user.analytics.tagsMode"
          :label="t('analyticsModeLabel')"
          @update:model-value="setMode"
        />
      </div>
    </header>
    <BarList
      :rows="rows"
      :collapsed="COLLAPSED"
      :format="format"
      :more-text="t('analyticsTagsMore', tags.length)"
      :less-text="t('analyticsTagsLess')"
    />
  </section>
</template>
