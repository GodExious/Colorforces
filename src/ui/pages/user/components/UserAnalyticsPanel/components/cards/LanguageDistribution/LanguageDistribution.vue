<script setup>
import { computed } from 'vue';
import { appSettings } from '../../../../../../../../settings.js';
import { translate as t } from '../../../../../../../../i18n/index.js';
import { getLanguageIconSrc } from '../../../../../../../../features/appearance/language-icons.js';
import BarList from '../../bases/BarList/BarList.vue';
import { countText, percentOf, percentText } from '../../../utils/numbers.js';
import { tintedTip } from '../../../utils/tips.js';

const props = defineProps({
  // [{ language, count }]，从多到少，见统计模块的 languageDistribution。
  // 每道已通过的题按首次通过时用的语言计一次；同一种语言的不同版本已经并在一起。
  languages: { type: Array, required: true },
});

// 常用的语言就那么几种，折叠时只列前面的一部分，其余展开后可见。
const COLLAPSED = 8;
const total = computed(() => props.languages.reduce((sum, item) => sum + item.count, 0));
const rows = computed(() =>
  props.languages.map((item) => ({
    name: item.language,
    value: item.count,
    // 语言名称右边配上它的图标，和提交记录页用的是同一套；没有预设图标的语言用统一的「未知语言」图标。
    icon: getLanguageIconSrc(item.language),
    tip: () =>
      tintedTip(
        item.language,
        null,
        t(
          'analyticsSolvedShareTip',
          countText(item.count),
          percentText(percentOf(item.count, total.value)),
        ),
      ),
  })),
);
</script>

<template>
  <section class="cf-analytics-card">
    <header class="cf-analytics-card-head">
      <h4>
        <span data-cf-language-text>{{ t('analyticsChartLanguages') }}</span>
      </h4>
      <div class="cf-analytics-card-tools">
        <span class="cf-analytics-card-note" data-cf-language-text>{{
          t('analyticsLanguagesNote')
        }}</span>
      </div>
    </header>
    <BarList
      :rows="rows"
      :icons-shown="appSettings.appearance.langIcon.enabled"
      :collapsed="COLLAPSED"
      :more-text="t('analyticsLanguagesMore', languages.length)"
      :less-text="t('analyticsTagsLess')"
    />
  </section>
</template>
