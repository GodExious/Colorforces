<script setup>
import { computed } from 'vue';
import { translate as t } from '../../../../../../../../i18n/index.js';
import { appSettings, saveSettings } from '../../../../../../../../settings.js';
import ColumnChart from '../../bases/ColumnChart/ColumnChart.vue';
import ModeSwitch from '../../controls/ModeSwitch/ModeSwitch.vue';
import ZonePicker from '../../controls/ZonePicker/ZonePicker.vue';
import { countText } from '../../../utils/numbers.js';
import { tintedTip } from '../../../utils/tips.js';

const props = defineProps({
  // 24 项 { hour, submissions, accepted }，见统计模块的 hourlyActivity：所选时间跨度里的提交按钟点计数，钟点已经按下面这个时区算好。
  hours: { type: Array, required: true },
  // 算钟点用的时区（相对 UTC 的小时数）；null 表示用查看者自己的时区。和「最长连续」、难度热力图上的是同一个值。
  zone: { type: Number, default: null },
});
const emit = defineEmits(['zone']);

// 统计多长时间以内的提交，由标题栏的切换按钮决定；选择记在设置里，换页面后保持。
const spans = [
  ['all', 'analyticsSpanAll'],
  ['year', 'analyticsSpanYear'],
  ['quarter', 'analyticsSpanQuarter'],
  ['month', 'analyticsSpanMonth'],
  ['week', 'analyticsSpanWeek'],
];
function setSpan(id) {
  appSettings.user.analytics.hoursSpan = id;
  saveSettings();
}

// 柱子的颜色，后面一个是悬停时的颜色。
const COLORS = ['#8a7ad8', '#6f5fc4'];
const pad = (value) => String(value).padStart(2, '0');
// 横轴标 0 到 23。
const labels = computed(() => props.hours.map(({ hour }) => String(hour)));
const series = computed(() => [
  {
    id: 'submissions',
    values: props.hours.map((item) => item.submissions),
    colors: COLORS,
  },
]);
// 提示：这一个小时的起止时刻，提交了多少次、其中通过多少次。
function tipOf(index) {
  const item = props.hours[index];
  return tintedTip(
    `${pad(item.hour)}:00–${pad(item.hour)}:59`,
    COLORS[0],
    t('analyticsHoursTip', countText(item.submissions), countText(item.accepted)),
  );
}
</script>

<template>
  <section class="cf-analytics-card">
    <header class="cf-analytics-card-head">
      <h4>
        <span data-cf-language-text>{{ t('analyticsChartHours') }}</span>
      </h4>
      <div class="cf-analytics-card-tools">
        <ModeSwitch
          :modes="spans"
          :model-value="appSettings.user.analytics.hoursSpan"
          :label="t('analyticsSpanLabel')"
          @update:model-value="setSpan"
        />
        <!-- 按哪个时区算钟点。和「最长连续」、难度热力图上的那一个改的是同一个值。 -->
        <ZonePicker :zone="zone" @zone="emit('zone', $event)" />
      </div>
    </header>
    <!-- 一栏不到 28 像素宽时柱顶的数字会挤在一起，那时不标，看悬停提示。 -->
    <ColumnChart :labels="labels" :series="series" :tip="tipOf" :label-room="28" />
  </section>
</template>
