<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { appSettings, subscribeSettings } from '../../../settings.js';
import { translate as t } from '../../../i18n/index.js';
import * as assets from '../../../assets/index.js';
import InlineSvg from '../../components/icons/InlineSvg/InlineSvg.vue';
import ContributorsMenu from './components/ContributorsMenu/ContributorsMenu.vue';
import MenuGlassSurface from '../MenuGlassSurface/MenuGlassSurface.vue';
import { appStorage } from '../../../storage/gm.js';
import { CACHE_TIME_KEY, CLIST_LAST_SYNC_KEY } from '../../../storage/keys.js';
import { subscribeStorageChanges } from '../../../features/storage/cleanup.js';
import {
  subscribeClistProgress,
  currentClistSyncProgress,
} from '../../../features/ratings/clist.js';
import { openClistSyncProgress } from '../../pages/ratings/components/ClistSyncDialog/ClistSyncDialog.vue';
const tick = ref(0),
  progress = ref(currentClistSyncProgress);
const syncing = computed(() => progress.value && !progress.value.done);
const lastTime = computed(() => {
  tick.value;
  const value = appSettings.clist.enabled
    ? appStorage.getItem(CLIST_LAST_SYNC_KEY)
    : appStorage.getItem(CACHE_TIME_KEY);
  const timestamp = parseInt(value || '0', 10);
  return timestamp > 0 && !isNaN(new Date(timestamp).getTime()) ? timestamp : 0;
});
const dotStyle = computed(() => ({
  background: lastTime.value ? '#10b981' : '#f59e0b',
  boxShadow: lastTime.value ? '0 0 6px rgba(16,185,129,0.6)' : '0 0 6px rgba(245,158,11,0.6)',
}));
const statusText = computed(() => {
  if (!lastTime.value) return t('footerRatingStatus', t('footerRatingNeverSynced'));
  const d = new Date(lastTime.value),
    pad = (n) => String(n).padStart(2, '0');
  return t(
    'footerRatingStatus',
    d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      ' ' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes()),
  );
});
const stops = [];
let timer;
onMounted(() => {
  stops.push(
    subscribeSettings(() => tick.value++),
    subscribeStorageChanges(() => tick.value++),
    subscribeClistProgress((value) => {
      progress.value = value;
      tick.value++;
    }),
  );
  timer = setInterval(() => tick.value++, 1000);
});
onBeforeUnmount(() => {
  stops.forEach((stop) => stop());
  clearInterval(timer);
});
</script>
<template>
  <MenuGlassSurface class="cf-modal-footer" bottom>
    <div class="cf-footer-top-row">
      <div class="cf-footer-status-slot">
        <Transition name="cf-footer-swap">
          <div
            v-if="!syncing"
            :key="appSettings.clist.enabled ? 'clist' : 'cf'"
            class="cf-footer-status"
          >
            <span class="cf-status-dot" :style="dotStyle"></span
            ><span
              class="cf-footer-site-icon"
              style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
              "
              :title="appSettings.clist.enabled ? 'clist.by' : 'Codeforces'"
              ><img
                v-if="appSettings.clist.enabled"
                :src="assets.CLIST_ICON_DATA_URI"
                width="14"
                height="14"
                style="
                  vertical-align: -2px;
                  flex-shrink: 0;
                  display: inline-block;
                  border-radius: 2px;
                "
                alt="CList" /><inline-svg v-else="" :source="assets.CF_ICON_SVG"></inline-svg></span
            ><span data-cf-language-text>{{ statusText }}</span>
          </div>
          <button
            v-else
            key="syncing"
            type="button"
            class="cf-footer-mini-progress"
            :aria-label="t('footerMiniProgressTooltip')"
            v-bind:data-tooltip="t('footerMiniProgressTooltip')"
            @click="openClistSyncProgress()"
          >
            <span class="cf-spin" style="display: inline-flex; align-items: center; color: #3b82f6">
              <inline-svg v-bind:source="assets.loadingIcon"></inline-svg>
            </span>
            <span class="cf-mini-progress-bar">
              <span
                class="cf-mini-progress-bar-fill"
                style="width: 0%"
                :style="{ width: (progress?.percent || 0) + '%' }"
              ></span>
            </span>
            <span class="cf-mini-progress-text">{{ Math.floor(progress?.percent || 0) }}%</span>
          </button>
        </Transition>
      </div>
      <div class="cf-footer-links">
        <a href="https://github.com/GodExious/Colorforces" target="_blank" class="cf-footer-link"
          ><span style="display: flex; align-items: center; justify-content: center"
            ><inline-svg v-bind:source="assets.footerGithubIcon"></inline-svg></span
          ><span v-text="t().footerGithub"></span></a
        ><span class="cf-footer-divider">·</span
        ><a
          href="https://github.com/GodExious/Colorforces/issues"
          target="_blank"
          class="cf-footer-link"
          ><span style="display: flex; align-items: center; justify-content: center"
            ><inline-svg v-bind:source="assets.ideaBulbIcon"></inline-svg></span
          ><span data-cf-language-text v-text="t().footerIssue"></span
        ></a>
      </div>
    </div>
    <div class="cf-footer-bottom-row">
      <span class="cf-footer-motto" data-cf-language-text v-text="t().footerMotto"></span>
      <ContributorsMenu />
    </div>
  </MenuGlassSurface>
