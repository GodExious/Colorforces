<script setup>
import { computed } from 'vue';
import { translate as t } from '../../../../../../../../i18n/index.js';
import { appSettings, saveSettings } from '../../../../../../../../settings.js';
import ModeSwitch from '../../controls/ModeSwitch/ModeSwitch.vue';
import ExpandTransition from '../../../../../../../components/transitions/ExpandTransition/ExpandTransition.vue';
import BarList from '../../bases/BarList/BarList.vue';
import { countText } from '../../../utils/numbers.js';
import { tintedTip } from '../../../utils/tips.js';

// 参赛类型分布：全部提交按「以个人还是以队伍的名义交的」分成两组，每组里再按参赛身份分。
// 标题栏右边可以切换柱子和数字按什么算，选择记在设置里；悬停提示里两种都写，和标签分布一样：
// - 提交次数：各项互不重叠，两组加起来就是全部提交。
// - 比赛场数：这一格里的提交来自多少场比赛。同一场可能既赛中交过又赛后练过，会算进两格，
//   所以各格加起来会多于一共涉及的场数。
// 不写占比：练习的提交通常占绝大多数，别的几项的百分比都很小，看不出什么。
// 「成绩被取消」是从提交结果认出来的一项（见统计模块），总是列出，绝大多数人是 0；
// 它的悬停提示多一行小字，说明是怎么认出来的。
// 两组总是都列出来，这个账号一次队伍提交也没有时队伍那一组各项是 0。
// 只有关掉了「计入队伍提交」时才只剩个人那一组，这时也不显示分组的小标题。
const props = defineProps({
  // 队伍提交是否计入统计。
  teams: { type: Boolean, default: true },
  // [{ type, submissions: { solo, team }, contests: { solo, team } }]：每种参赛身份下，个人和队伍各有多少次提交、
  // 来自多少场比赛（见统计模块的 participationDistribution）。
  // 正式参赛、虚拟参赛、未评级参赛、练习、成绩被取消按这个顺序排在前面，其余的身份有才列出。
  types: { type: Array, required: true },
});
const modes = [
  ['submissions', 'analyticsTypesBySubmissions'],
  ['contests', 'analyticsTypesByContests'],
];
const mode = computed(() =>
  appSettings.user.analytics.typesMode === 'contests' ? 'contests' : 'submissions',
);
function setMode(id) {
  appSettings.user.analytics.typesMode = id;
  saveSettings();
}

// 各种身份的颜色，两组里同一种身份同色；没列在这里的用面板的主色。
const COLORS = {
  CONTESTANT: '#5b8fd6',
  VIRTUAL: '#8a7ad8',
  OUT_OF_COMPETITION: '#43b8af',
  PRACTICE: '#8b97a8',
  CANCELLED: '#d9903d',
};
// 两组的柱长按同一个数折算，上下能直接比。
const peak = computed(() =>
  Math.max(1, ...props.types.map((item) => Math.max(item[mode.value].solo, item[mode.value].team))),
);
// 一组的各行。group 是这一组的名称，只写进悬停提示的标题里；field 取个人还是队伍的次数。
function rowsOf(field, group) {
  const names = t('analyticsTypeNames');
  return props.types.map((item) => {
    const name = names[item.type] || item.type;
    return {
      name,
      value: item[mode.value][field],
      color: COLORS[item.type],
      tip: () => {
        const tip = tintedTip(
          props.teams ? `${group} · ${name}` : name,
          COLORS[item.type],
          t(
            'analyticsTypeTip',
            countText(item.submissions[field]),
            countText(item.contests[field]),
          ),
        );
        // 这一项是怎么认出来的：另起一行小字写明。
        if (item.type === 'CANCELLED') tip.items.push({ heading: t('analyticsTypeCancelledNote') });
        return tip;
      },
    };
  });
}
const soloRows = computed(() => rowsOf('solo', t('analyticsTypeSolo')));
const teamRows = computed(() => rowsOf('team', t('analyticsTypeTeam')));
</script>

<template>
  <section class="cf-analytics-card">
    <header class="cf-analytics-card-head">
      <h4>
        <span>{{ t('analyticsChartTypes') }}</span>
      </h4>
      <div class="cf-analytics-card-tools">
        <ModeSwitch
          :modes="modes"
          :model-value="appSettings.user.analytics.typesMode"
          :label="t('analyticsModeLabel')"
          @update:model-value="setMode"
        />
      </div>
    </header>
    <!-- 计入队伍提交时分成两组：各带一个小标题，中间隔一条线。 -->
    <ExpandTransition :show="teams">
      <p class="cf-analytics-types-group">
        <span>{{ t('analyticsTypeSolo') }}</span>
      </p>
    </ExpandTransition>
    <BarList :rows="soloRows" :peak="peak" />
    <ExpandTransition :show="teams">
      <div class="cf-analytics-types-teams">
        <p class="cf-analytics-types-group">
          <span>{{ t('analyticsTypeTeam') }}</span>
        </p>
        <BarList :rows="teamRows" :peak="peak" />
      </div>
    </ExpandTransition>
  </section>
</template>

<style>
/* 分组的小标题：个人、队伍。 */
.cf-analytics-types-group {
  margin: 0 0 6px;
  color: var(--cf-gray-500);
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-semibold);
  line-height: 16px;
}
/* 队伍那一组和上面个人那一组之间隔一条线。 */
.cf-analytics-types-teams {
  padding-top: 10px;
  border-top: 1px dashed var(--cf-gray-200);
}
</style>
