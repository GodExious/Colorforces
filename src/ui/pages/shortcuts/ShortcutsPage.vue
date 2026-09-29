<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { appSettings, saveSettings } from '../../../settings.js';
import { translate as t } from '../../../i18n/index.js';
import * as assets from '../../../assets/index.js';
import InlineSvg from '../../components/icons/InlineSvg/InlineSvg.vue';
import { DEFAULT_SETTINGS } from '../../../config/defaults.js';
import { isShiftActive, CODE_TO_BASE_KEY } from '../../../utils/shortcuts.js';
import { tooltip } from '../../components/tooltips/FloatingTooltip/FloatingTooltip.vue';
import ShortcutKeys from './components/ShortcutKeys/ShortcutKeys.vue';
const props = defineProps({ active: Boolean });
const groups = [
  {
    id: 'general',
    labelKey: 'tabGeneral',
    items: [
      { key: 'hideTags', titleKey: 'shortcutHideTagsTitle', descKey: 'shortcutHideTagsDesc' },
      {
        key: 'menuLanguage',
        titleKey: 'shortcutMenuLanguageTitle',
        descKey: 'shortcutMenuLanguageDesc',
      },
    ],
  },
  {
    id: 'appearance',
    labelKey: 'tabAppearance',
    items: [
      {
        key: 'acHighlight',
        titleKey: 'shortcutAcHighlightTitle',
        descKey: 'shortcutAcHighlightDesc',
      },
      { key: 'langIcon', titleKey: 'shortcutLangIconTitle', descKey: 'shortcutLangIconDesc' },
      {
        key: 'shortVerdict',
        titleKey: 'shortcutShortVerdictTitle',
        descKey: 'shortcutShortVerdictDesc',
      },
      { key: 'timeFormat', titleKey: 'shortcutTimeFormatTitle', descKey: 'shortcutTimeFormatDesc' },
    ],
  },
  {
    id: 'ratings',
    labelKey: 'tabRatings',
    items: [
      {
        key: 'clistEnabled',
        titleKey: 'shortcutClistEnabledTitle',
        descKey: 'shortcutClistEnabledDesc',
      },
      {
        key: 'colorRatings',
        titleKey: 'shortcutColorRatingsTitle',
        descKey: 'shortcutColorRatingsDesc',
      },
      {
        key: 'displayStyle',
        titleKey: 'shortcutDisplayStyleTitle',
        descKey: 'shortcutDisplayStyleDesc',
      },
    ],
  },
  {
    id: 'user',
    labelKey: 'tabUser',
    items: [
      { key: 'userAvatar', titleKey: 'shortcutUserAvatarTitle', descKey: 'shortcutUserAvatarDesc' },
    ],
  },
];
const recording = ref(null);
const draftCombo = ref('');
const conflictingKeys = ref([]);
let release;
// 仅在标题被截断时显示完整标题。
function showOverflowTip(event) {
  const target = event.currentTarget;
  if (target.scrollWidth > target.clientWidth) tooltip.show(target, target.textContent);
}
// 结束录制并释放全局捕获监听。
function stopRecording() {
  release?.();
  release = null;
  recording.value = null;
  draftCombo.value = '';
  conflictingKeys.value = [];
  tooltip.hide();
}
// 冲突输入只暂存和标红；绑定无冲突后才保存，绝不清空另一项。
function assign(key, combo) {
  draftCombo.value = combo;
  conflictingKeys.value = Object.keys(appSettings.shortcuts).filter(
    (other) =>
      other !== key && combo && appSettings.shortcuts[other].toLowerCase() === combo.toLowerCase(),
  );
  if (conflictingKeys.value.length) return false;
  appSettings.shortcuts[key] = combo;
  saveSettings();
  return true;
}
// 录制原版支持的修饰键、字符键和数字小键盘。
function record(key, button) {
  const same = recording.value === key;
  stopRecording();
  if (same) return;
  recording.value = key;
  draftCombo.value = appSettings.shortcuts[key];
  const keydown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      stopRecording();
      return;
    }
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
    const parts = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (isShiftActive(event)) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');
    const main =
      CODE_TO_BASE_KEY[event.code] ||
      (event.code?.startsWith('Key')
        ? event.code.slice(3).toUpperCase()
        : event.code?.startsWith('Digit')
          ? event.code.slice(5)
          : event.key === ' '
            ? 'Space'
            : event.key.toUpperCase());
    parts.push(main);
    if (assign(key, parts.join('+'))) stopRecording();
  };
  const outside = (event) => {
    if (!button.contains(event.target)) stopRecording();
  };
  window.addEventListener('keydown', keydown, true);
  window.addEventListener('blur', stopRecording);
  document.addEventListener('mousedown', outside, true);
  release = () => {
    window.removeEventListener('keydown', keydown, true);
    window.removeEventListener('blur', stopRecording);
    document.removeEventListener('mousedown', outside, true);
  };
}
// 清空或恢复一个快捷键。
function clearShortcut(key) {
  stopRecording();
  assign(key, '');
}
// 单项恢复默认值同样检查冲突，允许继续录制或退出还原。
function resetShortcut(key, button) {
  stopRecording();
  record(key, button.closest('.cf-shortcut-controls').querySelector('.cf-shortcut-key-btn'));
  if (assign(key, DEFAULT_SETTINGS.shortcuts[key] || '')) stopRecording();
}
// 恢复全部原版快捷键。
function resetAll() {
  stopRecording();
  Object.assign(appSettings.shortcuts, DEFAULT_SETTINGS.shortcuts);
  saveSettings();
}
watch(() => props.active, stopRecording);
onBeforeUnmount(stopRecording);
</script>
<template>
  <div class="cf-tab-panel">
    <div class="cf-shortcuts-header">
      <h3 class="cf-shortcuts-title">
        <span class="cf-section-title-icon"
          ><inline-svg v-bind:source="assets.menuShortcutsIcon"></inline-svg></span
        ><span class="cf-shortcuts-title-text">{{ t('shortcutsSectionTitle') }}</span>
      </h3>
      <p class="cf-shortcuts-subtitle" v-text="t().shortcutsSectionSubtitle"></p>
      <p class="cf-shortcuts-subtitle" v-text="t().shortcutsSectionTip"></p>
      <div class="cf-shortcuts-note">
        <span class="cf-shortcuts-note-icon"
          ><inline-svg v-bind:source="assets.shortcutInfoIcon"></inline-svg
        ></span>
        <div class="cf-shortcuts-note-body">
          <strong class="cf-shortcuts-note-label" v-text="t('shortcutsSectionNoteLabel')"></strong
          ><span class="cf-shortcuts-note-text">{{ t('shortcutsSectionNote') }}</span>
        </div>
      </div>
    </div>
    <div class="cf-shortcuts-list">
      <div class="cf-shortcut-group" v-for="group in groups" v-bind:key="group.id">
        <div class="cf-shortcut-group-header">
          <span class="cf-shortcut-group-icon"
            ><inline-svg v-bind:source="assets.TAB_ICONS[group.id]"></inline-svg></span
          ><span class="cf-shortcut-group-title" v-text="t(group.labelKey)"></span>
        </div>
        <div class="cf-shortcut-group-box">
          <div class="cf-shortcut-item" v-for="item in group.items" v-bind:key="item.key">
            <div
              class="cf-shortcut-title"
              v-text="t(item.titleKey)"
              v-on:mouseenter="showOverflowTip"
              v-on:mouseleave="tooltip.hide"
            ></div>
            <div class="cf-shortcut-controls">
              <button
                type="button"
                class="cf-shortcut-key-btn"
                v-bind:data-tooltip="t('shortcutEditTooltip')"
                v-bind:class="{
                  recording: recording === item.key,
                  'has-conflict':
                    conflictingKeys.length &&
                    (recording === item.key || conflictingKeys.includes(item.key)),
                }"
                v-bind:aria-pressed="recording === item.key"
                v-bind:aria-invalid="
                  !!conflictingKeys.length &&
                  (recording === item.key || conflictingKeys.includes(item.key))
                "
                v-on:click.stop="record(item.key, $event.currentTarget)"
              >
                <shortcut-keys
                  v-bind:combo="
                    recording === item.key ? draftCombo : appSettings.shortcuts[item.key]
                  "
                  v-bind:recording="recording === item.key && !conflictingKeys.length"
                ></shortcut-keys></button
              ><button
                type="button"
                class="cf-shortcut-clear-btn"
                v-bind:data-tooltip="t('shortcutClearBtn')"
                v-on:click="clearShortcut(item.key)"
              >
                <inline-svg v-bind:source="assets.shortcutClearIcon"></inline-svg></button
              ><button
                type="button"
                class="cf-shortcut-reset-btn"
                v-bind:data-tooltip="t('shortcutResetBtn')"
                v-on:click="resetShortcut(item.key, $event.currentTarget)"
              >
                <inline-svg v-bind:source="assets.shortcutResetIcon"></inline-svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <button type="button" class="cf-shortcut-reset-all-btn" v-on:click="resetAll">
      <inline-svg v-bind:source="assets.shortcutResetAllIcon"></inline-svg
      ><span class="btn-text">{{ t('shortcutResetAllBtn') }}</span>
    </button>
  </div>