</template>
<style>
.cf-footer-status-slot {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 18px;
  display: grid;
  align-items: center;
}
.cf-footer-status-slot > * {
  grid-area: 1 / 1;
  justify-self: start;
}
.cf-footer-swap-enter-active,
.cf-footer-swap-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}
.cf-footer-swap-leave-active {
  pointer-events: none;
}
.cf-footer-swap-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.cf-footer-swap-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
@media (prefers-reduced-motion: reduce) {
  .cf-footer-swap-enter-active,
  .cf-footer-swap-leave-active {
    transition: none;
  }
}

.cf-modal-footer {
  border-top-width: 1px;
  border-top-style: solid;
  padding: 10px 18px 8px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cf-footer-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.cf-footer-status {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  font-size: 12px;
  user-select: none;
}

.cf-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
  display: inline-block;
}

.cf-footer-links {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cf-footer-link,
.cf-footer-link:link,
.cf-footer-link:visited {
  color: #64748b !important;
  text-decoration: none !important;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  transition: color 0.15s ease;
  cursor: pointer;
  user-select: none;
}

.cf-footer-link:hover,
.cf-footer-link:active {
  color: #1677ff !important;
  text-decoration: none !important;
}

.cf-footer-divider {
  color: #cbd5e1;
  font-size: 12px;
  user-select: none;
}

.cf-footer-bottom-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px dashed #edf2f7;
  padding-top: 5px;
  font-size: 11px;
  color: #94a3b8;
  user-select: none;
}

.cf-footer-motto {
  color: #94a3b8;
}

.cf-footer-mini-progress {
  appearance: none;
  border: 0;
  background: transparent;
  font-family: inherit;
  line-height: inherit;
  width: max-content;
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 2px 7px;
  margin: -2px -7px;
  border-radius: 6px;
  font-size: 12px;
  user-select: none;
  cursor: pointer;
  transition:
    background 0.2s ease,
    transform 0.15s ease;
}

.cf-footer-mini-progress:hover {
  background: rgba(59, 130, 246, 0.08);
}

.cf-footer-mini-progress:active {
  transform: scale(0.98);
}

.cf-mini-progress-bar {
  display: block;
  flex-shrink: 0;
  width: 76px;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
  position: relative;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.2s ease;
}

.cf-footer-mini-progress:hover .cf-mini-progress-bar {
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3);
}

.cf-mini-progress-bar-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #06b6d4);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.cf-mini-progress-text {
  font-size: 11px;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #334155;
  transition: color 0.2s ease;
}

.cf-footer-mini-progress:hover .cf-mini-progress-text {
  color: #1d4ed8;
}
</style>
