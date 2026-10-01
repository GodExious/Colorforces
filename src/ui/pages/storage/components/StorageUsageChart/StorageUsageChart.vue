<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { tooltip } from '../../../../components/tooltips/FloatingTooltip/FloatingTooltip.vue';
import { init, use } from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { translate as t } from '../../../../../i18n/index.js';
import { formatStorageBytes } from '../../../../../features/storage/overview.js';

use([PieChart, TooltipComponent, SVGRenderer]);
const props = defineProps({
  overview: { type: Object, required: true },
  groups: { type: Array, required: true },
  active: Boolean,
});
const chartElement = ref(null);
let chart;
let reducedMotion;
const categories = [
  ['clist', '#9dc5eb'],
  ['cf', '#a8d5c2'],
  ['user', '#c4b5e4'],
  ['prediction', '#f1c3a9'],
  ['settings', '#e9b5cc'],
  ['runtime', '#ebd59f'],
  ['local', '#c4cbdc'],
];
// 按真实占比降序排列图表与图例，同值保持原分类顺序，零值不绘制扇区。
const slices = computed(() =>
  categories
    .map(([id, color]) => {
      const bytes = props.overview.items[id].bytes;
      const share = props.overview.total > 0 ? (bytes / props.overview.total) * 100 : 0;
      return {
        id,
        color,
        value: bytes,
        name: t(props.groups.find((group) => group.id === id).bar),
        percentage: share > 0 && share < 0.1 ? '<0.1%' : `${share.toFixed(1)}%`,
        itemStyle: { color },
      };
    })
    .sort((a, b) => b.value - a.value),
);
// 详情仅由饼图悬停触发，使用文本节点避免将翻译内容当作 HTML。
function formatSliceTooltip({ data }) {
  const content = document.createElement('div');
  content.style.whiteSpace = 'pre-line';
  content.textContent = [data.name, `${formatStorageBytes(data.value)} · ${data.percentage}`].join(
    String.fromCharCode(10),
  );
  return content;
}
// 提示以整个统计区域为边界，避免小饼图的自动翻转把内容挤到左侧菜单。
function positionSliceTooltip(point, _params, _element, _rect, size) {
  const width = chartElement.value.closest('.cf-storage-usage').clientWidth;
  return [
    Math.max(0, Math.min(point[0] + 12, width - size.contentSize[0])),
    Math.max(0, point[1] - size.contentSize[1] - 8),
  ];
}
// 复用实例与扇区，只在重新进入时从极小角度展开；数据变化仍采用普通过渡。
function renderChart(replay = false) {
  if (!props.active || !chartElement.value) {
    chart?.dispatchAction({ type: 'hideTip' });
    return;
  }
  const existing = Boolean(chart);
  const animate = !reducedMotion?.matches;
  const data = slices.value.filter((slice) => slice.value > 0);
  chart ??= init(chartElement.value, null, { renderer: 'svg', width: 120, height: 120 });
  if (replay === true && existing && animate && data.length) {
    chart.dispatchAction({ type: 'hideTip' });
    chart.setOption({
      series: [{ id: 'storage-usage', startAngle: 90, endAngle: 89.99, animation: false, data }],
    });
  }
  chart.setOption({
    animation: animate,
    animationDuration: 360,
    animationDurationUpdate: 280,
    tooltip: {
      trigger: 'item',
      renderMode: 'html',
      className: 'cf-storage-chart-tooltip',
      appendTo: chartElement.value.closest('.cf-storage-usage'),
      transitionDuration: 0,
      hideDelay: 60,
      borderWidth: 1,
      padding: [7, 10],
      backgroundColor: 'var(--cf-card-surface, #fff9fc)',
      borderColor: 'var(--cf-surface-border, #e7d5e3)',
      textStyle: { color: 'var(--cf-control-ink, #615570)', fontSize: 11, lineHeight: 18 },
      extraCssText: 'box-shadow:0 4px 16px #5643651c;border-radius:8px;pointer-events:none;',
      formatter: formatSliceTooltip,
      position: positionSliceTooltip,
    },
    series: [
      {
        id: 'storage-usage',
        type: 'pie',
        startAngle: 90,
        endAngle: 'auto',
        animation: animate,
        animationDurationUpdate: replay === true ? 360 : 280,
        radius: [0, '87%'],
        center: ['50%', '50%'],
        stillShowZeroSum: false,
        showEmptyCircle: true,
        emptyCircleStyle: { color: '#e9e4ee' },
        selectedMode: false,
        minAngle: 0,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderWidth: 0.75, borderColor: '#fff9fc' },
        emphasis: { scaleSize: 3, itemStyle: { shadowBlur: 8, shadowColor: '#66507626' } },
        data,
      },
    ],
  });
}
const chartLabel = computed(
  () =>
    `${t('storageTotalTitle')}: ${formatStorageBytes(props.overview.total)}. ${slices.value.map((slice) => `${slice.name}: ${slice.percentage}`).join('; ')}`,
);
watch(
  [slices, () => props.active],
  ([, active], previous) => renderChart(active && !previous?.[1]),
  { flush: 'post' },
);
onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion.addEventListener('change', renderChart);
  renderChart();
});
onBeforeUnmount(() => {
  reducedMotion?.removeEventListener('change', renderChart);
  chart?.dispose();
});
</script>