</template>
<style>
.cf-shortcuts-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cf-shortcuts-header {
  margin-bottom: 2px;
}

.cf-shortcuts-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 4px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cf-shortcuts-subtitle {
  font-size: 12px;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

.cf-shortcuts-subtitle + .cf-shortcuts-subtitle {
  margin-top: 8px;
}

.cf-shortcuts-note {
  --cf-note-ink: color-mix(in srgb, var(--cf-menu-accent) 52%, #172b39);
  margin-top: 10px;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--cf-menu-accent) 11%, white);
  border: 1px solid var(--cf-surface-border);
  border-left: 3.5px solid var(--cf-menu-accent);
  border-radius: 6px;
  display: flex;
  align-items: flex-start;
  gap: 7px;
  box-sizing: border-box;
  font-size: 12px;
  line-height: 1.5;
}

.cf-shortcuts-note-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  color: var(--cf-note-ink);
  flex-shrink: 0;
  margin-top: 1.5px;
}

.cf-shortcuts-note-icon svg {
  width: 15px;
  height: 15px;
  display: block;
}

.cf-shortcuts-note-body {
  flex: 1 1 auto;
  color: var(--cf-note-ink);
}

.cf-shortcuts-note-label {
  font-weight: 700;
  color: var(--cf-note-ink);
  margin-right: 2px;
}

