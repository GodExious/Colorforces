<script setup>
import { computed } from 'vue';
import { translate as t, translateTag } from '../../../../../../../../i18n/index.js';
import BarList from '../../bases/BarList/BarList.vue';
import { countText } from '../../../utils/numbers.js';
import { tintedTip } from '../../../utils/tips.js';

const props = defineProps({
  // [{ tag, solved, tries, average }]，平均次数从多到少，见统计模块的 tagWeakness。
  // average 是这个标签下已通过的题，到首次通过为止平均交了几次；越大说明这类题越费劲。
  tags: { type: Array, required: true },
  // 通过题数不到这个数的标签没有参与统计。
  minSolved: { type: Number, required: true },
});

// 折叠时只列最费劲的一部分，其余展开后可见。
const COLLAPSED = 10;
// 柱子用偏暖的颜色，和表示数量的蓝色柱子区分开：这里柱子越长越不是好事。
const COLOR = '#e0795a';
// 平均次数保留两位小数；数字滚动时传进来的也是小数。
const format = (value) => value.toFixed(2);
const rows = computed(() =>
  props.tags.map((item) => {
    const name = translateTag(item.tag);
    return {
      name,
      value: item.average,
      color: COLOR,
      tip: () =>
        tintedTip(
          name,
          COLOR,
          t(
            'analyticsWeaknessTip',
            format(item.average),
            countText(item.solved),
            countText(item.tries),
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
        <span data-cf-language-text>{{ t('analyticsChartWeakness') }}</span>
      </h4>
      <div class="cf-analytics-card-tools">
        <span class="cf-analytics-card-note" data-cf-language-text>{{
          t('analyticsWeaknessNote', minSolved)
        }}</span>
      </div>
    </header>
    <p v-if="!tags.length" class="cf-analytics-card-empty">
      <span data-cf-language-text>{{ t('analyticsWeaknessEmpty', minSolved) }}</span>
    </p>
    <BarList
      v-else
      :rows="rows"
      :collapsed="COLLAPSED"
      :format="format"
      :more-text="t('analyticsTagsMore', tags.length)"
      :less-text="t('analyticsTagsLess')"
    />
  </section>
</template>
