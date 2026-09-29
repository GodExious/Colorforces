<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { translate as t } from '../../../../../i18n/index.js';
import * as assets from '../../../../../assets/index.js';
import InlineSvg from '../../../../components/icons/InlineSvg/InlineSvg.vue';

// 名单、分工与外链统一维护，头像组和展开列表共用这份数据。
const contributors = [
  {
    name: 'GodExious',
    role: 'footerContributorAuthor',
    description: 'footerContributorAuthorDetail',
    image: assets.godexiousAvatar,
    url: 'https://github.com/GodExious',
  },
  {
    name: 'Antigravity',
    role: 'footerContributorAI',
    description: 'footerContributorAntigravityDetail',
    image: assets.antigravityLogo,
    url: 'https://antigravity.google/',
  },
  {
    name: 'Codex',
    role: 'footerContributorAI',
    description: 'footerContributorCodexDetail',
    image: assets.chatgptLogo,
    url: 'https://openai.com/codex/',
  },
];
// 头像组最多展示三位，后续扩展名单也不会继续拉长页脚。
const avatarPreview = contributors.slice(0, 3);
const root = ref(null);
const opened = ref(false);
const renderOpen = ref(false);
watch(
  opened,
  (value) => {
    if (value) renderOpen.value = true;
  },
  { flush: 'sync' },
);

// 收起名单；键盘关闭时把焦点还给入口。
function close(restoreFocus = false) {
  if (!opened.value) return;
  opened.value = false;
  if (restoreFocus) root.value.querySelector('summary')?.focus();
}

// 点击名单以外的区域时收起，不干扰原来的点击动作。
function onOutsidePointer(event) {
  if (!root.value?.contains(event.target)) close();
}

// Escape 只关闭当前名单，不同时触发其他弹层的关闭事件。
function onKeydown(event) {
  if (event.key !== 'Escape' || !opened.value) return;
  event.preventDefault();
  event.stopPropagation();
  close(true);
}

// Tab 离开名单时收起，保留正常的键盘焦点顺序。
function onFocusOut(event) {
  if (event.relatedTarget && !root.value?.contains(event.relatedTarget)) close();
}

onMounted(() => {
  document.addEventListener('pointerdown', onOutsidePointer);
  document.addEventListener('keydown', onKeydown, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsidePointer);
  document.removeEventListener('keydown', onKeydown, true);
});
</script>
<template>
  <details class="cf-footer-contributors" ref="root" :open="renderOpen" @focusout="onFocusOut">
    <summary
      class="cf-contributors-trigger"
      aria-controls="cf-contributors-panel"
      :aria-expanded="opened"
      @click.prevent="opened = !opened"
    >
      <span class="cf-contributors-avatars" aria-hidden="true">
        <img v-for="person in avatarPreview" :key="person.name" :src="person.image" alt="" />
      </span>
      <span data-cf-language-text>{{ t('footerContributors') }}</span>
      <span class="cf-contributors-count">{{ contributors.length }}</span>
      <InlineSvg
        class="cf-contributors-chevron"
        :source="assets.changelogChevronIcon"
        aria-hidden="true"
      />
    </summary>
    <Transition name="cf-contributors-motion" @after-leave="renderOpen = opened"
      ><div
        v-if="opened"
        id="cf-contributors-panel"
        class="cf-contributors-panel"
        role="region"
        :aria-label="t('footerContributors')"
      >
        <div class="cf-contributors-heading">
          <strong data-cf-language-text>{{ t('footerContributors') }}</strong>
          <span data-cf-language-text>{{ t('footerContributorsNote') }}</span>
        </div>
        <ul class="cf-contributors-list">
          <li v-for="person in contributors" :key="person.name">
            <a
              class="cf-contributor-link"
              :href="person.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img class="cf-contributor-image" :src="person.image" alt="" />
              <span class="cf-contributor-info">
                <span class="cf-contributor-name">{{ person.name }}</span>
                <span class="cf-contributor-role" data-cf-language-text>{{ t(person.role) }}</span>
              </span>
              <InlineSvg
                class="cf-contributor-external"
                :source="assets.brandExternalLinkIcon"
                aria-hidden="true"
              />
              <span class="cf-contributor-description" data-cf-language-text>{{
                t(person.description)
              }}</span>
            </a>
          </li>
        </ul>
      </div></Transition
    >
  </details>
