<script setup>
import { ref } from 'vue';
import { translate as t } from '../../../i18n/index.js';
import * as assets from '../../../assets/index.js';
import InlineSvg from '../../components/icons/InlineSvg/InlineSvg.vue';
import ProjectType from './components/ProjectType/ProjectType.vue';
import ProjectLinks from './components/ProjectLinks/ProjectLinks.vue';
const props = defineProps({ active: Boolean });
const analyticsLinks = [
  {
    id: 'extension',
    href: 'https://chromewebstore.google.com/detail/codeforces-analytics-pro/gfoledimnmjchddncmedpcieiccnagcj',
    labelKey: 'ackAnalyticsExtensionLink',
    icon: assets.projectExtensionIcon,
  },
  {
    id: 'userscript',
    href: 'https://greasyfork.org/zh-CN/scripts/465176-cf%E8%A7%A3%E9%A2%98%E6%95%B0%E6%8D%AE%E5%8F%AF%E8%A7%86%E5%8C%96-pro-max',
    labelKey: 'ackAnalyticsUserscriptLink',
    icon: assets.projectUserscriptIcon,
  },
];
</script>
<template>
  <div class="cf-tab-panel" ref="tabPanels_acknowledgments">
    <div class="cf-ack-header" ref="ackHeader">
      <h3 class="cf-ack-title" ref="ackTitleEl">
        <span class="cf-section-title-icon"
          ><inline-svg v-bind:source="assets.menuAcknowledgmentsIcon"></inline-svg></span
        ><span class="cf-ack-title-text">{{ t('ackSectionTitle') }}</span>
      </h3>
      <p class="cf-ack-subtitle" v-text="t().ackSectionSubtitle" ref="ackSubtitleEl"></p>
    </div>
    <div class="cf-ack-card helper-card" ref="cardHelper">
      <div class="cf-ack-card-top" ref="helperTop">
        <div class="cf-ack-project-info" ref="helperInfo">
          <div class="cf-ack-icon-box" ref="helperIcon">
            <img
              class="cf-ack-icon-img"
              alt="Codeforces-Helper"
              v-bind:src="assets.cfHelperImage"
              ref="helperImg"
            />
          </div>
          <span class="cf-ack-project-name" ref="helperName">{{ t('ackHelperTitle') }}</span>
        </div>
        <span class="cf-ack-badge blue" v-text="t().ackHelperBadge" ref="helperBadge"></span>
      </div>
      <div class="cf-ack-desc" v-html="t().ackHelperDesc" ref="helperDesc"></div>
      <div class="cf-ack-footer" ref="helperFooter">
        <ProjectType type="extension" />
        <a
          class="cf-ack-link-btn helper-btn"
          href="https://chromewebstore.google.com/detail/codeforces-helper/ahoeafmlmoohkkalcickdnkifpfnolpj"
          target="_blank"
          rel="noopener noreferrer"
          ref="helperBtn"
          ><span v-text="t().ackHelperLinkText" ref="helperBtnText"></span
          ><inline-svg v-bind:source="assets.brandExternalLinkIcon"></inline-svg
        ></a>
      </div>
    </div>
    <div class="cf-ack-card clist-card" ref="cardClist">
      <div class="cf-ack-card-top" ref="clistTop">
        <div class="cf-ack-project-info" ref="clistInfo">
          <div class="cf-ack-icon-box" ref="clistIcon">
            <img
              class="cf-ack-icon-img"
              alt="CList"
              v-bind:src="assets.clistImage"
              ref="clistImg"
            />
          </div>
          <span class="cf-ack-project-name" ref="clistName">{{ t('ackClistTitle') }}</span>
        </div>
        <span class="cf-ack-badge sky" v-text="t().ackClistBadge" ref="clistBadge"></span>
      </div>
      <div class="cf-ack-desc" v-html="t().ackClistDesc" ref="clistDesc"></div>
      <div class="cf-ack-footer" ref="clistFooter">
        <ProjectType type="website" />
        <a
          class="cf-ack-link-btn clist-btn"
          href="https://clist.by/"
          target="_blank"
          rel="noopener noreferrer"
          ref="clistBtn"
          ><span v-text="t().ackClistLinkText" ref="clistBtnText"></span
          ><inline-svg v-bind:source="assets.brandExternalLinkIcon"></inline-svg
        ></a>
      </div>
    </div>
    <div class="cf-ack-card ojbetter-card" ref="cardOjBetter">
      <div class="cf-ack-card-top" ref="ojBetterTop">
        <div class="cf-ack-project-info" ref="ojBetterInfo">
          <div class="cf-ack-icon-box" ref="ojBetterIcon">
            <inline-svg v-bind:source="assets.ojBetterIcon"></inline-svg>
          </div>
          <span class="cf-ack-project-name" ref="ojBetterName">{{ t('ackOjBetterTitle') }}</span>
        </div>
        <span class="cf-ack-badge purple" v-text="t().ackOjBetterBadge" ref="ojBetterBadge"></span>
      </div>
      <div class="cf-ack-desc" v-html="t().ackOjBetterDesc" ref="ojBetterDesc"></div>
      <div class="cf-ack-footer" ref="ojBetterFooter">
        <ProjectType type="userscript" />
        <a
          class="cf-ack-link-btn ojbetter-btn"
          href="https://github.com/beijixiaohu/OJBetter"
          target="_blank"
          rel="noopener noreferrer"
          ref="ojBetterBtn"
          ><span v-text="t().ackOjBetterLinkText" ref="ojBetterBtnText"></span
          ><inline-svg v-bind:source="assets.brandExternalLinkIcon"></inline-svg
        ></a>
      </div>
    </div>
    <div class="cf-ack-card carrot-card" ref="cardCarrot">
      <div class="cf-ack-card-top" ref="carrotTop">
        <div class="cf-ack-project-info" ref="carrotInfo">
          <div class="cf-ack-icon-box" ref="carrotIcon">
            <img
              class="cf-ack-icon-img"
              alt="Carrot-Plus"
              v-bind:src="assets.carrotImage"
              ref="carrotImg"
            />
          </div>
          <span class="cf-ack-project-name" ref="carrotName">{{ t('ackCarrotTitle') }}</span>
        </div>
        <span class="cf-ack-badge amber" v-text="t().ackCarrotBadge" ref="carrotBadge"></span>
      </div>
      <div class="cf-ack-desc" v-html="t().ackCarrotDesc" ref="carrotDesc"></div>
      <div class="cf-ack-footer" ref="carrotFooter">
        <ProjectType type="extension" />
        <a
          class="cf-ack-link-btn carrot-btn"
          href="https://github.com/wuyuqian114514/carrot-plus"
          target="_blank"
          rel="noopener noreferrer"
          ref="carrotBtn"
          ><span v-text="t().ackCarrotLinkText" ref="carrotBtnText"></span
          ><inline-svg v-bind:source="assets.brandExternalLinkIcon"></inline-svg
        ></a>
      </div>
    </div>
    <div class="cf-ack-card analytics-card">
      <div class="cf-ack-card-top">
        <div class="cf-ack-project-info">
          <div class="cf-ack-icon-box">
            <img
              class="cf-ack-icon-img"
              :src="assets.cfAnalyticsImage"
              :alt="t('ackAnalyticsTitle')"
            />
          </div>
          <span class="cf-ack-project-name">{{ t('ackAnalyticsTitle') }}</span>
        </div>
        <span class="cf-ack-badge">{{ t('ackAnalyticsBadge') }}</span>
      </div>
      <div class="cf-ack-desc" v-html="t('ackAnalyticsDesc')"></div>
      <div class="cf-ack-footer">
        <div class="cf-ack-project-types">
          <ProjectType type="extension" /><ProjectType type="userscript" />
        </div>
        <ProjectLinks :links="analyticsLinks" :active="props.active" />
      </div>
    </div>
  </div>
