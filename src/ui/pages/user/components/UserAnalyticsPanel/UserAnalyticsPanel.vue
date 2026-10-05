<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { appSettings } from '../../../../../settings.js';
import { translate as t } from '../../../../../i18n/index.js';
import * as assets from '../../../../../assets/index.js';
import { utcOffsetLabel } from '../../../../../utils/time.js';
import { USER_STATUS_CACHE } from '../../../../../config/cache-policy.js';
import InlineSvg from '../../../../components/icons/InlineSvg/InlineSvg.vue';
import ExpandTransition from '../../../../components/transitions/ExpandTransition/ExpandTransition.vue';
import { analyticsState as state } from '../../../../../features/user/analytics/state.js';
import { loadAnalytics, setStreakZone } from '../../../../../features/user/analytics/index.js';
import {
  collectProblems,
  localDay,
  zoneDay,
  summarize,
  ratingDistribution,
  tagDistribution,
  tagTotals,
  solvedByDay,
  monthlyActivity,
  recentAverage,
  unsolvedProblems,
  languageDistribution,
  verdictDistribution,
  attemptsDistribution,
  participationDistribution,
  contestSpeed,
  hourlyActivity,
  localHour,
  zoneHour,
  localMonth,
  zoneMonth,
  spanStart,
  tagWeakness,
} from '../../../../../features/user/analytics/stats.js';
import { languageFamily } from '../../../../../features/user/analytics/languages.js';
import {
  createRatingLookup,
  createCanonicalLookup,
  problemInfo,
  problemsetKeys,
} from '../../../../../features/user/analytics/ratings.js';
import AnalyticsProgress from './components/parts/AnalyticsProgress/AnalyticsProgress.vue';
import ThemeNotice from './components/parts/ThemeNotice/ThemeNotice.vue';
import AnalyticsSummary from './components/cards/AnalyticsSummary/AnalyticsSummary.vue';
import RatingDistribution from './components/cards/RatingDistribution/RatingDistribution.vue';
import TagDistribution from './components/cards/TagDistribution/TagDistribution.vue';
import RatingHeatmap from './components/cards/RatingHeatmap/RatingHeatmap.vue';
import MonthlyActivity from './components/cards/MonthlyActivity/MonthlyActivity.vue';
import RecentCount from './components/cards/RecentCount/RecentCount.vue';
import RecentDays from './components/cards/RecentDays/RecentDays.vue';
import UnsolvedProblems from './components/cards/UnsolvedProblems/UnsolvedProblems.vue';
import HourlyActivity from './components/cards/HourlyActivity/HourlyActivity.vue';
import RatingCompare from './components/cards/RatingCompare/RatingCompare.vue';
import RankCompare from './components/cards/RankCompare/RankCompare.vue';
import { useCompareAccounts } from './composables/compare-accounts.js';
import { usesClist } from './composables/rating-source.js';
import TagWeakness from './components/cards/TagWeakness/TagWeakness.vue';
import AttemptsDistribution from './components/cards/AttemptsDistribution/AttemptsDistribution.vue';
import VerdictDistribution from './components/cards/VerdictDistribution/VerdictDistribution.vue';
import ContestSpeed from './components/cards/ContestSpeed/ContestSpeed.vue';
import ParticipationDistribution from './components/cards/ParticipationDistribution/ParticipationDistribution.vue';
import LanguageDistribution from './components/cards/LanguageDistribution/LanguageDistribution.vue';