</template>
<style scoped>
.cf-contributors-motion-enter-active,
.cf-contributors-motion-leave-active {
  transition: clip-path 260ms cubic-bezier(0.22, 1, 0.36, 1);
}
.cf-contributors-panel.cf-contributors-motion-enter-from,
.cf-contributors-panel.cf-contributors-motion-leave-to {
  clip-path: inset(100% 0 0 0 round 10px);
}
.cf-contributors-motion-leave-active {
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .cf-contributors-motion-enter-active,
  .cf-contributors-motion-leave-active {
    transition: none;
  }
}
.cf-footer-contributors {
  position: relative;
  flex-shrink: 0;
}

.cf-contributors-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  list-style: none;
  padding: 0;
  color: #64748b;
  font: inherit;
  line-height: 18px;
  cursor: pointer;
  border-radius: 4px;
  user-select: none;
  transition: color 0.15s ease;
}

.cf-contributors-trigger::-webkit-details-marker {
  display: none;
}

.cf-contributors-trigger:hover,
.cf-footer-contributors[open] .cf-contributors-trigger {
  color: var(--cf-control-ink);
}

.cf-contributors-trigger:focus-visible,
.cf-contributor-link:focus-visible {
  outline: 2px solid var(--cf-menu-accent);
  outline-offset: 3px;
}

.cf-contributors-avatars {
  display: inline-flex;
  align-items: center;
  padding-right: 2px;
}

.cf-contributors-avatars img {
  width: 18px;
  height: 18px;
  box-sizing: border-box;
  border: 2px solid var(--cf-card-surface);
  border-radius: 50%;
  background: var(--cf-card-surface, #fff);
  object-fit: contain;
}

.cf-contributors-avatars img + img {
  margin-left: -5px;
}

.cf-contributors-count {
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

.cf-contributors-chevron {
  display: inline-flex;
  transform: rotate(180deg);
  transition: transform 0.15s ease;
}

.cf-contributors-chevron :deep(svg) {
  width: 10px;
  height: 10px;
}

.cf-footer-contributors[open] .cf-contributors-chevron {
  transform: rotate(0deg);
}

.cf-contributors-panel {
  /* 仅收放窗口，名单文字始终保持最终位置与大小。 */
  clip-path: inset(-30px -30px -30px -30px round 10px);
  position: absolute;
  right: 0;
  bottom: calc(100% + 10px);
  z-index: 10;
  width: 320px;
  max-width: calc(100vw - 80px);
  padding: 10px;
  box-sizing: border-box;
  border: 1px solid var(--cf-surface-border, #e2e8f0);
  border-radius: 10px;
  background: var(--cf-card-surface, #fff);
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.13);
  color: #334155;
  font-size: 12px;
  line-height: 1.5;
  user-select: text;
}

.cf-contributors-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 6px 8px;
  border-bottom: 1px solid var(--cf-surface-border);
}

.cf-contributors-heading span {
  color: #94a3b8;
  font-size: 10px;
}

.cf-contributors-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 280px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.cf-contributors-list li {
  margin: 0;
  padding: 0;
}

/* 覆盖原站的 a:link/a:visited，但只影响这份名单内的链接。 */
.cf-footer-contributors .cf-contributor-link,
.cf-footer-contributors .cf-contributor-link:link,
.cf-footer-contributors .cf-contributor-link:visited {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 12px;
  align-items: center;
  gap: 4px 10px;
  padding: 10px 8px;
  border-radius: 7px;
  color: #334155;
  text-decoration: none;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.cf-footer-contributors .cf-contributor-link:hover,
.cf-footer-contributors .cf-contributor-link:active,
.cf-footer-contributors .cf-contributor-link:focus-visible {
  color: var(--cf-control-ink);
  background: var(--cf-control-active);
}

.cf-contributor-link:hover .cf-contributor-external,
.cf-contributor-link:focus-visible .cf-contributor-external {
  color: var(--cf-control-ink);
}

.cf-contributor-image {
  grid-column: 1;
  grid-row: 1 / span 2;
  align-self: stretch;
  width: 44px;
  height: 100%;
  min-height: 44px;
  border-radius: 8px;
  object-fit: contain;
}

.cf-contributor-info {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 2px 8px;
  min-width: 0;
}

.cf-contributor-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.cf-contributor-role {
  color: #94a3b8;
  font-size: 11px;
}

.cf-contributor-description {
  grid-column: 2 / -1;
  grid-row: 2;
  min-width: 0;
  color: #64748b;
  font-size: 11px;
  line-height: 1.6;
  overflow-wrap: break-word;
}

.cf-contributor-external {
  grid-column: 3;
  grid-row: 1;
  display: inline-flex;
  color: #94a3b8;
}

.cf-contributor-external :deep(svg) {
  width: 12px;
  height: 12px;
}
</style>
