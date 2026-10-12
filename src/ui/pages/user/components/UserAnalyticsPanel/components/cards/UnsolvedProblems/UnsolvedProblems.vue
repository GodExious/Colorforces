<script setup>
import { computed, ref, watch } from 'vue';
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

/*
 * 列表变了之后的过渡。难度分换来源（比如开关 CList 难度分）时，每道题的分数、颜色都可能变，整张列表按新分数重排：
 * 行从原来的位置滑到新位置，颜色从原来的渐变成新的，分数淡入；原来看不见、现在排进来的行淡入，
 * 现在看不见了的行在原地淡出。
 * 颜色不能只靠样式里的过渡：重排时浏览器会把挪了位置的节点先摘下来再放回去，放回去的节点没有「之前的颜色」，
 * 样式过渡不会启动。所以这里记下变之前的颜色，变完之后自己从旧颜色过渡到新颜色。
 * 两段列表（前十道和其余的）是两个容器，行换了容器就是新节点，也靠同一份「题号 → 原来的位置」接上。
 */
const lists = ref(null);
const MOVE = { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' };
const TINT = { duration: 300, easing: 'ease' };
const still = () => document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches;
const onScreen = (rect) => rect.bottom > 0 && rect.top < window.innerHeight;
// 页面上现在看得见的各行（收着的那一段不算）。
function shownRows(root) {
  return [...root.querySelectorAll('li[data-unsolved]')].filter(
    (item) => expanded.value || !item.closest('.cf-expand-region'),
  );
}
let pending = null;
// 界面更新之前：记下各行的位置；更新之后就看不见了的行，先复制一份留着淡出。
watch(rows, (next, previous) => {
  pending = null;
  const root = lists.value;
  if (!root || still()) return;
  const staying = new Set((expanded.value ? next : next.slice(0, COLLAPSED)).map((row) => row.key));
  const origin = root.getBoundingClientRect();
  const before = new Map();
  const leaving = [];
  for (const item of shownRows(root)) {
    const rect = item.getBoundingClientRect();
    if (!rect.height) continue;
    before.set(item.dataset.unsolved, rect);
    if (!staying.has(item.dataset.unsolved) && onScreen(rect))
      leaving.push({
        node: item.cloneNode(true),
        left: rect.left - origin.left,
        top: rect.top - origin.top,
        width: rect.width,
      });
  }
  pending = { before, leaving, paints: new Map((previous || []).map((row) => [row.key, row])) };
});
// 界面更新之后：从原来的位置、原来的颜色过渡过来。
watch(
  rows,
  (next) => {
    const job = pending;
    pending = null;
    const root = lists.value;
    if (!job || !root) return;
    const now = new Map(next.map((row) => [row.key, row]));
    for (const item of shownRows(root)) {
      const rect = item.getBoundingClientRect();
      if (!rect.height) continue;
      const key = item.dataset.unsolved;
      const was = job.before.get(key);
      if (!was) {
        if (onScreen(rect)) item.animate([{ opacity: 0 }, { opacity: 1 }], TINT);
        continue;
      }
      // 变之前和变之后都在窗口外面的行不用动。
      if (!onScreen(rect) && !onScreen(was)) continue;
      const dx = was.left - rect.left;
      const dy = was.top - rect.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)
        item.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], MOVE);
      const old = job.paints.get(key);
      const row = now.get(key);
      const link = item.firstElementChild;
      if (!old || !row || !link) continue;
      const from = old.style;
      const to = row.style;
      if (from['--cf-unsolved-tint'] !== to['--cf-unsolved-tint'])
        link.animate(
          [
            {
              backgroundColor: from['--cf-unsolved-tint'],
              borderColor: from['--cf-unsolved-edge'],
            },
            { backgroundColor: to['--cf-unsolved-tint'], borderColor: to['--cf-unsolved-edge'] },
          ],
          TINT,
        );
      if (from['--cf-unsolved-ink'] !== to['--cf-unsolved-ink'])
        for (const mark of link.querySelectorAll('b, i'))
          mark.animate(
            [{ color: from['--cf-unsolved-ink'] }, { color: to['--cf-unsolved-ink'] }],
            TINT,
          );
      if (old.rating !== row.rating)
        link.querySelector('i')?.animate([{ opacity: 0 }, { opacity: 1 }], TINT);
    }
    if (!job.leaving.length) return;
    // 淡出的那几行放在盖在列表上的一层里，各自留在原来的位置。
    const layer = document.createElement('ul');
    layer.className = 'cf-analytics-unsolved cf-analytics-unsolved-ghosts';
    layer.setAttribute('aria-hidden', 'true');
    for (const ghost of job.leaving) {
      ghost.node.removeAttribute('data-unsolved');
      Object.assign(ghost.node.style, {
        left: ghost.left + 'px',
        top: ghost.top + 'px',
        width: ghost.width + 'px',
      });
      layer.append(ghost.node);
    }
    root.append(layer);
    layer
      .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-in' })
      .finished.catch(() => {})
      .then(() => layer.remove());
  },
  { flush: 'post' },
);
</script>