const charts = computed(() => appSettings.user.analytics.charts);
// 划分日期用的时区：「最长连续」、难度热力图、月度活跃度和刷题作息共用，这几处的时区选择改的都是它。
// 没有单独设置时按查看者自己的时区划分。
const dayOf = computed(() => (state.streakZone === null ? localDay : zoneDay(state.streakZone)));
const hourOf = computed(() => (state.streakZone === null ? localHour : zoneHour(state.streakZone)));
const monthOf = computed(() =>
  state.streakZone === null ? localMonth : zoneMonth(state.streakZone),
);
// 逐题汇总只依赖数据集、「计入队伍提交」和划分日期用的时区；切换难度分来源时不必重算。
const collected = computed(() =>
  state.dataset
    ? collectProblems(state.dataset, {
        includeTeams: appSettings.user.analytics.includeTeams,
        dayOf: dayOf.value,
      })
    : null,
);
// 难度分查询与题库题号。同一道题会被摘要和分布各查一次，所以把结果记下来。
const context = computed(() => {
  if (!state.dataset) return null;
  // 读一下 usesClist，让来源开关或 CList 开关变化时重建查询。
  void usesClist.value;
  // 两种查询都记住结果：同一个题号会被摘要和分布各查一次，每个题号只真正算一次。
  const remember = (lookup) => {
    const results = new Map();
    return (key) => {
      if (!results.has(key)) results.set(key, lookup(key));
      return results.get(key);
    };
  };
  return {
    ratingOf: remember(
      createRatingLookup(state.dataset, appSettings.user.analytics.followRatingSource),
    ),
    problemset: problemsetKeys(),
    canonical: remember(createCanonicalLookup(state.dataset)),
  };
});
const summary = computed(() => summarize(collected.value, context.value));
const ratings = computed(() => ratingDistribution(collected.value, context.value));
const tagsOf = (key) => problemInfo(state.dataset, key).tags;
// 题库里每个标签各有多少题。只跟题库有关，切换队伍提交、时区之类的开关时不必重算。
const tagCounts = computed(() => tagTotals(context.value.problemset, tagsOf));
const tags = computed(() =>
  tagDistribution(collected.value, {
    tagsOf,
    problemset: context.value.problemset,
    canonical: context.value.canonical,
    totals: tagCounts.value,
  }),
);
// 热力图、月度活跃度、刷题作息和「最长连续」按同一个时区。
const heatmapDays = computed(() =>
  solvedByDay(collected.value, { ratingOf: context.value.ratingOf, dayOf: dayOf.value }),
);
const months = computed(() =>
  monthlyActivity(state.dataset, collected.value, {
    includeTeams: appSettings.user.analytics.includeTeams,
    monthOf: monthOf.value,
  }),
);
// 近期平均难度有两张图：一张按最近若干题取，一张按最近一段时间取；
// 这段时间和刷题作息一样截止到数据刷新的那一刻。
const recent = computed(() =>
  recentAverage(collected.value, {
    ratingOf: context.value.ratingOf,
    count: appSettings.user.analytics.recentCount,
  }),
);
const recentDays = computed(() =>
  recentAverage(collected.value, {
    ratingOf: context.value.ratingOf,
    since: spanStart(appSettings.user.analytics.recentSpan, state.dataset.fetchedAt),
  }),
);
const unsolved = computed(() =>
  unsolvedProblems(collected.value, { ratingOf: context.value.ratingOf }),
);
const nameOf = (key) => problemInfo(state.dataset, key).name;
// 下面几项直接按提交记录数，只跟数据集和「计入队伍提交」有关。
const teams = computed(() => ({ includeTeams: appSettings.user.analytics.includeTeams }));
// 刷题作息可以只看最近一段时间，这段时间截止到数据刷新的那一刻。
const hours = computed(() =>
  hourlyActivity(state.dataset, {
    ...teams.value,
    hourOf: hourOf.value,
    since: spanStart(appSettings.user.analytics.hoursSpan, state.dataset.fetchedAt),
  }),
);
const verdicts = computed(() => verdictDistribution(state.dataset, teams.value));
const speed = computed(() => contestSpeed(state.dataset, teams.value));
const types = computed(() => participationDistribution(state.dataset, teams.value));
const languages = computed(() =>
  languageDistribution(state.dataset, { ...teams.value, familyOf: languageFamily }),
);
const attempts = computed(() => attemptsDistribution(collected.value));
// 标签弱项只统计通过题数达到这个数的标签。
const WEAKNESS_MIN_SOLVED = 5;
const weakness = computed(() =>
  tagWeakness(collected.value, { tagsOf, minSolved: WEAKNESS_MIN_SOLVED }),
);

// 评级曲线对比和参赛排名曲线对比共用一份账号名单；两张图里有一张开着、面板里又有数据可画时才去取评级历史。
const compared = useCompareAccounts({
  handle: () => state.handle,
  active: () =>
    Boolean(collected.value?.submissions) && (charts.value.compare || charts.value.compareRank),
  refreshedAt: () => state.dataset?.fetchedAt ?? 0,
});

// 数据缓存多少分钟。过了这个时间再打开主页会自动重新获取，刷新按钮的悬停提示里写出这个数。
const cacheMinutes = Math.round(USER_STATUS_CACHE / 60000);

