<script setup>
import { ref } from 'vue';
import { translate as t } from '../../../../../../../../i18n/index.js';
import { rankForRating } from '../../../../../../../../features/contest/rating-prediction/algorithm/ranks.js';
import { HISTORY } from '../../../../../../../../features/user/analytics/rating-history.js';
import ExpandTransition from '../../../../../../../components/transitions/ExpandTransition/ExpandTransition.vue';
import ChartHint from '../../parts/ChartHint/ChartHint.vue';
import { COMPARE_MAX } from '../../../composables/compare-accounts.js';
import { COMPARE_GRID } from '../../../composables/compare-chart.js';

// 对比曲线的卡片外壳：标题、对比中的账号名单（开头是添加账号的输入框和「和我对比」），下面是图表（默认插槽）和一行说明。
// 「评级曲线对比」和「参赛排名曲线对比」都用它；两张图的账号名单是同一份，在哪一张上增减都一样。
const props = defineProps({
  title: { type: String, required: true },
  // 对比中的账号名单，见 compareAccounts。
  accounts: { type: Object, required: true },
  // 标题后面的一句小字说明（比如这张图只含哪些比赛），可省略。
  note: { type: String, default: '' },
});

// 添加账号。输入不对时在输入框旁给一句提示；记的是文案的键，切换语言后跟着变。
const draft = ref('');
const notice = ref('');
function add() {
  if (!draft.value.trim()) return;
  notice.value = props.accounts.add(draft.value);
  if (!notice.value) draft.value = '';
}
// 把查看者自己的账号加进来。名单满了时和手动添加一样给一句提示。
function addSelf() {
  notice.value = props.accounts.add(props.accounts.self);
}
// 账号旁边标的当前评级，按档位着色。
function current(entry) {
  const rating = entry.history.rows.at(-1)[HISTORY.rating];
  return { rating, color: rankForRating(rating).color };
}
const STATUS_TEXT = {
  loading: 'analyticsCompareLoading',
  empty: 'analyticsCompareUnrated',
  missing: 'analyticsCompareMissing',
  failed: 'analyticsCompareFailed',
};
</script>

<template>
  <section class="cf-analytics-card">
    <header class="cf-analytics-card-head">
      <h4 class="cf-analytics-compare-head">
        <span data-cf-language-text>{{ title }}</span>
        <span v-if="note" class="cf-analytics-card-note" data-cf-language-text>{{ note }}</span>
      </h4>
      <!-- 各张图自己的控件（比如按比赛的类别筛选）。 -->
      <div v-if="$slots.tools" class="cf-analytics-card-tools">
        <slot name="tools" />
      </div>
    </header>
    <!-- 增减账号的几样东西都在这一行。最左边是添加账号的输入框，位置固定，不会被新加进来的账号推走；
         接着是「和我对比」的按钮，自己的账号还不在名单里时才有，加进来之后它就收起；
         后面是对比中的账号：颜色、账号名、当前评级，主页的账号以外都可以移除。 -->
    <TransitionGroup tag="ul" name="cf-analytics-chip" class="cf-analytics-compare-list">
      <li key="+add">
        <span class="cf-analytics-compare-add">
          <input
            v-model="draft"
            type="text"
            maxlength="24"
            spellcheck="false"
            autocomplete="off"
            :placeholder="t('analyticsComparePlaceholder')"
            :aria-label="t('analyticsComparePlaceholder')"
            @input="notice = ''"
            @keydown.enter.prevent="add"
          />
          <button type="button" :disabled="!draft.trim()" @click="add">
            <span data-cf-language-text>{{ t('analyticsCompareAdd') }}</span>
          </button>
        </span>
      </li>
      <li v-if="accounts.self" key="+self" class="cf-analytics-compare-self">
        <button type="button" @click="addSelf">
          <svg viewBox="0 0 8 8" aria-hidden="true"><path d="M4 1v6M1 4h6" /></svg>
          <span data-cf-language-text>{{ t('analyticsCompareSelf') }}</span>
        </button>
      </li>
      <li
        v-for="entry in accounts.entries"
        :key="entry.id"
        class="cf-analytics-compare-chip"
        :class="`is-${entry.status}`"
        :style="{ '--cf-compare-color': entry.color }"
      >
        <i aria-hidden="true"></i>
        <span class="cf-analytics-compare-name">{{ entry.handle }}</span>
        <b v-if="entry.status === 'ready'" :style="{ color: current(entry).color }">{{
          current(entry).rating
        }}</b>
        <button
          v-else-if="entry.status === 'failed'"
          type="button"
          class="cf-analytics-compare-retry"
          @click="accounts.load(entry, true)"
        >
          <span data-cf-language-text>{{ t('analyticsCompareFailed') }}</span>
        </button>
        <span v-else class="cf-analytics-compare-state" data-cf-language-text>{{
          t(STATUS_TEXT[entry.status])
        }}</span>
        <button
          v-if="!entry.fixed"
          type="button"
          class="cf-analytics-compare-remove"
          :aria-label="t('analyticsCompareRemove', entry.handle)"
          @click="accounts.remove(entry)"
        >
          <svg viewBox="0 0 8 8" aria-hidden="true"><path d="M1 1l6 6M7 1 1 7" /></svg>
        </button>
      </li>
      <!-- 输入不对时的一句提示，排在这一行的最后，不把别的东西推开。 -->
      <!-- 换成另一句提示时算作换了一项：旧的淡出，新的淡入。 -->
      <li v-if="notice" :key="`+notice-${notice}`" class="cf-analytics-card-note" role="status">
        <span data-cf-language-text>{{ t(notice, COMPARE_MAX) }}</span>
      </li>
    </TransitionGroup>
    <!-- 一条线都画不出来时图表收起，只留上面的名单。 -->
    <ExpandTransition :show="accounts.drawn.length > 0">
      <div class="cf-analytics-compare-body">
        <slot />
        <!-- 说明从纵轴的位置起，和绘图区的左边缘对齐。 -->
        <ChartHint :inset="COMPARE_GRID.left">{{ t('analyticsComparePinHint') }}</ChartHint>
      </div>
    </ExpandTransition>
  </section>
