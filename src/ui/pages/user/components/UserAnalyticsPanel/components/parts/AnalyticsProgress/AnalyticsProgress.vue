<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { translate as t } from '../../../../../../../../i18n/index.js';
import { formatStorageBytes } from '../../../../../../../../features/storage/overview.js';

const props = defineProps({
  // 是否正在加载。进度条收起后组件仍留在页面里，只是不再计时。
  active: Boolean,
  stage: { type: String, default: '' },
  received: { type: Number, default: 0 },
  queueUntil: { type: Number, default: 0 },
  // 已有旧数据、正在换新时，补一句说明当前显示的是上次的数据。
  updating: Boolean,
});
// 一次加载只有一个请求，没有真实的百分比；这里按阶段显示，每一段的状态都是实际发生的。
const steps = [
  ['queue', 'analyticsStageQueue'],
  ['server', 'analyticsStageServer'],
  ['receive', 'analyticsStageReceive'],
  ['compute', 'analyticsStageCompute'],
];
const current = computed(() =>
  Math.max(
    0,
    steps.findIndex(([id]) => id === props.stage),
  ),
);
// 排队阶段每隔一小段时间更新一次剩余秒数；不在加载时不计时。
const now = ref(Date.now());
let timer;
watch(
  () => props.active,
  (active) => {
    clearInterval(timer);
    if (active) timer = setInterval(() => (now.value = Date.now()), 250);
  },
  { immediate: true },
);
onBeforeUnmount(() => clearInterval(timer));
const detail = computed(() => {
  if (props.stage === 'receive')
    return t('analyticsDetailReceive', formatStorageBytes(props.received));
  if (props.stage === 'server') return t('analyticsDetailServer');
  if (props.stage === 'compute') return t('analyticsDetailCompute');
  const seconds = Math.max(0, Math.ceil((props.queueUntil - now.value) / 1000));
  return seconds > 0 ? t('analyticsDetailQueue', seconds) : t('analyticsDetailStart');
});
</script>

<template>
  <div class="cf-analytics-progress" role="status" aria-live="polite">
    <ol class="cf-analytics-steps">
      <li
        v-for="([id, label], index) in steps"
        :key="id"
        :class="{ 'is-done': index < current, 'is-active': index === current }"
      >
        <i class="cf-analytics-step-bar" aria-hidden="true"></i>
        <span data-cf-language-text>{{ t(label) }}</span>
      </li>
    </ol>
    <p class="cf-analytics-progress-detail">
      <span data-cf-language-text
        >{{ detail }}<template v-if="updating"> · {{ t('analyticsUpdating') }}</template></span
      >
    </p>
  </div>
</template>

<style>
.cf-analytics-progress {
  display: grid;
  gap: 8px;
}
.cf-analytics-steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.cf-analytics-steps li {
  display: grid;
  gap: 5px;
  margin: 0;
  padding: 0;
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-xs);
  line-height: 1.4;
  transition: color 0.2s ease;
}
.cf-analytics-step-bar {
  display: block;
  height: 4px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--cf-analytics-accent) 14%, #eef0f4);
  transition: background-color 0.3s ease;
}
.cf-analytics-steps .is-done {
  color: var(--cf-gray-500);
}
.cf-analytics-steps .is-done .cf-analytics-step-bar {
  background: var(--cf-analytics-accent);
}
.cf-analytics-steps .is-active {
  color: var(--cf-analytics-ink);
  font-weight: var(--cf-font-weight-semibold);
}
/* 进行中的一段用流动的光带表示「正在进行」，不显示数字。 */
.cf-analytics-steps .is-active .cf-analytics-step-bar {
  background: linear-gradient(
    90deg,
    var(--cf-analytics-accent) 0%,
    color-mix(in srgb, var(--cf-analytics-accent) 28%, #fff) 50%,
    var(--cf-analytics-accent) 100%
  );
  background-size: 200% 100%;
  animation: cf-analytics-flow 1.2s linear infinite;
}
.cf-analytics-progress-detail {
  margin: 0;
  color: var(--cf-gray-500);
  font-size: var(--cf-font-size-base);
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}
@keyframes cf-analytics-flow {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: 0 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cf-analytics-steps .is-active .cf-analytics-step-bar {
    animation: none;
  }
}
</style>