// 「几分钟前」每半分钟更新一次。
const now = ref(Date.now());
let timer;
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 30000);
});
onBeforeUnmount(() => clearInterval(timer));
const pad = (value) => String(value).padStart(2, '0');
const updated = computed(() => {
  if (!state.dataset) return null;
  // 缓存里存的是时间戳，这里按本地时区写出完整的日期和时间；时区单独给出，显示成右上角的小标。
  const date = new Date(state.dataset.fetchedAt);
  const time =
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  const minutes = Math.max(0, Math.floor((now.value - state.dataset.fetchedAt) / 60000));
  const ago =
    minutes < 1
      ? t('analyticsAgoNow')
      : minutes < 60
        ? t('analyticsAgoMinutes', minutes)
        : minutes < 1440
          ? t('analyticsAgoHours', Math.floor(minutes / 60))
          : t('analyticsAgoDays', Math.floor(minutes / 1440));
  return { time, zone: utcOffsetLabel(-date.getTimezoneOffset()), ago };
});
// 出错提示收起的过程中仍要显示原来的文字，所以记住最近一次的错误。
const lastError = ref({ code: '', comment: '' });
watch(
  () => state.error,
  (code) => {
    if (code) lastError.value = { code, comment: state.errorComment };
  },
);
const errorText = computed(() =>
  lastError.value.code === 'api'
    ? t('analyticsErrorApi', lastError.value.comment)
    : t(lastError.value.code === 'timeout' ? 'analyticsErrorTimeout' : 'analyticsErrorNetwork'),
);
// 用鼠标点过的按钮不留焦点。否则之后一按键盘（比如用 Shift 开头的快捷键），
// 浏览器会认为在用键盘操作，给还握着焦点的那个按钮画出焦点框。
// 用键盘按下的按钮（点击次数为 0）不处理，Tab 键操作时焦点框照常显示。
function releasePointerFocus(event) {
  if (event.detail > 0) event.target.closest?.('button')?.blur();
}
// 切换语言时，面板里的文字从左到右重新展开，和菜单里的效果一致。
const panel = ref(null);
watch(
  () => appSettings.general.lang,
  () => {
    if (!panel.value || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const element of panel.value.querySelectorAll('[data-cf-language-text]')) {
      if (!element.getClientRects().length) continue;
      element.animate(
        [{ clipPath: 'inset(-0.2em 100% -0.2em 0)' }, { clipPath: 'inset(-0.2em 0% -0.2em 0)' }],
        { duration: 280, easing: 'cubic-bezier(.22,1,.36,1)' },
      );
    }
  },
  { flush: 'post' },
);
</script>