<template>
  <div class="cf-storage-usage">
    <div class="cf-storage-pie-summary">
      <div ref="chartElement" class="cf-storage-pie" role="img" :aria-label="chartLabel"></div>
      <div class="cf-storage-pie-total">
        <span>{{ t('storageChartTotal') }}</span>
        <strong>{{ formatStorageBytes(overview.total) }}</strong>
      </div>
    </div>
    <ul class="cf-storage-pie-legend">
      <li v-for="slice in slices" :key="slice.id" :data-category="slice.id">
        <i class="cf-storage-pie-dot" :style="{ background: slice.color }" aria-hidden="true"></i>
        <span
          class="cf-storage-pie-name"
          @mouseenter="tooltip.showIfTruncated"
          @mouseleave="tooltip.hide"
          >{{ slice.name }}</span
        >
        <span class="cf-storage-pie-percentage">{{ slice.percentage }}</span>
        <span class="cf-storage-pie-size">{{ formatStorageBytes(slice.value) }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.cf-storage-usage {
  position: relative;
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  align-items: center;
  gap: 20px;
  min-width: 0;
}
/* ECharts 首次显示前尚未设置定位；提示节点不能先占据网格行再移出。 */
.cf-storage-usage :deep(.cf-storage-chart-tooltip) {
  position: absolute;
  pointer-events: none;
}
.cf-storage-pie-summary {
  min-width: 0;
}
.cf-storage-pie {
  width: 120px;
  height: 120px;
}
.cf-storage-pie-total {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 2px 5px;
  margin-top: 2px;
  color: var(--cf-control-ink);
  font-size: 10px;
  line-height: 17px;
}
.cf-storage-pie-total strong {
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.cf-storage-pie-legend {
  justify-self: end;
  width: max-content;
  max-width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 7px minmax(0, max-content) 44px 60px;
  gap: 2px 7px;
  list-style: none;
  font-size: 11px;
  line-height: 17px;
}
.cf-storage-pie-legend li {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: center;
  gap: 7px;
  min-width: 0;
  margin: 0;
  padding: 0;
}
.cf-storage-pie-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.cf-storage-pie-name {
  color: color-mix(in srgb, var(--cf-control-ink) 65%, #586579);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cf-storage-pie-percentage {
  text-align: right;
  color: var(--cf-control-ink);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.cf-storage-pie-size {
  color: color-mix(in srgb, var(--cf-control-ink) 70%, #718096);
  text-align: right;
  white-space: nowrap;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
</style>
