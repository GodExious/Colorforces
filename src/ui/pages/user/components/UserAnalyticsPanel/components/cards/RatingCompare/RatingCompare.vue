<script setup>
import { use } from 'echarts/core';
import { CustomChart } from 'echarts/charts';
import { translate as t } from '../../../../../../../../i18n/index.js';
import { HISTORY } from '../../../../../../../../features/user/analytics/rating-history.js';
import { mixHex } from '../../../../../../../../utils/color.js';
import CompareCard from '../../bases/CompareCard/CompareCard.vue';
import { useCompareChart } from '../../../composables/compare-chart.js';

// 背景的色带是自己画的图形，在这里登记。
use([CustomChart]);

// 评级曲线对比：几个账号在整条时间线上的评级变化画在同一张图里。
// 账号名单和「参赛排名曲线对比」共用，见 compareAccounts；时间轴、范围选择、线和提示见 compareChart。
const props = defineProps({
  // 对比中的账号名单。
  accounts: { type: Object, required: true },
});

// 背景的色带：评级的各个档位，颜色取原站评级图的那一套，再调淡一些让线更显眼。
const BANDS = [
  [-Infinity, 1200, '#cccccc'],
  [1200, 1400, '#77ff77'],
  [1400, 1600, '#77ddbb'],
  [1600, 1900, '#aaaaff'],
  [1900, 2100, '#ff88ff'],
  [2100, 2300, '#ffcc88'],
  [2300, 2400, '#ffbb55'],
  [2400, 2600, '#ff7777'],
  [2600, 3000, '#ff3333'],
  [3000, Infinity, '#aa0000'],
];
// 每个账号一条线，画它的全部场次。
const lines = () =>
  props.accounts.drawn.map((entry) => ({
    entry,
    rows: entry.history.rows,
    names: entry.history.contests,
  }));
// 评级轴取整到百位，上下各留一点空。
function axis(rows) {
  const ratings = rows.map((row) => row[HISTORY.rating]);
  const min = Math.floor((Math.min(...ratings) - 40) / 100) * 100;
  const max = Math.ceil((Math.max(...ratings) + 40) / 100) * 100;
  // 纵轴的刻度标在档位的分界上，和原站的评级图一样；范围里的分界太少时用自动的刻度。
  const edges = BANDS.map(([from]) => from).filter((edge) => edge > min && edge < max);
  // 评级写成不带千位分隔符的数字。
  return { min, max, ticks: edges.length >= 2 ? edges : null, format: (value) => String(value) };
}
// 背景的色带，只画落在纵轴范围里的部分。纵轴范围变了，色带带着过渡挪到新位置。
function bands({ min, max, at }) {
  const tone = (color) => mixHex(color, '#ffffff', 0.66);
  return {
    id: 'bands',
    type: 'custom',
    silent: true,
    z: 1,
    data: BANDS.filter(([bottom, top]) => top > min && bottom < max).map(([bottom, top, color]) => [
      at,
      Math.max(bottom, min),
      Math.min(top, max),
      color,
    ]),
    encode: { x: 0, y: [1, 2] },
    renderItem(params, api) {
      const top = api.coord([api.value(0), api.value(2)])[1];
      const bottom = api.coord([api.value(0), api.value(1)])[1];
      return {
        type: 'rect',
        shape: {
          x: params.coordSys.x,
          y: top,
          width: params.coordSys.width,
          height: bottom - top,
        },
        style: { fill: tone(api.value(3)) },
        transition: ['shape'],
      };
    },
  };
}
const { element } = useCompareChart({
  accounts: props.accounts,
  lines,
  valueOf: (row) => row[HISTORY.rating],
  axis,
  backdrop: bands,
});
</script>

<template>
  <CompareCard :title="t('analyticsChartCompare')" :accounts="accounts">
    <div ref="element" class="cf-analytics-chart cf-analytics-compare-chart has-controls"></div>
  </CompareCard>
</template>