<template>
  <Teleport v-if="state.host" :to="state.host">
    <!-- 每一块的出现与消失都用收放过渡：总开关、加载状态的切换、各图表的开关。 -->
    <ExpandTransition :show="state.active">
      <section
        ref="panel"
        class="cf-analytics"
        :lang="appSettings.general.lang"
        @click="releasePointerFocus"
      >
        <header class="cf-analytics-header">
          <div class="cf-analytics-brand">
            <span class="cf-analytics-logo" aria-hidden="true">
              <InlineSvg
                :source="assets.colorforcesMark"
                layer="cf-launcher-flower"
                id-prefix="cf-analytics-logo"
              />
            </span>
            <h3 class="cf-analytics-title">
              <span data-cf-language-text>{{ t('analyticsTitle') }}</span>
            </h3>
            <!-- 头像和用户名取自主页本身：用户名沿用原站按评级着色的样式。 -->
            <span class="cf-analytics-user">
              <img v-if="state.avatar" class="cf-analytics-avatar" :src="state.avatar" alt="" />
              <span class="cf-analytics-username" :class="state.rankClass">{{
                state.profileName || state.handle
              }}</span>
            </span>
          </div>
          <Transition name="cf-analytics-swap">
            <div v-if="state.dataset" class="cf-analytics-meta">
              <span class="cf-analytics-updated" data-cf-language-text
                >{{ t('analyticsUpdatedLabel') }}{{ updated.time
                }}<sup class="cf-analytics-zone">{{ updated.zone }}</sup
                >{{ t('analyticsUpdatedAgo', updated.ago) }}</span
              >
              <button
                type="button"
                class="cf-analytics-refresh"
                :data-tooltip="t('analyticsRefreshHint', cacheMinutes)"
                :disabled="state.loading"
                @click="loadAnalytics({ force: true })"
              >
                <InlineSvg :source="assets.syncIcon" />
                <span data-cf-language-text>{{ t('analyticsRefresh') }}</span>
              </button>
            </div>
          </Transition>
        </header>

        <!-- 临时的提醒：不再适配其他插件的深色主题。主题功能上线后删掉。 -->
        <ThemeNotice />

        <ExpandTransition :show="!state.started">
          <div class="cf-analytics-start">
            <button type="button" class="cf-analytics-load" @click="loadAnalytics()">
              <span class="cf-analytics-load-flower" aria-hidden="true">
                <InlineSvg
                  :source="assets.colorforcesMark"
                  layer="cf-launcher-flower"
                  id-prefix="cf-analytics-load"
                />
              </span>
              <span data-cf-language-text>{{ t('analyticsLoadButton') }}</span>
            </button>
            <p class="cf-analytics-start-note">
              <span data-cf-language-text>{{ t('analyticsLoadNote') }}</span>
            </p>
          </div>
        </ExpandTransition>

        <ExpandTransition :show="state.loading">
          <AnalyticsProgress
            :active="state.loading"
            :stage="state.stage"
            :received="state.received"
            :queue-until="state.queueUntil"
            :updating="Boolean(state.dataset)"
          />
        </ExpandTransition>

        <ExpandTransition :show="Boolean(state.error)">
          <div class="cf-analytics-error" role="alert">
            <span data-cf-language-text>{{ errorText }}</span>
            <button type="button" class="cf-analytics-link" @click="loadAnalytics({ force: true })">
              <span data-cf-language-text>{{ t('analyticsRetry') }}</span>
            </button>
          </div>
        </ExpandTransition>

        <ExpandTransition :show="Boolean(state.dataset)">
          <div v-if="state.dataset" class="cf-analytics-body">
            <p v-if="!collected.submissions" class="cf-analytics-empty">
              <span data-cf-language-text>{{ t('analyticsEmpty') }}</span>
            </p>
            <template v-else>
              <ExpandTransition :show="charts.summary">
                <AnalyticsSummary
                  :summary="summary"
                  :zone="state.streakZone"
                  @zone="setStreakZone"
                />
              </ExpandTransition>
              <ExpandTransition :show="charts.heatmap">
                <RatingHeatmap
                  :days="heatmapDays"
                  :name-of="nameOf"
                  :zone="state.streakZone"
                  @zone="setStreakZone"
                />
              </ExpandTransition>
              <ExpandTransition :show="charts.activity">
                <MonthlyActivity :months="months" :zone="state.streakZone" @zone="setStreakZone" />
              </ExpandTransition>
              <ExpandTransition :show="charts.hours">
                <HourlyActivity :hours="hours" :zone="state.streakZone" @zone="setStreakZone" />
              </ExpandTransition>
              <ExpandTransition :show="charts.compare">
                <RatingCompare :accounts="compared" />
              </ExpandTransition>
              <ExpandTransition :show="charts.compareRank">
                <RankCompare :accounts="compared" />
              </ExpandTransition>
              <ExpandTransition :show="charts.ratings">
                <RatingDistribution :distribution="ratings" :clist="usesClist" />
              </ExpandTransition>
              <ExpandTransition :show="charts.tags">
                <TagDistribution :tags="tags" :solved="summary.solved" />
              </ExpandTransition>
              <ExpandTransition :show="charts.weakness">
                <TagWeakness :tags="weakness" :min-solved="WEAKNESS_MIN_SOLVED" />
              </ExpandTransition>
              <ExpandTransition :show="charts.recent">
                <RecentCount :trend="recent" :name-of="nameOf" />
              </ExpandTransition>
              <ExpandTransition :show="charts.recentDays">
                <RecentDays :trend="recentDays" :name-of="nameOf" />
              </ExpandTransition>
              <ExpandTransition :show="charts.attempts">
                <AttemptsDistribution :attempts="attempts" />
              </ExpandTransition>
              <ExpandTransition :show="charts.verdicts">
                <VerdictDistribution :verdicts="verdicts" />
              </ExpandTransition>
              <ExpandTransition :show="charts.speed">
                <ContestSpeed :buckets="speed" />
              </ExpandTransition>
              <ExpandTransition :show="charts.types">
                <ParticipationDistribution :types="types" />
              </ExpandTransition>
              <ExpandTransition :show="charts.languages">
                <LanguageDistribution :languages="languages" />
              </ExpandTransition>
              <ExpandTransition :show="charts.unsolved">
                <UnsolvedProblems :problems="unsolved" :name-of="nameOf" />
              </ExpandTransition>
            </template>
          </div>
        </ExpandTransition>
      </section>
    </ExpandTransition>
  </Teleport>
</template>

<style>
/*
 * 面板放在原站个人主页里，外框沿用原站圆角框的边线与圆角，内部自行设计。
 * 颜色集中写成变量，留给以后的主题功能接管。
 */
