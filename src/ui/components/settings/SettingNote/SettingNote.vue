<script setup>
import * as assets from '../../../../assets/index.js';
import InlineSvg from '../../icons/InlineSvg/InlineSvg.vue';
// 设置页里的一条提示：左边一道主题色的竖线、一个小图标，后面是加粗的「提示：」和正文。快捷键页、分组页在用。
defineProps({ label: { type: String, required: true }, text: { type: String, required: true } });
</script>
<template>
  <div class="cf-setting-note">
    <span class="cf-setting-note-icon"><InlineSvg :source="assets.shortcutInfoIcon" /></span>
    <!-- 标题和正文是连着排的一段话，正文会折行，所以切换语言时整段一起收放，不分开标。 -->
    <div class="cf-setting-note-body">
      <strong class="cf-setting-note-label" v-text="label"></strong
      ><span class="cf-setting-note-text">{{ text }}</span>
    </div>
  </div>
</template>
<style>
.cf-setting-note {
  --cf-note-ink: color-mix(in srgb, var(--cf-menu-accent) 52%, #172b39);
  margin-top: 10px;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--cf-menu-accent) 11%, white);
  border: 1px solid var(--cf-surface-border);
  border-left: 3.5px solid var(--cf-menu-accent);
  border-radius: var(--cf-radius-sm);
  display: flex;
  align-items: center;
  gap: 7px;
  box-sizing: border-box;
  font-size: var(--cf-font-size-base);
  line-height: 1.5;
}

.cf-setting-note-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  color: var(--cf-note-ink);
  flex-shrink: 0;
}

.cf-setting-note-icon svg {
  width: 15px;
  height: 15px;
  display: block;
}

.cf-setting-note-body {
  flex: 1 1 auto;
  color: var(--cf-note-ink);
}

.cf-setting-note-label {
  font-weight: var(--cf-font-weight-bold);
  color: var(--cf-note-ink);
  margin-right: 2px;
}

.cf-setting-note-text {
  color: var(--cf-note-ink);
  font-weight: var(--cf-font-weight-medium);
}
</style>