.cf-shortcuts-note-text {
  color: var(--cf-note-ink);
  font-weight: 500;
}

.cf-shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cf-shortcut-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cf-shortcut-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  padding-left: 6px;
  user-select: none;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.cf-shortcut-group-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: #1677ff;
  flex-shrink: 0;
}

.cf-shortcut-group-icon svg {
  width: 14px;
  height: 14px;
  display: block;
}

.cf-shortcut-group-box {
  background: var(--cf-control-surface, #f8fafc);
  border-radius: 10px;
  padding: 3px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--cf-surface-border);
}

.cf-shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
  padding: 3px 8px;
  border-radius: 6px;
  background: transparent;
  gap: 10px;
  box-sizing: border-box;
  overflow: hidden;
  transition:
    background-color 180ms ease,
    box-shadow 180ms ease;
}

.cf-shortcut-item:hover,
.cf-shortcut-item:focus-within {
  background: var(--cf-control-active);
  box-shadow: inset 0 0 0 1px var(--cf-surface-border);
}

.cf-shortcut-title {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1 1 auto;
  min-width: 0;
  margin-right: 4px;
  cursor: default;
}

.cf-shortcut-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-shrink: 0;
  margin-left: auto;
}

.cf-shortcut-key-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  white-space: nowrap;
  gap: 3px;
  padding: 2px 4px;
  min-height: 28px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
  color: #0f172a;
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    color 180ms ease;
  user-select: none;
  box-sizing: border-box;
  outline: none;
  flex-shrink: 0;
}