.cf-analytics {
  --cf-analytics-accent: #5b8fd6;
  --cf-analytics-ink: color-mix(in srgb, var(--cf-analytics-accent) 55%, #1f2d3d);
  /* 面板里用到的菜单控件（数字输入框）取菜单主色着色，这里让它跟面板的主色走。 */
  --cf-menu-accent: var(--cf-analytics-accent);
  --cf-analytics-surface: #fff;
  --cf-analytics-card-surface: #fcfdff;
  --cf-analytics-border: #b9b9b9;
  /* 纵向弹性布局：收放过渡靠负的下外边距抵掉间隔，网格布局里这一招不生效，收起后会再跳一下。 */
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 14px 0;
  padding: 14px 18px 18px;
  border: 1px solid var(--cf-analytics-border);
  border-radius: var(--cf-radius-sm);
  background: var(--cf-analytics-surface);
  color: var(--cf-gray-700);
  font-size: var(--cf-font-size-lg);
  line-height: 1.5;
  text-align: left;
  box-sizing: border-box;
}
/* 收放过渡的外层是网格项，允许它比内容窄，内部才能正常省略和换行。 */
.cf-analytics .cf-expand-region {
  min-width: 0;
}
/* 切换语言时文字用裁剪展开，行内元素要有自己的盒子才裁得动。 */
.cf-analytics span[data-cf-language-text] {
  display: inline-block;
}
/* 小块内容的出现、消失与替换：淡入淡出并略微位移。 */
.cf-analytics-swap-enter-active,
.cf-analytics-swap-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.cf-analytics-swap-enter-from,
.cf-analytics-swap-leave-to {
  opacity: 0;
  transform: translateY(3px);
}
/*
 * 标题栏排在绘制顺序的最后。刷新时标题栏里的图标一直在旋转，浏览器会把「排在旋转元素之后绘制」的内容
 * 也单独合成，文字随之换成较粗糙的抗锯齿，看起来发糊，转完才恢复。让标题栏最后绘制，下面的图表就不受影响。
 */
.cf-analytics-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
  min-height: 26px;
}
.cf-analytics-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.cf-analytics-logo,
.cf-analytics-load-flower {
  position: relative;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
}
/* 标志在这里是静态的：去掉入口按钮上的摇摆与呼吸。 */
.cf-analytics .cf-launcher-motion {
  animation: none;
  transform: none;
}
.cf-analytics .cf-launcher-flower {
  transition: none;
}
.cf-analytics-title {
  margin: 0;
  padding: 0;
  color: var(--cf-gray-800);
  font-size: 15px;
  font-weight: var(--cf-font-weight-bold);
  line-height: 22px;
}
.cf-analytics-user {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  padding-left: 9px;
  border-left: 1px solid var(--cf-gray-200);
  font-size: var(--cf-font-size-lg);
}
/*
 * 主页的大头像不一定是正方形，这里裁成圆形小图。
 * 大小跟随「用户」页的头像大小设置（和页面上其他头像用同一个变量），关闭「显示用户头像」时收起。
 */
