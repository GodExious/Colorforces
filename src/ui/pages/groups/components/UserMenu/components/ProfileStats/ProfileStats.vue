<script setup>
import { computed } from 'vue';
import { translate as t } from '../../../../../../../i18n/index.js';
import { nameInk } from '../../../../../../../features/user/groups/progress.js';
// 右键菜单名片上的四项资料，排成一行四格，数字在上、名目在下：
// 最高分（用到过的最高段位的颜色）、贡献（正的绿、负的红）、被多少人关注、哪一年注册。
// stats 是 { maxRating, contribution, friends, registered }（见 groups/profiles.js），没有的项写「—」。
const props = defineProps({ stats: { type: Object, required: true } });
const cells = computed(() => {
  const { maxRating, contribution, friends, registered } = props.stats;
  return [
    {
      key: 'max',
      value: Number.isFinite(maxRating) ? String(maxRating) : '—',
      label: t('groupsStatMax'),
      style: { color: nameInk(maxRating) },
    },
    {
      key: 'contribution',
      value: contribution > 0 ? `+${contribution}` : String(contribution),
      label: t('groupsStatContribution'),
      tone: contribution > 0 ? 'is-up' : contribution < 0 ? 'is-down' : '',
    },
    { key: 'friends', value: friends.toLocaleString('en-US'), label: t('groupsStatFriends') },
    {
      key: 'joined',
      value: registered > 0 ? String(new Date(registered * 1000).getUTCFullYear()) : '—',
      label: t('groupsStatJoined'),
    },
  ];
});
</script>
<template>
  <span class="cf-profile-stats">
    <span v-for="cell in cells" :key="cell.key" class="cf-profile-stat"
      ><b :class="cell.tone" :style="cell.style">{{ cell.value }}</b
      ><small>{{ cell.label }}</small></span
    >
  </span>
</template>
<style>
.cf-profile-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  width: 100%;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  text-align: center;
}
.cf-profile-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.cf-profile-stat b,
.cf-profile-stat small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cf-profile-stat b {
  color: var(--cf-gray-700);
  font-size: var(--cf-font-size-base);
  font-variant-numeric: tabular-nums;
  line-height: 18px;
  transition: color var(--cf-duration-base) ease;
}
.cf-profile-stat b.is-up {
  color: #1f8a4c;
}
.cf-profile-stat b.is-down {
  color: #b2404a;
}
.cf-profile-stat small {
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-2xs);
  line-height: 14px;
}
</style>
