<script setup>
import { computed } from 'vue';
import { translate as t } from '../../../../../../../../i18n/index.js';
import { bucketRating } from '../../../../../../../../features/user/analytics/stats.js';
import { problemLink } from '../../../../../../../../utils/problem.js';
import ExpandTransition from '../../../../../../../components/transitions/ExpandTransition/ExpandTransition.vue';
import RatingSource from '../../parts/RatingSource/RatingSource.vue';
import { grays } from '../../../utils/grays.js';
import { ratingPaint } from '../../../utils/rating-paint.js';
import { useFold } from '../../../composables/fold.js';

const props = defineProps({
  // [{ key, tries, rating }]，难度从高到低，见统计模块的 unsolvedProblems。
  problems: { type: Array, required: true },
  // 题号 → 题目名称。
  nameOf: { type: Function, required: true },
});

// 折叠时只列难度最高的一部分，其余展开后可见。
const COLLAPSED = 10;
const expanded = useFold();
// 每一行要显示的内容。有难度分的按所在档位着色，没有的用中性的灰色并标 N/A。
const rows = computed(() => {
  const ink = grays();
  return props.problems.map((problem) => {
    const paint =
      problem.rating === null
        ? { text: ink.label, tint: ink.faint, edge: ink.line }
        : ratingPaint(bucketRating(problem.rating));
    return {
      key: problem.key,
      name: props.nameOf(problem.key),
      href: problemLink(problem.key),
      rating: problem.rating === null ? 'N/A' : String(problem.rating),
      tries: t('analyticsUnsolvedTries', problem.tries),
      style: {
        '--cf-unsolved-ink': paint.text,
        '--cf-unsolved-tint': paint.tint,
        '--cf-unsolved-edge': paint.edge,
      },
    };
  });
});
const head = computed(() => rows.value.slice(0, COLLAPSED));
const rest = computed(() => rows.value.slice(COLLAPSED));
</script>

<template>
  <section class="cf-analytics-card">
    <header class="cf-analytics-card-head">
      <h4>
        <span data-cf-language-text>{{ t('analyticsUnsolvedTitle') }}</span>
      </h4>
      <div class="cf-analytics-card-tools">
        <RatingSource />
        <Transition name="cf-analytics-swap" mode="out-in">
          <span :key="problems.length" class="cf-analytics-source" data-cf-language-text>{{
            t('analyticsUnsolvedCount', problems.length)
          }}</span>
        </Transition>
      </div>
    </header>
    <p v-if="!rows.length" class="cf-analytics-card-empty">
      <span data-cf-language-text>{{ t('analyticsUnsolvedEmpty') }}</span>
    </p>
    <template v-else>
      <!-- 每道题一行：题号、名称、尝试次数、难度分。整行是指向题目页的链接。
           两段列表放在一个纵向弹性容器里：收放过渡靠负的下外边距抵掉间隔，这一招在网格布局里不生效。 -->
      <div class="cf-analytics-unsolved-lists">
        <ul class="cf-analytics-unsolved">
          <li v-for="row in head" :key="row.key">
            <a :href="row.href" target="_blank" rel="noopener noreferrer" :style="row.style">
              <b>{{ row.key }}</b>
              <span class="cf-analytics-unsolved-name">{{ row.name }}</span>
              <span class="cf-analytics-unsolved-tries" data-cf-language-text>{{ row.tries }}</span>
              <i>{{ row.rating }}</i>
            </a>
          </li>
        </ul>
        <!-- 其余的题收在下面，展开和收起带高度过渡。 -->
        <ExpandTransition v-if="rest.length" :show="expanded">
          <ul class="cf-analytics-unsolved">
            <li v-for="row in rest" :key="row.key">
              <a :href="row.href" target="_blank" rel="noopener noreferrer" :style="row.style">
                <b>{{ row.key }}</b>
                <span class="cf-analytics-unsolved-name">{{ row.name }}</span>
                <span class="cf-analytics-unsolved-tries" data-cf-language-text>{{
                  row.tries
                }}</span>
                <i>{{ row.rating }}</i>
              </a>
            </li>
          </ul>
        </ExpandTransition>
      </div>
      <div v-if="rest.length" class="cf-analytics-more-row">
        <button
          type="button"
          class="cf-analytics-more"
          :class="{ 'is-open': expanded }"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        >
          <Transition name="cf-analytics-swap" mode="out-in">
            <span :key="expanded" data-cf-language-text>{{
              expanded ? t('analyticsTagsLess') : t('analyticsUnsolvedMore', rows.length)
            }}</span>
          </Transition>
          <svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg>
        </button>
      </div>
    </template>
  </section>
</template>

<style>
/* 宽的时候分成两列，窄的时候一列：先排满左列再排右列，难度从高到低顺着读下来。
   两列中间有一条浅浅的分隔线，免得左列末尾的难度分和右列开头的题号挨在一起分不清。 */
.cf-analytics-unsolved {
  columns: 300px 2;
  column-gap: 29px;
  column-rule: 1px solid var(--cf-gray-200);
  margin: 0;
  padding: 0;
  list-style: none;
}
/* 行距写在每一行的下边距里：两段列表首尾相接，中间的分隔线才连得上。 */
.cf-analytics-unsolved li {
  break-inside: avoid;
  min-width: 0;
  margin: 0;
  padding: 0 0 4px;
}
.cf-analytics-unsolved-lists {
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin-bottom: -4px;
}
/* 每一行本身就是一枚按难度档位着色的标签：浅底、细边。
   链接的颜色显式写出，不受原站 a:link / a:visited 的影响。 */
.cf-analytics .cf-analytics-unsolved a:is(:link, :visited) {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto 38px;
  align-items: center;
  gap: 8px;
  padding: 3px 8px;
  border: 1px solid var(--cf-unsolved-edge);
  border-radius: var(--cf-radius-sm);
  background: var(--cf-unsolved-tint);
  color: var(--cf-gray-600);
  font-size: var(--cf-font-size-base);
  line-height: 18px;
  text-decoration: none;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}
/* 悬停时加深：底色往边线色靠，边线换成这一档的文字色，题目名称也深一级。 */
.cf-analytics .cf-analytics-unsolved a:is(:hover, :focus-visible) {
  border-color: var(--cf-unsolved-ink);
  background: color-mix(in srgb, var(--cf-unsolved-edge) 38%, var(--cf-unsolved-tint));
  color: var(--cf-gray-800);
  outline: none;
}
.cf-analytics-unsolved :is(b, i) {
  color: var(--cf-unsolved-ink);
  font-style: normal;
  font-weight: var(--cf-font-weight-semibold);
  font-variant-numeric: tabular-nums;
  transition: color 0.3s ease;
}
.cf-analytics-unsolved i {
  text-align: right;
}
.cf-analytics-unsolved-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cf-analytics-unsolved-tries {
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-xs);
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  .cf-analytics .cf-analytics-unsolved a:is(:link, :visited),
  .cf-analytics-unsolved :is(b, i) {
    transition: none;
  }
}
</style>
