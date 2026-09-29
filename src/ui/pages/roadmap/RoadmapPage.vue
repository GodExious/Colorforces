<script setup>
import { computed } from 'vue';
import { appSettings } from '../../../settings.js';
import { translate as t } from '../../../i18n/index.js';
import * as assets from '../../../assets/index.js';
import InlineSvg from '../../components/icons/InlineSvg/InlineSvg.vue';
import items from './data.js';
const languageFiles = import.meta.glob('./locales/*.js', { eager: true, import: 'default' });
const messages = computed(
  () => languageFiles['./locales/' + appSettings.lang + '.js'] || languageFiles['./locales/en.js'],
);
</script>
<template>
  <div class="cf-tab-panel" ref="tabPanels_roadmap">
    <div class="cf-roadmap-header" ref="roadmapHeader">
      <h3 class="cf-roadmap-title" ref="roadmapTitleEl">
        <span class="cf-section-title-icon"
          ><inline-svg v-bind:source="assets.menuRoadmapIcon"></inline-svg></span
        ><span class="cf-roadmap-title-text">{{ t('roadmapTitle') }}</span>
      </h3>
      <p class="cf-roadmap-subtitle" v-text="t().roadmapSubtitle" ref="roadmapSubtitleEl"></p>
    </div>
    <div class="cf-roadmap-container" ref="roadmapContainer">
      <div class="cf-roadmap-proposal-card">
        <div class="cf-roadmap-proposal-header">
          <div class="cf-roadmap-proposal-title-wrap">
            <div class="cf-roadmap-proposal-icon">
              <inline-svg :source="assets.ideaBulbIcon"></inline-svg>
            </div>
            <span class="cf-roadmap-proposal-title-text">{{ t('roadmapProposalTitle') }}</span>
          </div>
          <a
            class="cf-roadmap-proposal-btn"
            href="https://github.com/GodExious/Colorforces/issues"
            target="_blank"
            rel="noopener noreferrer"
            ><span>{{ t('roadmapProposalBtn') }}</span
            ><inline-svg :source="assets.roadmapExternalLinkIcon"></inline-svg
          ></a>
        </div>
        <p class="cf-roadmap-proposal-desc">{{ t('roadmapProposalDesc') }}</p>
      </div>
      <div class="cf-roadmap-group">
        <div class="cf-roadmap-group-header">
          <div class="cf-roadmap-group-title">
            <inline-svg v-bind:source="assets.roadmapPlannedHeaderIcon"></inline-svg
            ><span>{{ t('roadmapStatusPlanned') }}</span>
          </div>
          <span
            class="cf-roadmap-group-badge planned"
            v-text="t('roadmapItemCount', items.filter(item =&gt; item.completed === false).length)"
          ></span>
        </div>
        <div class="cf-roadmap-list">
          <div
            class="cf-roadmap-card planned"
            v-for="item in items.filter(item =&gt; item.completed === false)"
            v-bind:key="item.id"
          >
            <div class="cf-roadmap-card-header">
              <div class="cf-roadmap-card-title-wrap">
                <div class="cf-roadmap-status-icon planned">
                  <inline-svg v-bind:source="assets.roadmapPlannedIcon"></inline-svg>
                </div>
                <span class="cf-roadmap-item-title-text" v-text="messages[item.id]?.title"></span>
              </div>
              <span class="cf-roadmap-tag planned">{{ t('roadmapStatusPlanned') }}</span>
            </div>
            <p class="cf-roadmap-item-desc" v-text="messages[item.id]?.desc"></p>
          </div>
        </div>
      </div>
      <div class="cf-roadmap-group">
        <div class="cf-roadmap-group-header">
          <div class="cf-roadmap-group-title">
            <inline-svg v-bind:source="assets.roadmapCompletedHeaderIcon"></inline-svg
            ><span>{{ t('roadmapSectionCompleted') }}</span>
          </div>
          <span
            class="cf-roadmap-group-badge completed"
            v-text="t('roadmapItemCount', items.filter(item =&gt; item.completed === true).length)"
          ></span>
        </div>
        <div class="cf-roadmap-list">
          <div
            class="cf-roadmap-card completed"
            v-for="item in items.filter(item =&gt; item.completed === true)"
            v-bind:key="item.id"
          >
            <div class="cf-roadmap-card-header">
              <div class="cf-roadmap-card-title-wrap">
                <div class="cf-roadmap-status-icon completed">
                  <inline-svg v-bind:source="assets.roadmapCompletedIcon"></inline-svg>
                </div>
                <span class="cf-roadmap-item-title-text" v-text="messages[item.id]?.title"></span>
              </div>
              <span class="cf-roadmap-tag completed">{{ t('syncBtnDone') }}</span>
            </div>
            <p class="cf-roadmap-item-desc" v-text="messages[item.id]?.desc"></p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.cf-roadmap-header {
  margin-bottom: 12px;
}

