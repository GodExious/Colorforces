<script setup>
import { computed } from 'vue';
import { appSettings, saveSettings } from '../../../../../../../../settings.js';
import { translate as t } from '../../../../../../../../i18n/index.js';
import {
  HISTORY,
  rowsOfDivision,
  rankTicks,
} from '../../../../../../../../features/user/analytics/rating-history.js';
import CompareCard from '../../bases/CompareCard/CompareCard.vue';
import ModeSwitch from '../../controls/ModeSwitch/ModeSwitch.vue';
import { useCompareChart } from '../../../composables/compare-chart.js';

// 参赛排名曲线对比：几个账号每场评级比赛的名次画在同一张图里，名次靠前的在上面。
// 数据来自评级历史，所以只有计入评级的那些场；没计入评级的参赛（赛外、虚拟参赛等）不在里面，标题后面注明了这一点。
// 可以只看某一类比赛（Div. 1 到 Div. 4，或者其余的），也可以全部一起看。
// 账号名单和「评级曲线对比」共用，见 compareAccounts；时间轴、范围选择、线和提示见 compareChart。
const props = defineProps({
  // 对比中的账号名单。
  accounts: { type: Object, required: true },
});

// 可选的比赛类别；选择记在设置里，换页面后保持。
const divisions = [
  ['all', 'analyticsDivisionAll'],
  ['div1', 'analyticsDivision1'],
  ['div2', 'analyticsDivision2'],
  ['div3', 'analyticsDivision3'],
  ['div4', 'analyticsDivision4'],
  ['other', 'analyticsDivisionOther'],
];
function setDivision(id) {
  appSettings.user.analytics.rankDivision = id;
  saveSettings();
}
// 每个账号一条线，只画选中的那一类比赛；一场都没有的账号这次不画。
const lines = computed(() =>
  props.accounts.drawn
    .map((entry) => ({
      entry,
      ...rowsOfDivision(entry.history, appSettings.user.analytics.rankDivision),
    }))
    .filter((line) => line.rows.length),
);

// 名次轴是对数的：第 1 名和第 10 名之间，跟第 100 名和第 1000 名之间一样宽，前面的名次才分得开。
// 图表库自带的对数轴只能把刻度标在 10 的整数次方上，所以这里自己取对数，轴上按普通的数值轴画，刻度再写回名次。
const valueOf = (row) => Math.log10(row[HISTORY.rank]);
function axis(rows) {
  // 一场都没有时（这一类比赛谁都没参加过）画一条空的轴。
  const ranks = rows.length ? rows.map((row) => row[HISTORY.rank]) : [1, 1000];
  const best = Math.log10(Math.min(...ranks));
  const worst = Math.log10(Math.max(...ranks));
  // 上下各留一点空，最好和最差的那一场不贴着边。
  const side = Math.max(0.05, (worst - best) * 0.08);
  const min = best - side;
  const max = worst + side;
  return {
    min,
    max,
    ticks: rankTicks(10 ** min, 10 ** max).map(Math.log10),
    format: (value) => String(Math.round(10 ** value)),
    inverse: true,
    guides: true,
  };
}
const { element } = useCompareChart({
  accounts: props.accounts,
  lines: () => lines.value,
  valueOf,
  axis,
});
</script>

<template>
  <CompareCard
    :title="t('analyticsChartCompareRank')"
    :note="t('analyticsCompareRankNote')"
    :accounts="accounts"
  >
    <template #tools>
      <ModeSwitch
        :modes="divisions"
        :model-value="appSettings.user.analytics.rankDivision"
        :label="t('analyticsDivisionLabel')"
        @update:model-value="setDivision"
      />
    </template>
    <div class="cf-analytics-compare-stage">
      <div ref="element" class="cf-analytics-chart cf-analytics-compare-chart has-controls"></div>
      <!-- 选中的这一类比赛谁都没参加过：图表留着空的坐标轴，中间写一句说明。 -->
      <Transition name="cf-analytics-swap">
        <p v-if="!lines.length" class="cf-analytics-compare-none">
          <span data-cf-language-text>{{ t('analyticsCompareRankEmpty') }}</span>
        </p>
      </Transition>
    </div>
  </CompareCard>
</template>

<style>
.cf-analytics-compare-stage {
  position: relative;
}
/* 盖在绘图区正中的一句说明，不挡鼠标。 */
.cf-analytics-compare-none {
  position: absolute;
  top: 88px;
  right: 0;
  left: 0;
  margin: 0;
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-base);
  text-align: center;
  pointer-events: none;
}
</style>
