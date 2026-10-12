<script setup>
import { ref } from 'vue';
import ExpandTransition from '../../transitions/ExpandTransition/ExpandTransition.vue';

// 一个功能下面的一段子选项（功能、样式、内容）：一行小字当标题，下面的选项缩进一级、左边一条细竖线。
// 竖线和缩进用的是公共样式 cf-nested-options（见 App.vue），和「难度分」页的展示区域那一组是同一种画法。
// 项多的一段（「内容」）可以折叠：平时只有标题一行，右边写着已选了几项，点一下展开；
// 开合只记在这一次打开的菜单里，不存进设置。
defineProps({
  title: { type: String, required: true },
  foldable: { type: Boolean, default: false },
  // 折叠的一段写在标题右边的摘要，比如「已选 15/17」。
  summary: { type: String, default: '' },
  // 摘要要不要显得灰一些（一项都没选的时候）。
  muted: { type: Boolean, default: false },
});
const open = ref(false);
</script>

<template>
  <div class="cf-setting-section">
    <button
      v-if="foldable"
      type="button"
      class="cf-setting-item cf-setting-section-head cf-setting-section-toggle"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="cf-setting-sublabel">{{ title }}</span>
      <span class="cf-setting-section-summary" :class="{ 'is-open': open, 'is-muted': muted }">
        <!-- 数字变了时旧的淡出、新的淡入，不直接换字。 -->
        <Transition name="cf-setting-swap" mode="out-in">
          <span :key="summary">{{ summary }}</span>
        </Transition>
      </span>
    </button>
    <div v-else class="cf-setting-item cf-setting-section-head">
      <span class="cf-setting-sublabel">{{ title }}</span>
    </div>
    <ExpandTransition v-if="foldable" :show="open">
      <div class="cf-nested-options"><slot /></div>
    </ExpandTransition>
    <div v-else class="cf-nested-options"><slot /></div>
  </div>
</template>

<style>
/* 标题和下面那一块之间的间隔，同子选项之间的间隔（8px）。收起时下面那一块不占位置，也就没有这道间隔。 */
.cf-setting-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* 标题行和下面的选项行一样高（28px）。 */
.cf-setting-item.cf-setting-section-head {
  min-height: 28px;
  cursor: default;
}
/* 能折叠的标题整行是一个按钮：去掉按钮自带的样子，看上去仍是一行设置。 */
button.cf-setting-item.cf-setting-section-toggle {
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--cf-radius-sm);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
button.cf-setting-section-toggle:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--cf-menu-accent) 40%, transparent);
  outline-offset: 2px;
}
.cf-setting-section-toggle .cf-setting-sublabel {
  transition: color var(--cf-duration-fast) ease;
}
.cf-setting-section-toggle:hover .cf-setting-sublabel {
  color: var(--cf-control-ink);
}
.cf-setting-section-summary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--cf-control-ink);
  font-size: var(--cf-font-size-base);
  font-weight: var(--cf-font-weight-semibold);
  font-variant-numeric: tabular-nums;
  transition: color var(--cf-duration-fast) ease;
}
.cf-setting-section-summary.is-muted {
  color: var(--cf-gray-400);
}
/* 箭头：收起时朝右，展开时转向下。 */
.cf-setting-section-summary::after {
  content: '';
  width: 6px;
  height: 6px;
  margin-right: 3px;
  border-right: 1.6px solid currentColor;
  border-bottom: 1.6px solid currentColor;
  transform: rotate(-45deg);
  transition: transform var(--cf-duration-base) ease;
}
.cf-setting-section-summary.is-open::after {
  transform: rotate(45deg);
}
.cf-setting-swap-enter-active,
.cf-setting-swap-leave-active {
  transition: opacity 110ms ease;
}
.cf-setting-swap-enter-from,
.cf-setting-swap-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .cf-setting-section-summary::after,
  .cf-setting-swap-enter-active,
  .cf-setting-swap-leave-active {
    transition: none;
  }
}
</style>