.cf-shortcut-key-btn:hover {
  background: rgba(241, 245, 249, 0.7);
}

.cf-shortcut-key-btn.recording {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #1d4ed8;
}

/* 光晕仅改变透明度，不循环修改边框和阴影尺寸。 */
.cf-shortcut-key-btn::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
  opacity: 0;
  pointer-events: none;
  transition: opacity 180ms ease;
}

.cf-shortcut-key-btn.recording::after {
  opacity: 0.5;
  animation: cf-pulse-recording 1.8s ease-in-out infinite;
}

.cf-shortcut-key-btn.has-conflict {
  background: #fff1f2;
  border-color: #e65b70;
  color: #bd2542;
}

.cf-shortcut-key-btn.has-conflict::after {
  box-shadow: 0 0 0 3px #e65b7026;
}

.cf-shortcut-key-btn.has-conflict kbd {
  color: #bd2542;
  background: #ffe4e9;
  border-color: #f0a6b3;
  box-shadow: 0 1px 0 #f0a6b3;
}

@keyframes cf-pulse-recording {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 0.85;
  }
}

.cf-shortcut-key-btn kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 22px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #334155;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid #cbd5e1;
  border-bottom: 2px solid #94a3b8;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  box-sizing: border-box;
  transition:
    transform 150ms ease,
    border-color 150ms ease,
    color 150ms ease,
    box-shadow 150ms ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.cf-shortcut-key-btn:hover kbd {
  border-color: #93c5fd;
  border-bottom-color: #3b82f6;
  color: #1d4ed8;
  background: linear-gradient(180deg, #ffffff 0%, #eff6ff 100%);
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.15);
  transform: translateY(-1px);
}

.cf-shortcut-key-btn:active kbd {
  transform: translateY(1px);
  box-shadow: none;
}

.cf-shortcut-key-btn.has-conflict:hover kbd {
  color: #bd2542;
  background: #ffe4e9;
  border-color: #f0a6b3;
  box-shadow: 0 1px 0 #f0a6b3;
}

.cf-shortcut-plus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: #94a3b8;
  margin: 0 0.5px;
  user-select: none;
  flex-shrink: 0;
}

.cf-shortcut-key-btn .cf-shortcut-empty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px dashed #cbd5e1;
  background: #f8fafc;
  color: #94a3b8;
  font-size: 11px;
  line-height: 1;
  box-sizing: border-box;
  font-style: normal;
  font-weight: 500;
  transition: all 0.15s ease;
}

.cf-shortcut-key-btn:hover .cf-shortcut-empty {
  border-color: #94a3b8;
  color: #475569;
  background: #f1f5f9;
}

.cf-shortcut-clear-btn,
.cf-shortcut-reset-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid transparent;
  background: transparent;
  color: #94a3b8;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
  box-sizing: border-box;
  padding: 0;
}

.cf-shortcut-clear-btn:hover {
  background: #fef2f2;
  color: #ef4444;
  border-color: #fee2e2;
}

.cf-shortcut-reset-btn:hover {
  background: var(--cf-control-active);
  color: var(--cf-control-ink);
  border-color: var(--cf-surface-border);
}

.cf-shortcut-reset-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 6px 12px;
  border: 1px solid var(--cf-surface-border, #e2e8f0);
  background: var(--cf-control-surface, #f8fafc);
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  align-self: flex-start;
  transition: all 0.15s ease;
}

.cf-shortcut-reset-all-btn:hover {
  background: var(--cf-card-surface, #fff);
  color: var(--cf-control-ink);
  border-color: var(--cf-surface-border);
}

@media (prefers-reduced-motion: reduce) {
  .cf-shortcut-item,
  .cf-shortcut-key-btn,
  .cf-shortcut-key-btn::after,
  .cf-shortcut-key-btn kbd {
    animation: none;
    transition: none;
  }
}
</style>