<template>
  <section class="cf-analytics-card">
    <header class="cf-analytics-card-head">
      <h4>
        <span>{{ t('analyticsUnsolvedTitle') }}</span>
      </h4>
      <div class="cf-analytics-card-tools">
        <RatingSource />
        <Transition name="cf-analytics-swap" mode="out-in">
          <span :key="problems.length" class="cf-analytics-source">{{
            t('analyticsUnsolvedCount', problems.length)
          }}</span>
        </Transition>
      </div>
    </header>
    <p v-if="!rows.length" class="cf-analytics-card-empty">
      <span>{{ t('analyticsUnsolvedEmpty') }}</span>
    </p>
    <template v-else>
      <!-- 每道题一行：题号、名称、尝试次数、难度分。整行是指向题目页的链接。
           两段列表放在一个纵向弹性容器里：收放过渡靠负的下外边距抵掉间隔，这一招在网格布局里不生效。 -->
      <div ref="lists" class="cf-analytics-unsolved-lists">
        <ul class="cf-analytics-unsolved">
          <li v-for="row in head" :key="row.key" :data-unsolved="row.key">
            <a :href="row.href" target="_blank" rel="noopener noreferrer" :style="row.style">
              <b>{{ row.key }}</b>
              <span class="cf-analytics-unsolved-name">{{ row.name }}</span>
              <span class="cf-analytics-unsolved-tries">{{ row.tries }}</span>
              <i>{{ row.rating }}</i>
            </a>
          </li>
        </ul>
        <!-- 其余的题收在下面，展开和收起带高度过渡。 -->
        <ExpandTransition v-if="rest.length" :show="expanded">
          <ul class="cf-analytics-unsolved">
            <li v-for="row in rest" :key="row.key" :data-unsolved="row.key">
              <a :href="row.href" target="_blank" rel="noopener noreferrer" :style="row.style">
                <b>{{ row.key }}</b>
                <span class="cf-analytics-unsolved-name">{{ row.name }}</span>
                <span class="cf-analytics-unsolved-tries">{{ row.tries }}</span>
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
            <span :key="expanded">{{
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
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin-bottom: -4px;
}
/* 重排时淡出的那几行：盖在列表上的一层，不分栏，每一行按原来的位置摆。 */
.cf-analytics-unsolved.cf-analytics-unsolved-ghosts {
  position: absolute;
  inset: 0;
  columns: auto;
  pointer-events: none;
}
.cf-analytics-unsolved-ghosts li {
  position: absolute;
  box-sizing: border-box;
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
    background-color var(--cf-duration-base) ease,
    border-color var(--cf-duration-base) ease,
    color var(--cf-duration-base) ease;
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
  transition: color var(--cf-duration-slow) ease;
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