.cf-roadmap-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 4px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cf-roadmap-subtitle {
  font-size: 12px;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

.cf-roadmap-container {
  --cf-roadmap-planned: color-mix(in srgb, var(--cf-menu-accent) 24%, #6681a7);
  --cf-roadmap-planned-ink: color-mix(in srgb, var(--cf-roadmap-planned) 65%, #263747);
  --cf-proposal-accent: #aa7c30;
  --cf-proposal-ink: #77572e;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cf-roadmap-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cf-roadmap-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 4px;
}

.cf-roadmap-group-title {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cf-roadmap-group-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 10px;
  line-height: 1.3;
}

.cf-roadmap-group-badge.planned {
  background: color-mix(in srgb, var(--cf-roadmap-planned) 13%, var(--cf-content-surface));
  color: var(--cf-roadmap-planned-ink);
  border: 1px solid color-mix(in srgb, var(--cf-roadmap-planned) 30%, transparent);
}

.cf-roadmap-group-badge.completed {
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}

.cf-roadmap-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cf-roadmap-card {
  background: var(--cf-card-surface, #fff);
  border: 1px solid var(--cf-surface-border, #e2e8f0);
  border-radius: 9px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.cf-roadmap-card:hover {
  border-color: color-mix(in srgb, var(--cf-roadmap-planned) 48%, var(--cf-surface-border));
  box-shadow: 0 2px 8px color-mix(in srgb, var(--cf-roadmap-planned) 10%, transparent);
}

/* 计划用蓝灰、完成用青绿；提议入口用暖金，与页面底色拉开层次。 */
.cf-roadmap-card.planned {
  background: linear-gradient(
    115deg,
    color-mix(in srgb, var(--cf-roadmap-planned) 14%, var(--cf-content-surface)),
    color-mix(in srgb, var(--cf-roadmap-planned) 5%, var(--cf-content-surface))
  );
  border-color: color-mix(in srgb, var(--cf-roadmap-planned) 26%, var(--cf-surface-border));
  box-shadow: inset 2px 0 color-mix(in srgb, var(--cf-roadmap-planned) 60%, transparent);
}

.cf-roadmap-card.planned:hover {
  border-color: color-mix(in srgb, var(--cf-roadmap-planned) 55%, var(--cf-surface-border));
  box-shadow:
    inset 2px 0 var(--cf-roadmap-planned),
    0 2px 8px color-mix(in srgb, var(--cf-roadmap-planned) 12%, transparent);
}

.cf-roadmap-card.completed {
  background: color-mix(in srgb, var(--cf-menu-accent) 7%, var(--cf-content-surface));
  border-color: var(--cf-surface-border);
}

.cf-roadmap-card.completed:hover {
  background: color-mix(in srgb, var(--cf-menu-accent) 11%, var(--cf-content-surface));
  border-color: color-mix(in srgb, var(--cf-menu-accent) 42%, #dde5ee);
}

.cf-roadmap-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cf-roadmap-card-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cf-roadmap-status-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.cf-roadmap-status-icon.completed {
  background: #10b981;
  color: #ffffff;
}

.cf-roadmap-status-icon.planned {
  background: transparent;
  color: var(--cf-roadmap-planned-ink);
  border: none;
}

.cf-roadmap-item-title-text {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.4;
}

.cf-roadmap-card.completed .cf-roadmap-item-title-text {
  color: #1e293b;
}

.cf-roadmap-item-desc {
  font-size: 11.5px;
  color: #64748b;
  margin: 0;
  line-height: 1.55;
}

.cf-roadmap-tag {
  font-size: 10.5px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

.cf-roadmap-tag.planned {
  background: color-mix(in srgb, var(--cf-roadmap-planned) 15%, var(--cf-content-surface));
  color: var(--cf-roadmap-planned-ink);
  border: 1px solid color-mix(in srgb, var(--cf-roadmap-planned) 30%, transparent);
}

.cf-roadmap-tag.completed {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.cf-roadmap-proposal-card {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--cf-menu-accent) 4%, #fcf0d8),
    color-mix(in srgb, var(--cf-menu-secondary) 7%, #f8efdf)
  );
  border: 1px dashed color-mix(in srgb, var(--cf-proposal-accent) 48%, transparent);
  border-radius: 9px;
  padding: 11px 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 4px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.cf-roadmap-proposal-card:hover {
  border-color: var(--cf-proposal-accent);
  box-shadow: 0 3px 12px color-mix(in srgb, var(--cf-proposal-accent) 12%, transparent);
}

.cf-roadmap-proposal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.cf-roadmap-proposal-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cf-roadmap-proposal-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: color-mix(in srgb, var(--cf-proposal-accent) 16%, #fcf0d8);
  color: var(--cf-proposal-ink);
}

.cf-roadmap-proposal-title-text {
  font-size: 13px;
  font-weight: 700;
  color: var(--cf-proposal-ink);
  line-height: 1.4;
}

/* 菜单内链接显式提高优先级，避免原站 a:link/a:visited 覆盖配色。 */
.cf-settings-modal .cf-roadmap-proposal-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--cf-proposal-ink);
  background: color-mix(in srgb, var(--cf-proposal-accent) 12%, #fcf0d8);
  border: 1px solid color-mix(in srgb, var(--cf-proposal-accent) 34%, transparent);
  border-radius: 6px;
  text-decoration: none;
  flex-shrink: 0;
  line-height: 1.35;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--cf-proposal-accent) 8%, transparent);
}

.cf-settings-modal .cf-roadmap-proposal-btn:hover {
  background: var(--cf-proposal-ink);
  color: #ffffff;
  border-color: var(--cf-proposal-ink);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--cf-proposal-accent) 22%, transparent);
  transform: translateY(-1px);
}

.cf-roadmap-proposal-btn svg {
  transition: transform 0.15s ease;
}

.cf-roadmap-proposal-btn:hover svg {
  transform: translate(1px, -1px);
}

.cf-roadmap-proposal-desc {
  font-size: 11.5px;
  color: var(--cf-proposal-ink);
  margin: 0;
  line-height: 1.55;
  padding-left: 30px;
  opacity: 0.9;
}
</style>