</template>

<style>
.cf-ack-header {
  margin-bottom: 2px;
}

.cf-ack-title {
  font-size: var(--cf-font-size-xl);
  font-weight: var(--cf-font-weight-bold);
  color: var(--cf-gray-900);
  margin: 0 0 4px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cf-ack-subtitle {
  font-size: var(--cf-font-size-base);
  color: var(--cf-gray-500);
  margin: 0;
  line-height: 1.5;
}

.cf-ack-card {
  --cf-ack-accent: var(--cf-menu-accent);
  --cf-ack-ink: color-mix(in srgb, var(--cf-ack-accent) 65%, #243447);
  background: linear-gradient(
    120deg,
    color-mix(in srgb, var(--cf-ack-accent) 14%, var(--cf-content-surface)),
    color-mix(in srgb, var(--cf-ack-accent) 5%, var(--cf-content-surface))
  );
  border: 1px solid color-mix(in srgb, var(--cf-ack-accent) 28%, var(--cf-surface-border));
  border-radius: var(--cf-radius-xl);
  padding: 13px 15px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  position: relative;
  box-shadow: inset 0 1px 0 #ffffff60;
  box-sizing: border-box;
}

.cf-ack-card:hover {
  border-color: color-mix(in srgb, var(--cf-ack-accent) 62%, var(--cf-surface-border));
  box-shadow:
    inset 0 1px 0 #ffffff60,
    0 4px 12px color-mix(in srgb, var(--cf-ack-accent) 14%, transparent);
}

/* 每个项目只声明点缀色，卡片、徽标与链接共用同一组配色规则。 */
.cf-ack-card.helper-card {
  --cf-ack-accent: #5276bd;
}

.cf-ack-card.clist-card {
  --cf-ack-accent: #3096a8;
}

.cf-ack-card.ojbetter-card {
  --cf-ack-accent: #8570b7;
}

.cf-ack-card.carrot-card {
  --cf-ack-accent: #ba8746;
}
.cf-ack-card.analytics-card {
  --cf-ack-accent: #5c9290;
}
/* 原图保持不变，仅让白底融入本卡片的图标底板，避免出现白色方块。 */
.cf-ack-card.analytics-card .cf-ack-icon-box {
  isolation: isolate;
}
.cf-ack-card.analytics-card .cf-ack-icon-img {
  mix-blend-mode: multiply;
}
.cf-ack-project-types {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cf-ack-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.cf-ack-project-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cf-ack-icon-box {
  width: 32px;
  height: 32px;
  border-radius: var(--cf-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  background: color-mix(in srgb, var(--cf-ack-accent) 16%, var(--cf-content-surface));
  border: 1px solid color-mix(in srgb, var(--cf-ack-accent) 22%, transparent);
  color: var(--cf-ack-ink);
}

.cf-ack-icon-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  border-radius: 3px;
  display: block;
}

.cf-ack-card.carrot-card .cf-ack-icon-img {
  image-rendering: pixelated;
}

.cf-ack-project-name {
  font-size: 13.5px;
  font-weight: var(--cf-font-weight-bold);
  color: var(--cf-gray-800);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cf-ack-badge {
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-semibold);
  padding: 3px 8px;
  border-radius: 9999px;
  white-space: nowrap;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--cf-ack-accent) 14%, var(--cf-content-surface));
  color: var(--cf-ack-ink);
  border: 1px solid color-mix(in srgb, var(--cf-ack-accent) 27%, transparent);
}

.cf-ack-desc {
  font-size: var(--cf-font-size-md);
  color: var(--cf-gray-600);
  line-height: 1.6;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.cf-ack-desc p {
  margin: 0;
  line-height: 1.6;
}

.cf-ack-footer {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 2px;
}

/* 显式覆盖原站链接颜色，避免访问状态改变卡片配色。 */
.cf-settings-modal .cf-ack-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--cf-radius-sm);
  font-size: var(--cf-font-size-base);
  font-weight: var(--cf-font-weight-semibold);
  text-decoration: none !important;
  transition:
    color 0.2s ease,
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  cursor: pointer;
  background: color-mix(in srgb, var(--cf-ack-accent) 28%, var(--cf-content-surface));
  color: color-mix(in srgb, var(--cf-ack-accent) 40%, #243447);
  border: 1px solid color-mix(in srgb, var(--cf-ack-accent) 48%, var(--cf-content-surface));
  box-shadow:
    inset 0 1px 0 #ffffff65,
    0 1px 2px color-mix(in srgb, var(--cf-ack-accent) 12%, transparent);
}

.cf-settings-modal .cf-ack-link-btn:is(:hover, :focus-visible) {
  background: color-mix(in srgb, var(--cf-ack-accent) 36%, var(--cf-content-surface));
  color: color-mix(in srgb, var(--cf-ack-accent) 40%, #243447);
  border-color: color-mix(in srgb, var(--cf-ack-accent) 65%, var(--cf-content-surface));
  box-shadow:
    inset 0 1px 0 #ffffff65,
    0 2px 5px color-mix(in srgb, var(--cf-ack-accent) 17%, transparent);
}
</style>
