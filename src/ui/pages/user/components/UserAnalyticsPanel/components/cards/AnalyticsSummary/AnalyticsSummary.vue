<script setup>
import { computed } from 'vue';
import { translate as t } from '../../../../../../../../i18n/index.js';
import { PETAL_COLORS } from '../../../../../../../../utils/petal-palette.js';
import { isTruncated, textOverflow } from '../../../../../../../../utils/text-overflow.js';
import { tooltip } from '../../../../../../../components/tooltips/FloatingTooltip/FloatingTooltip.vue';
import AnimatedNumber from '../../parts/AnimatedNumber/AnimatedNumber.vue';
import ZonePicker from '../../controls/ZonePicker/ZonePicker.vue';
import { ratingPaint } from '../../../utils/rating-paint.js';
import { usesClist } from '../../../composables/rating-source.js';

const props = defineProps({
  summary: { type: Object, required: true },
  // 「最长连续」划分日期用的时区（相对 UTC 的小时数）；null 表示还没单独设置，用查看者自己的时区。
  zone: { type: Number, default: null },
});
const emit = defineEmits(['zone']);

const count = (value) => Math.round(value).toLocaleString('en-US');
const percent = (value) => `${(value * 100).toFixed(1)}%`;
const days = (value) => t('analyticsDays', count(value));
const pad = (value) => String(value).padStart(2, '0');
// 统计里的「第几天」已经是按所选时区划分的，直接换成日期文字。
function dateText(day) {
  const date = new Date(day * 86400000);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
// 最长连续的起止日期，只写日期不写时刻。起止两个日期都写全年份，同一年也不省略。
// 时区不再跟在日期后面：卡片右上角的时区选择已经标明了。
function streakRange(summary) {
  if (summary.streakStart === null) return null;
  const start = dateText(summary.streakStart);
  const end = dateText(summary.streakEnd);
  return { text: start === end ? start : `${start} – ${end}` };
}
// 只有小字真的被省略时，悬停才显示完整内容；看得全的不再重复提示。
function showFullNote(event, note) {
  const target = event.currentTarget;
  if (isTruncated(target)) tooltip.show(target, note.text);
}
// 小字放不下时，把字距略微收紧到刚好放下，而不是截断。
// 每个字最多收 0.8 像素；再放不下才会被省略，那时悬停可以看到完整内容。
const fitted = new WeakMap();
function fit(element) {
  element.style.letterSpacing = '';
  const overflow = textOverflow(element);
  const length = element.textContent.length;
  if (overflow > 0.1 && length > 1)
    element.style.letterSpacing = `${-Math.min(0.8, overflow / (length - 1) + 0.02)}px`;
}
const vFit = {
  // 卡片可能在收起状态下挂上，或之后改变宽度，所以跟着尺寸变化重新计算。
  mounted(element) {
    const observer = new ResizeObserver(() => fit(element));
    observer.observe(element);
    fitted.set(element, observer);
  },
  updated: fit,
  unmounted(element) {
    fitted.get(element)?.disconnect();
  },
};
// 八项数字各取标志上的一片花瓣作点缀色。note 是数字下方的一行小字。
const cards = computed(() => {
  const s = props.summary;
  // 两项难度分下面的小字标出用的是哪一种难度分。
  const source = { text: t(usesClist.value ? 'analyticsSourceClist' : 'analyticsSourceOfficial') };
  return [
    // 提交数是全部提交，一道题通过之后再交的也算在内，下面的小字说明这一点。
    {
      label: 'analyticsSubmissions',
      value: s.submissions,
      format: count,
      note: { text: t('analyticsSubmissionsNote') },
    },
    {
      label: 'analyticsSolved',
      value: s.solved,
      format: count,
      note: { text: t('analyticsSolvedNote', count(s.tried)) },
    },
    {
      label: 'analyticsAcceptRate',
      value: s.acceptRate,
      format: percent,
      note: { text: t('analyticsAcceptNote', count(s.accepted), count(s.submissions)) },
    },
    {
      label: 'analyticsFirstTry',
      value: s.firstTryRate,
      format: percent,
      note: { text: t('analyticsFirstTryNote', count(s.firstTry), count(s.solved)) },
    },
    { label: 'analyticsMaxRating', value: s.maxRating, format: count, rating: true, note: source },
    {
      label: 'analyticsAverageRating',
      value: s.averageRating,
      format: count,
      rating: true,
      note: source,
    },
    {
      label: 'analyticsStreak',
      value: s.streak,
      format: days,
      note: streakRange(s),
      zonePicker: true,
    },
    {
      label: 'analyticsCoverage',
      value: s.coverage,
      format: percent,
      note: { text: t('analyticsCoverageNote', count(s.covered), count(s.problemsetSize)) },
    },
  ].map((card, index) => ({ ...card, accent: PETAL_COLORS[index % PETAL_COLORS.length] }));
});
// 难度分只把数字染成对应档位的颜色，不再套一层标签框。
const ratingColor = (card) =>
  card.rating && card.value !== null ? { color: ratingPaint(card.value).text } : null;
</script>

<template>
  <ul class="cf-analytics-summary">
    <li v-for="card in cards" :key="card.label" :style="{ '--cf-analytics-card': card.accent }">
      <span class="cf-analytics-summary-label" data-cf-language-text>{{ t(card.label) }}</span>
      <span class="cf-analytics-summary-value" :style="ratingColor(card)">
        <AnimatedNumber :value="card.value" :format="card.format" empty="N/A" />
      </span>
      <!-- 小字放不下时先收紧字距；仍放不下才省略，悬停显示完整内容。内容变了就淡出旧的、淡入新的。 -->
      <Transition name="cf-analytics-swap" mode="out-in">
        <span
          v-if="card.note"
          :key="card.note.text"
          v-fit
          class="cf-analytics-summary-note"
          data-cf-language-text
          @mouseenter="showFullNote($event, card.note)"
          @mouseleave="tooltip.hide"
          >{{ card.note.text }}</span
        >
      </Transition>
      <!-- 时区选择贴在卡片右上角。它和难度热力图上的那一个改的是同一个值。 -->
      <ZonePicker
        v-if="card.zonePicker"
        class="cf-analytics-summary-zone"
        :zone="zone"
        @zone="emit('zone', $event)"
      />
    </li>
  </ul>
</template>

<style>
.cf-analytics-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.cf-analytics-summary li {
  position: relative;
  display: grid;
  align-content: start;
  gap: 3px;
  min-width: 0;
  margin: 0;
  padding: 10px 12px 10px 15px;
  border: 1px solid color-mix(in srgb, var(--cf-analytics-card) 22%, #e8ebf0);
  border-radius: var(--cf-radius-md);
  background: color-mix(in srgb, var(--cf-analytics-card) 6%, #fff);
  overflow: hidden;
}
/* 左侧一道花瓣色的竖条，区分八项数字。 */
.cf-analytics-summary li::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--cf-analytics-card);
  opacity: 0.75;
}
.cf-analytics-summary-label {
  color: var(--cf-gray-500);
  font-size: var(--cf-font-size-xs);
  line-height: 1.4;
}
/* 难度分的数字换档位时，颜色平滑过渡。 */
.cf-analytics-summary-value {
  display: flex;
  align-items: center;
  min-height: 26px;
  color: var(--cf-gray-800);
  font-size: 20px;
  line-height: 26px;
  white-space: nowrap;
  transition: color 0.3s ease;
}
/* 小字向右多占 8 像素（卡片右侧留白原为 12 像素），给较长的内容多留一点位置。 */
.cf-analytics-summary-note {
  margin-right: -8px;
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-xs);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
/* 时区选择贴在「最长连续」卡片的右上角；控件本身的样子在它自己的组件里。 */
.cf-analytics-summary-zone {
  position: absolute;
  top: 6px;
  right: 7px;
}
@media (max-width: 900px) {
  .cf-analytics-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (prefers-reduced-motion: reduce) {
  .cf-analytics-summary-value {
    transition: none;
  }
}
</style>
