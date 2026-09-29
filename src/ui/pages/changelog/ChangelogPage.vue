<script setup>
import { computed, ref, watch } from 'vue';
import { appSettings } from '../../../settings.js';
import { translate as t } from '../../../i18n/index.js';
import * as assets from '../../../assets/index.js';
import InlineSvg from '../../components/icons/InlineSvg/InlineSvg.vue';
import ExpandTransition from '../../components/transitions/ExpandTransition/ExpandTransition.vue';
import entries from './data.js';
const languageFiles = import.meta.glob('./locales/*.js', { eager: true, import: 'default' });
const messages = computed(
  () => languageFiles['./locales/' + appSettings.lang + '.js'] || languageFiles['./locales/en.js'],
);
const props = defineProps({ active: Boolean });
const expanded = ref(new Set([entries[0]?.version]));
const badgeKeys = {
  added: 'changelogBadgeAdded',
  optimized: 'changelogBadgeOptimized',
  fixed: 'changelogBadgeFixed',
  announcement: 'changelogBadgeAnnouncement',
};
// 切换版本展开状态，页面重新打开时只展开最新版本。
function toggleVersion(version) {
  if (expanded.value.has(version)) expanded.value.delete(version);
  else expanded.value.add(version);
}
// 只在重新进入时重置展开项，离场时保留原画面供切页动画使用。
watch(
  () => props.active,
  (active) => {
    if (active) expanded.value = new Set([entries[0]?.version]);
  },
);
// 格式化原版更新记录中的代码和强调标记。
function formatChangelogText(text) {
  if (!text) return '';
  let escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  escaped = escaped.replace(/`([^`]+)`/g, '<span class="cf-changelog-code">$1</span>');
  escaped = escaped.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="cf-changelog-link">$1</a>',
  );
  return escaped;
}
</script>
<template>
  <div class="cf-tab-panel" ref="tabPanels_changelog">
    <div class="cf-changelog-header" ref="changelogHeader">
      <h3 class="cf-changelog-title" ref="changelogTitleEl">
        <span class="cf-section-title-icon"
          ><inline-svg v-bind:source="assets.menuChangelogIcon"></inline-svg></span
        ><span class="cf-changelog-title-text">{{ t('changelogTitle') }}</span>
      </h3>
      <p class="cf-changelog-subtitle" v-text="t().changelogSubtitle" ref="changelogSubtitleEl"></p>
    </div>
    <div class="cf-changelog-list" ref="changelogListContainer">
      <div
        class="cf-changelog-card"
        v-for="(entry, index) in entries"
        v-bind:key="entry.version"
        v-bind:class="{ expanded: expanded.has(entry.version) }"
      >
        <div
          class="cf-changelog-card-header"
          role="button"
          tabindex="0"
          :aria-expanded="expanded.has(entry.version)"
          @keydown.enter.prevent="toggleVersion(entry.version)"
          @keydown.space.prevent="toggleVersion(entry.version)"
          v-on:click="toggleVersion(entry.version)"
        >
          <div class="cf-changelog-card-left">
            <span
              class="cf-changelog-version"
              v-text="entry.version.replace(/^v(?=[0-9])/i, 'v ')"
            ></span
            ><span class="cf-changelog-badge-latest" v-if="index === 0">{{
              t('changelogLatestBadge')
            }}</span>
          </div>
          <div class="cf-changelog-card-right">
            <span class="cf-changelog-date" v-text="entry.date"></span
            ><span class="cf-changelog-chevron"
              ><inline-svg v-bind:source="assets.changelogChevronIcon"></inline-svg
            ></span>
          </div>
        </div>
        <ExpandTransition :show="expanded.has(entry.version)"
          ><div class="cf-changelog-card-body">
            <div
              class="cf-changelog-section"
              v-for="section in entry.sections"
              v-bind:key="section.contentKey"
            >
              <span
                class="cf-changelog-section-badge"
                v-bind:class="section.type"
                v-text="badgeKeys[section.type] ? t(badgeKeys[section.type]) : ''"
              ></span>
              <div class="cf-changelog-items">
                <div
                  class="cf-changelog-item"
                  v-for="(text, itemIndex) in messages[section.contentKey] || []"
                  v-bind:key="itemIndex"
                >
                  <span class="cf-changelog-item-index" v-text="itemIndex + 1 + '.'"></span>
                  <div class="cf-changelog-item-content" v-html="formatChangelogText(text)"></div>
                </div>
              </div>
            </div></div
        ></ExpandTransition>
      </div>
    </div>
  </div>
</template>

<style>
.cf-changelog-header {
  margin-bottom: 8px;
}

.cf-changelog-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 4px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cf-changelog-subtitle {
  font-size: 12px;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

.cf-changelog-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cf-changelog-card {
  background: var(--cf-card-surface, #fff);
  border: 1px solid var(--cf-surface-border, #e2e8f0);
  border-radius: 10px;
  overflow: hidden;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.cf-changelog-card:hover {
  border-color: color-mix(in srgb, var(--cf-menu-accent) 38%, var(--cf-surface-border));
  box-shadow: 0 2px 8px color-mix(in srgb, var(--cf-menu-accent) 10%, transparent);
}

.cf-changelog-card.expanded {
  border-color: color-mix(in srgb, var(--cf-menu-accent) 30%, var(--cf-surface-border));
}

.cf-changelog-card-header {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  background: var(--cf-card-hover, #fcfdfe);
  transition: background 0.15s ease;
}

.cf-changelog-card-header:hover {
  background: var(--cf-control-active);
}

.cf-changelog-card-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.cf-changelog-card-right {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.cf-changelog-version {
  font-size: 13.5px;
  font-weight: 700;
  color: #0f172a;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.cf-changelog-badge-latest {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: color-mix(in srgb, var(--cf-menu-accent) 55%, #174338);
  border: 1px solid color-mix(in srgb, var(--cf-menu-accent) 48%, #174338);
  border-radius: 999px;
  padding: 2px 8px;
  line-height: 1.3;
  box-shadow: 0 2px 6px color-mix(in srgb, var(--cf-menu-accent) 20%, transparent);
}

.cf-changelog-date {
  font-size: 11.5px;
  color: #94a3b8;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  white-space: nowrap;
  font-feature-settings: 'tnum';
}

.cf-changelog-chevron {
  color: #94a3b8;
  transition: transform 0.2s ease;
  display: flex;
  align-items: center;
}

.cf-changelog-card.expanded .cf-changelog-chevron {
  transform: rotate(180deg);
}

.cf-changelog-card-body {
  padding: 12px 16px 14px 16px;
  border-top: 1px solid var(--cf-surface-border);
  background: transparent;
  font-size: 12.5px;
  color: #334155;
  line-height: 1.6;
}

.cf-changelog-section {
  margin-bottom: 14px;
}

.cf-changelog-section:last-child {
  margin-bottom: 0;
}

.cf-changelog-section-badge {
  --cf-section-hue: #658078;
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  margin-bottom: 8px;
  line-height: 1.4;
  letter-spacing: 0.2px;
  color: color-mix(in srgb, var(--cf-section-hue) 65%, #23394a);
  background: color-mix(in srgb, var(--cf-section-hue) 8%, var(--cf-card-surface));
  border: 1px solid color-mix(in srgb, var(--cf-section-hue) 24%, var(--cf-surface-border));
}

.cf-changelog-section-badge.added {
  --cf-section-hue: #258064;
}

.cf-changelog-section-badge.optimized {
  --cf-section-hue: #3b78a0;
}

.cf-changelog-section-badge.fixed {
  --cf-section-hue: #aa752f;
}

.cf-changelog-section-badge.announcement {
  --cf-section-hue: #866299;
}

.cf-changelog-items {
  margin: 0 !important;
  padding: 0 0 0 6px !important;
  list-style: none !important;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cf-changelog-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12.5px;
  color: #334155;
  line-height: 1.6;
}

.cf-changelog-item-index {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  min-width: 18px;
  text-align: right;
  flex-shrink: 0;
  user-select: none;
  line-height: 1.6;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-feature-settings: 'tnum';
}

.cf-changelog-item-content {
  flex: 1;
  word-break: break-word;
  line-height: 1.6;
}

.cf-changelog-link {
  color: #0284c7 !important;
  text-decoration: none !important;
  font-weight: 500;
}

.cf-changelog-link:hover {
  text-decoration: underline !important;
}

.cf-changelog-code {
  background: var(--cf-control-surface);
  padding: 1px 5px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #0f172a;
  border: 1px solid var(--cf-surface-border, #e2e8f0);
}
</style>