.cf-analytics-avatar {
  flex-shrink: 0;
  width: var(--cf-avatar-size, 1.6em);
  height: var(--cf-avatar-size, 1.6em);
  margin-right: 6px;
  border: 1px solid rgb(0 0 0 / 10%);
  border-radius: 50%;
  box-sizing: border-box;
  object-fit: cover;
  transition:
    width 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    height 0.18s ease,
    margin-right 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.18s ease;
}
:root.cf-hide-userAvatar .cf-analytics-avatar {
  width: 0;
  margin-right: 0;
  border-width: 0;
  opacity: 0;
}
/* 颜色、字重和首字母的特殊着色都来自原站的评级样式类，这里只定字号。 */
.cf-analytics-username {
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 时区标注：贴在时间右上角的小字。 */
.cf-analytics-zone {
  margin-left: 1px;
  vertical-align: super;
  font-size: 9px;
  line-height: 0;
}
/* 图表里的颜色变化（切换难度分样式、悬停）平滑过渡，不突变。 */
.cf-analytics-chart svg :is(path, text) {
  transition:
    fill 0.3s ease,
    stroke 0.3s ease;
}
.cf-analytics-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-xs);
  font-variant-numeric: tabular-nums;
}
.cf-analytics-refresh {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  padding: 3px 10px;
  border: 1px solid color-mix(in srgb, var(--cf-analytics-accent) 30%, #dfe4ec);
  border-radius: var(--cf-radius-sm);
  background: color-mix(in srgb, var(--cf-analytics-accent) 7%, #fff);
  color: var(--cf-analytics-ink);
  font: inherit;
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-semibold);
  line-height: 18px;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}
.cf-analytics-refresh svg {
  width: 12px;
  height: 12px;
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.cf-analytics-refresh:enabled:hover {
  border-color: color-mix(in srgb, var(--cf-analytics-accent) 60%, #dfe4ec);
  background: color-mix(in srgb, var(--cf-analytics-accent) 15%, #fff);
}
.cf-analytics-refresh:enabled:hover svg {
  transform: rotate(180deg);
}
.cf-analytics-refresh:enabled:active {
  box-shadow: inset 0 1px 2px color-mix(in srgb, var(--cf-analytics-accent) 30%, transparent);
}
.cf-analytics-refresh:disabled {
  opacity: 0.55;
  cursor: wait;
}
.cf-analytics-refresh:disabled svg {
  animation: cf-analytics-spin 1s linear infinite;
}
.cf-analytics :is(.cf-analytics-refresh, .cf-analytics-load, .cf-analytics-link):focus-visible {
  outline: 2px solid color-mix(in srgb, var(--cf-analytics-accent) 55%, transparent);
  outline-offset: 2px;
}

/* 未加载：一块浅色的引导区，中间是加载按钮。 */
.cf-analytics-start {
  display: grid;
  justify-items: center;
  gap: 9px;
  padding: 22px 16px 20px;
  border: 1px dashed color-mix(in srgb, var(--cf-analytics-accent) 32%, #d9dee7);
  border-radius: var(--cf-radius-lg);
  background:
    radial-gradient(120% 140% at 0% 0%, #e45b9612, transparent 55%),
    radial-gradient(120% 140% at 100% 0%, #62a9d516, transparent 55%),
    radial-gradient(120% 160% at 50% 120%, #e8bd5814, transparent 60%), #fcfdff;
}
.cf-analytics-load {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  padding: 7px 18px 7px 12px;
  border: 1px solid color-mix(in srgb, var(--cf-analytics-accent) 38%, #dfe4ec);
  border-radius: 999px;
  background: linear-gradient(#fff, color-mix(in srgb, var(--cf-analytics-accent) 7%, #fff));
  color: var(--cf-analytics-ink);
  font: inherit;
  font-size: var(--cf-font-size-lg);
  font-weight: var(--cf-font-weight-semibold);
  line-height: 22px;
  cursor: pointer;
  box-shadow:
    0 1px 2px #1f2d3d14,
    inset 0 1px 0 #fff;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}
/* 悬停时花朵转过一片花瓣的角度，八瓣的花转完后轮廓不变，只有颜色换了位置。 */
.cf-analytics-load-flower {
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.cf-analytics-load:hover {
  border-color: color-mix(in srgb, var(--cf-analytics-accent) 70%, #dfe4ec);
  box-shadow:
    0 4px 14px color-mix(in srgb, var(--cf-analytics-accent) 22%, transparent),
    inset 0 1px 0 #fff;
  transform: translateY(-1px);
}
.cf-analytics-load:hover .cf-analytics-load-flower {
  transform: rotate(45deg);
}
.cf-analytics-load:active {
  transform: translateY(0);
  box-shadow:
    0 1px 2px #1f2d3d14,
    inset 0 1px 2px color-mix(in srgb, var(--cf-analytics-accent) 22%, transparent);
}
.cf-analytics-start-note {
  margin: 0;
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-xs);
}

.cf-analytics-error {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 12px;
  padding: 8px 12px;
  border: 1px solid #f0c9c4;
  border-radius: var(--cf-radius-md);
  background: #fff6f5;
  color: #a8433a;
  font-size: var(--cf-font-size-base);
}
.cf-analytics-link {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: var(--cf-analytics-ink);
  font: inherit;
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-semibold);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, currentColor 35%, transparent);
  text-underline-offset: 3px;
  cursor: pointer;
}
.cf-analytics-link:hover {
  text-decoration-color: currentColor;
}
.cf-analytics-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cf-analytics-empty {
  margin: 0;
  padding: 18px 0;
  color: var(--cf-gray-400);
  text-align: center;
}
/* 每块图表共用的外框与标题行。悬停提示放在外框里，按外框定位。 */
.cf-analytics-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  padding: 12px 14px 14px;
  border: 1px solid #e6e9ef;
  border-radius: var(--cf-radius-md);
  background: var(--cf-analytics-card-surface);
}
.cf-analytics-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
/* 标题行右侧放的小工具：来源标注、数值切换、展开链接等。 */
.cf-analytics-card-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}
/*
 * 右侧既有控件又有说明的图表分两行排（is-stacked），各行靠右对齐，标题留在第一行。各张图都按同一个规矩：
 * 第一行是能操作的控件（时间段、数值切换、时间范围、时区），时区选择排在最右；
 * 第二行是说明性的小字（难度分来源、图例）。只有其中一种的图表仍是一行。
 * 难度热力图多一行：来源下面再单独一行写这段时间的小计。
 * 一行里要并排几样时，用 cf-analytics-card-row 包起来。
 */
.cf-analytics-card-head.is-stacked {
  align-items: flex-start;
}
.cf-analytics-card-head.is-stacked .cf-analytics-card-tools {
  flex-direction: column;
  align-items: flex-end;
  gap: 9px;
}
.cf-analytics-card-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
/* 时区选择排在一行的最右时，往右让出它自己留白的那几个像素：它的箭头就和下面一行的右边缘对齐，不会缩进去一截。 */
.cf-analytics-card-tools .cf-analytics-zone-picker:last-child {
  margin-right: -3px;
}
.cf-analytics-card-head h4 {
  margin: 0;
  padding: 0;
  color: var(--cf-gray-700);
  font-size: var(--cf-font-size-lg);
  font-weight: var(--cf-font-weight-bold);
  line-height: 20px;
}
/* 图表的容器是定位元素并裁掉超出的部分：整张图横向滑动换内容时，滑出去的部分不露在外面。 */
.cf-analytics-chart {
  position: relative;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}
/* 滑动时左侧留在原地不动的一条（比如热力图的星期标注）：盖在滑动的内容上面，底色和卡片一致。 */
.cf-analytics-chart-keep {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
  background: var(--cf-analytics-card-surface);
  pointer-events: none;
}
/* 图表里的柱子和文字只是能悬停，不能点击，所以不显示手型光标。
   带范围选择的图表除外（has-controls）：滑块和手柄要显示各自的拖动光标。 */
.cf-analytics-chart:not(.has-controls),
.cf-analytics-chart:not(.has-controls) * {
  cursor: default !important;
}
/* 例外：点一下能把提示固定住的图形（热力图里有记录的格子），悬停时显示手型光标。 */
.cf-analytics-chart.is-pointing,
.cf-analytics-chart.is-pointing * {
  cursor: pointer !important;
}
/*
 * 图表的悬停提示。位置由脚本用 left / top 写入，并对齐到屏幕的物理像素；不用位移变换，
 * 文字才不会时清时糊。显隐只做一个很短的淡入淡出。
 */
.cf-analytics-chart-tip {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 3;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.12s ease,
    visibility 0s linear 0.12s;
}
.cf-analytics-chart-tip.is-visible {
  opacity: 1;
  visibility: visible;
  transition: opacity 0.12s ease;
}
/* 提示显示着的时候移到相邻的柱子上：滑过去，不是跳过去。刚出现时没有这个类，直接放到位。 */
.cf-analytics-chart-tip.is-visible.is-gliding {
  transition:
    left 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    top 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.12s ease;
}
/* 提示的面板。默认白底灰边；难度分布会按档位把背板和边线换成对应的颜色。 */
.cf-analytics-tip {
  padding: 6px 10px;
  border: 1px solid #dfe4ec;
  border-radius: var(--cf-radius-md);
  background: #fff;
  box-shadow: 0 4px 14px #1f2d3d1f;
  color: var(--cf-gray-700);
  font-size: var(--cf-font-size-base);
  line-height: 18px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  /* 从一档移到另一档时，底色和边线色渐变过去；固定与放开时阴影渐变。 */
  transition:
    background-color 0.22s ease,
    border-color 0.22s ease,
    box-shadow 0.22s ease;
}
/* 标题行：开头加粗的一段和后面的说明排成一行。 */
.cf-analytics-tip-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 3px 8px;
}
.cf-analytics-tip strong {
  font-weight: var(--cf-font-weight-bold);
  transition: color 0.22s ease;
}
/* 提示被点击固定住之后才接收鼠标，可以移进去点里面的链接；平时不挡下面的图形。 */
.cf-analytics-chart-tip.is-pinned.is-visible {
  pointer-events: auto;
}
/* 固定着的提示阴影加深一些，看得出它停住了。 */
.cf-analytics-chart-tip.is-pinned .cf-analytics-tip {
  box-shadow:
    0 8px 22px #1f2d3d38,
    0 0 0 1px #1f2d3d1f;
}
/*
 * 标题行下面逐条列出的内容（比如某一天通过的题）：题号、名称、难度分三栏，名称太长时省略。
 * 栏与栏之间的间隔写成每一格的左右内边距，不用列间距：一行的三格首尾相接，
 * 整行作为链接时中间没有点不到的缝，悬停的底色也连成一条。列表两侧用负边距把这份内边距抵掉，文字仍和标题行对齐。
 * 列表在标题行下面另起一块，宽度再大也不会和标题行排到同一行去。
 */
.cf-analytics-tip ul {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  max-width: 350px;
  margin: 5px -5px 0;
  padding: 4px 0 0;
  border-top: 1px solid #1f2d3d14;
  list-style: none;
}
.cf-analytics-tip ul[hidden] {
  display: none;
}
/* 题目很多时列表自己滚动，提示不会无限变高。 */
.cf-analytics-chart-tip.is-pinnable .cf-analytics-tip ul {
  max-height: 194px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}
.cf-analytics-tip li,
.cf-analytics-tip li a {
  display: contents;
}
.cf-analytics-tip li :is(b, span, i) {
  padding: 0.5px 5px;
  transition: background-color 0.16s ease;
}
.cf-analytics-tip li :is(b, i) {
  font-style: normal;
  font-weight: var(--cf-font-weight-semibold);
}
.cf-analytics-tip li span {
  overflow: hidden;
  text-overflow: ellipsis;
}
.cf-analytics-tip li i {
  text-align: right;
}
/* 一段文字里单独着色的一截（比如按档位着色的评级）：加粗，不用斜体。 */
.cf-analytics-tip li em {
  font-style: normal;
  font-weight: var(--cf-font-weight-semibold);
}
/* 链接的颜色显式写出，不受原站 a:link / a:visited 的影响；悬停时整行垫一层很浅的底色。 */
.cf-analytics .cf-analytics-tip li a:is(:link, :visited) {
  color: inherit;
  text-decoration: none;
}
.cf-analytics-tip li a:is(:hover, :focus-visible) > * {
  background: #1f2d3d12;
}
.cf-analytics-tip li a:focus-visible {
  outline: none;
}
.cf-analytics-tip li a > b {
  border-radius: var(--cf-radius-sm) 0 0 var(--cf-radius-sm);
}
.cf-analytics-tip li a > i {
  border-radius: 0 var(--cf-radius-sm) var(--cf-radius-sm) 0;
}
/* 能点的行（评级曲线提示里的比赛和提交、热力图提示里的题目）：文字用链接色并带下划线，行尾一个向外的箭头，
   和不能点的行一眼分得开；悬停时下划线变实。箭头跟在这一行右边的数值后面，隔开一点。 */
.cf-analytics-tip li.is-action span {
  color: color-mix(in srgb, var(--cf-analytics-accent) 82%, #1f2d3d);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, currentColor 38%, transparent);
  text-underline-offset: 2px;
  transition:
    background-color 0.16s ease,
    text-decoration-color 0.16s ease;
}
.cf-analytics-tip li.is-action a:is(:hover, :focus-visible) span {
  text-decoration-color: currentColor;
}
.cf-analytics-tip li.is-action i::after {
  content: '↗';
  margin-left: 4px;
  color: color-mix(in srgb, var(--cf-analytics-accent) 82%, #1f2d3d);
  font-weight: normal;
}
/* 灰色的行（重做的题）能点时仍是灰色，不换成链接色，免得和首次通过的题混在一起。 */
.cf-analytics-tip li.is-action.is-muted span,
.cf-analytics-tip li.is-action.is-muted i::after {
  color: inherit;
}
/* 灰色的一行（比如以前就通过、当天重做的题）：整行用灰色，题号和难度分不加粗，和上面带颜色的行一眼分得开。 */
.cf-analytics-tip li.is-muted {
  color: var(--cf-gray-400);
}
.cf-analytics-tip li.is-muted :is(b, i) {
  font-weight: normal;
}
/* 夹在列表里的小标题，把后面的几行归成一组；前面还有别的行时，用一条虚线隔开。 */
.cf-analytics-tip li.is-heading {
  display: block;
  grid-column: 1 / -1;
  padding: 0 5px;
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-xs);
}
.cf-analytics-tip li.is-heading:not(:first-child) {
  margin-top: 4px;
  padding-top: 3px;
  border-top: 1px dashed #1f2d3d24;
}
/* 图表标题栏里的一行小字说明（比如这一年有多少天通过了题）。 */
.cf-analytics-card-note {
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-xs);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.cf-analytics-source {
  padding: 0 7px;
  border: 1px solid var(--cf-gray-200);
  border-radius: 999px;
  color: var(--cf-gray-500);
  font-size: var(--cf-font-size-2xs);
  line-height: 16px;
  white-space: nowrap;
}
@keyframes cf-analytics-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .cf-analytics-refresh svg,
  .cf-analytics-load,
  .cf-analytics-load-flower,
  .cf-analytics-avatar,
  .cf-analytics-chart-tip,
  .cf-analytics-chart-tip.is-visible,
  .cf-analytics-chart-tip.is-visible.is-gliding,
  .cf-analytics-tip,
  .cf-analytics-tip strong,
  .cf-analytics-tip li :is(b, span, i),
  .cf-analytics-tip li.is-action span,
  .cf-analytics-swap-enter-active,
  .cf-analytics-swap-leave-active,
  .cf-analytics-chart svg :is(path, text) {
    transition: none;
    animation: none;
  }
}
</style>