</template>

<style>
.cf-analytics-compare-chart {
  height: 258px;
}
/* 图表和它下面的一行说明，随图表一起收放。 */
.cf-analytics-compare-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}
/* 标题后面的一句小字说明，和标题的基线对齐。 */
.cf-analytics-card-head h4.cf-analytics-compare-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.cf-analytics-compare-head .cf-analytics-card-note {
  font-weight: normal;
}
/* 名单末尾的提示和账号的牌子一样高，文字上下居中。 */
.cf-analytics-compare-list > .cf-analytics-card-note {
  line-height: 22px;
}
/* 添加账号：一个小输入框和一个按钮连在一起。 */
.cf-analytics-compare-add {
  display: inline-flex;
  align-items: stretch;
}
.cf-analytics-compare-add input {
  width: 118px;
  margin: 0;
  padding: 1px 8px;
  border: 1px solid color-mix(in srgb, var(--cf-analytics-accent) 26%, #dfe4ec);
  border-right: 0;
  border-radius: var(--cf-radius-sm) 0 0 var(--cf-radius-sm);
  background: #fff;
  color: var(--cf-gray-700);
  font: inherit;
  font-size: var(--cf-font-size-xs);
  line-height: 18px;
  box-sizing: border-box;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}
.cf-analytics-compare-add input::placeholder {
  color: var(--cf-gray-400);
}
.cf-analytics-compare-add input:focus {
  border-color: color-mix(in srgb, var(--cf-analytics-accent) 65%, #dfe4ec);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--cf-analytics-accent) 16%, transparent);
}
.cf-analytics-compare-add button {
  margin: 0;
  padding: 1px 10px;
  border: 1px solid color-mix(in srgb, var(--cf-analytics-accent) 30%, #dfe4ec);
  border-radius: 0 var(--cf-radius-sm) var(--cf-radius-sm) 0;
  background: color-mix(in srgb, var(--cf-analytics-accent) 9%, #fff);
  color: var(--cf-analytics-ink);
  font: inherit;
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-semibold);
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    opacity 0.16s ease;
}
.cf-analytics-compare-add button:enabled:hover {
  border-color: color-mix(in srgb, var(--cf-analytics-accent) 60%, #dfe4ec);
  background: color-mix(in srgb, var(--cf-analytics-accent) 18%, #fff);
}
.cf-analytics-compare-add button:disabled {
  opacity: 0.5;
  cursor: default;
}
.cf-analytics-compare-add button:focus-visible,
.cf-analytics-compare-self button:focus-visible,
.cf-analytics-compare-chip button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--cf-analytics-accent) 55%, transparent);
  outline-offset: 1px;
}
/* 对比中的账号排成一行，放不下就换行。 */
.cf-analytics-compare-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* 每个账号一个小牌子：左边一个和线同色的圆点，颜色取这条线的颜色。 */
.cf-analytics-compare-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 1px 6px 1px 8px;
  border: 1px solid color-mix(in srgb, var(--cf-compare-color) 34%, #e6e9ef);
  border-radius: 999px;
  background: color-mix(in srgb, var(--cf-compare-color) 7%, #fff);
  color: var(--cf-gray-700);
  font-size: var(--cf-font-size-xs);
  line-height: 18px;
  white-space: nowrap;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    opacity 0.2s ease;
}
.cf-analytics-compare-chip > i {
  width: 8px;
  height: 8px;
  border: 2px solid var(--cf-compare-color);
  border-radius: 50%;
  background: #fff;
  box-sizing: border-box;
}
.cf-analytics-compare-name {
  font-weight: var(--cf-font-weight-semibold);
}
.cf-analytics-compare-chip > b {
  font-weight: var(--cf-font-weight-bold);
  font-variant-numeric: tabular-nums;
}
/* 还没有线可画的账号（正在取、没有评级记录、没取到）整体淡一些。 */
.cf-analytics-compare-chip:not(.is-ready) {
  border-style: dashed;
}
.cf-analytics-compare-state {
  color: var(--cf-gray-400);
}
.cf-analytics-compare-chip.is-loading .cf-analytics-compare-state {
  animation: cf-analytics-compare-wait 1.2s ease-in-out infinite;
}
.cf-analytics-compare-retry {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: #a8433a;
  font: inherit;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, currentColor 35%, transparent);
  text-underline-offset: 2px;
  cursor: pointer;
}
.cf-analytics-compare-remove {
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--cf-gray-400);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}
.cf-analytics-compare-remove svg {
  width: 8px;
  height: 8px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
}
.cf-analytics-compare-remove:hover {
  background: color-mix(in srgb, var(--cf-compare-color) 22%, #fff);
  color: var(--cf-gray-800);
}
/* 「和我对比」：和账号的牌子一样大的一个虚线按钮，排在名单的末尾。 */
.cf-analytics-compare-self {
  display: inline-flex;
}
.cf-analytics-compare-self button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  padding: 1px 9px 1px 7px;
  border: 1px dashed color-mix(in srgb, var(--cf-analytics-accent) 50%, #dfe4ec);
  border-radius: 999px;
  background: transparent;
  color: var(--cf-analytics-ink);
  font: inherit;
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-semibold);
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease;
}
.cf-analytics-compare-self button:hover {
  border-color: color-mix(in srgb, var(--cf-analytics-accent) 75%, #dfe4ec);
  background: color-mix(in srgb, var(--cf-analytics-accent) 12%, #fff);
}
.cf-analytics-compare-self svg {
  width: 8px;
  height: 8px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
}
/* 账号加进来和移除时，牌子淡入淡出并略微缩放，其余的牌子滑到新位置。 */
.cf-analytics-chip-enter-active,
.cf-analytics-chip-leave-active,
.cf-analytics-chip-move {
  transition:
    opacity 0.22s ease,
    transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}
.cf-analytics-chip-enter-from,
.cf-analytics-chip-leave-to {
  opacity: 0;
  transform: scale(0.86);
}
.cf-analytics-chip-leave-active {
  position: absolute;
}
@keyframes cf-analytics-compare-wait {
  50% {
    opacity: 0.45;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cf-analytics-compare-add input,
  .cf-analytics-compare-add button,
  .cf-analytics-compare-chip,
  .cf-analytics-compare-self button,
  .cf-analytics-compare-remove,
  .cf-analytics-chip-enter-active,
  .cf-analytics-chip-leave-active,
  .cf-analytics-chip-move {
    transition: none;
  }
  .cf-analytics-compare-chip.is-loading .cf-analytics-compare-state {
    animation: none;
  }
}
</style>
