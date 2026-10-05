<script>
import * as cfAssets from '../../../../../assets/index.js';
import InlineSvg from '../../../../components/icons/InlineSvg/InlineSvg.vue';
import { shallowRef } from 'vue';
const request = shallowRef(null);
// 提供同文件调用入口，查看器始终只保留一个实例。
// title 传文案键名，options.keyLabel 传「存储键 → 说明文字」的函数：两者都在渲染时现取，切换语言后跟着变。
// options.preview 可选，给个别键自己的缩略预览，见 json-preview.js 的 buildPreview；复制不受它影响。
export function showStorageJsonModal(title, keys, getContent, options = {}) {
  request.value = { title, keys: [...keys], getContent, ...options };
}
</script>
<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { translate as t } from '../../../../../i18n/index.js';
import { appSettings } from '../../../../../settings.js';
import { appStorage } from '../../../../../storage/gm.js';
import { preventScrollChaining } from '../../../../../utils/scroll.js';
import { backdropClose } from '../../../../../utils/backdrop.js';
import { buildPreview, stringifyStored } from './json-preview.js';
import DialogTransition from '../../../../components/transitions/DialogTransition/DialogTransition.vue';
// 保留离场期间的标题、选项卡和预览，关闭后不重新生成空文案。
const displayed = shallowRef(request.value);
const activeKey = ref(''),
  preview = ref({ highlightedHtml: '', badgeText: '' }),
  overlay = ref(null),
  pre = ref(null),
  copied = ref(false);
let keyDataCache = new Map(),
  frame,
  timer;
// 关闭时释放键切换任务、复制提示和缓存。
function close() {
  request.value = null;
  keyDataCache.clear();
  cancelAnimationFrame(frame);
  clearTimeout(timer);
}
// 点遮罩关闭；在预览里拖选文字、拖到弹窗外才松开不算。
const backdrop = backdropClose(close);
// 切换预览时只解析当前键，避免大缓存导致菜单卡顿。keepScroll 用于原地重建预览，不把滚动位置拉回顶部。
function selectKey(key, initial = false, keepScroll = false) {
  activeKey.value = key;
  cancelAnimationFrame(frame);
  const render = () => {
    if (!request.value) return;
    if (!key) {
      preview.value = {
        highlightedHtml:
          '<span style="color:var(--cf-gray-500);font-style:italic;">' +
          t('storageEmptyData') +
          '</span>',
        badgeText: t('storageItemCount', 0) + ' · 0 B',
      };
      return;
    }
    if (!keyDataCache.has(key))
      keyDataCache.set(key, buildPreview(key, request.value.getContent, request.value.preview));
    preview.value = keyDataCache.get(key);
    if (keepScroll) return;
    nextTick(() => {
      if (pre.value) pre.value.scrollTop = 0;
    });
  };
  if (initial) render();
  else frame = requestAnimationFrame(render);
}
// 复制完整数据，而不是经过裁剪和着色的预览。
function copyFull() {
  const activeKeyValue = activeKey.value;
  const getContentForKeyFn = request.value.getContent;
  let fullJsonStr = '';
  try {
    let contentToExport;
    if (
      keyDataCache.has(activeKeyValue) &&
      keyDataCache.get(activeKeyValue).content !== undefined
    ) {
      contentToExport = keyDataCache.get(activeKeyValue).content;
    } else if (typeof getContentForKeyFn === 'function') {
      contentToExport = getContentForKeyFn(activeKeyValue);
    } else {
      contentToExport = appStorage.getJSON(activeKeyValue, null);
    }
    const exportObj = {
      [activeKeyValue]: contentToExport !== undefined ? contentToExport : null,
    };
    fullJsonStr = stringifyStored(activeKeyValue, exportObj);
  } catch (e) {
    fullJsonStr = '{}';
  }

  navigator.clipboard
    .writeText(fullJsonStr)
    .then(() => {
      copied.value = true;
      clearTimeout(timer);
      timer = setTimeout(() => (copied.value = false), 2000);
    })
    .catch((error) => console.error('Failed to copy JSON', error));
}
function onKey(event) {
  if (request.value && event.key === 'Escape') close();
}
watch(request, (value) => {
  if (value) {
    displayed.value = value;
    keyDataCache.clear();
    copied.value = false;
    selectKey(value.keys[0] || '', true);
  }
});
// 切换语言后原地重建当前预览：项数徽标和截断提示是生成预览时写进去的文字。
watch(
  () => appSettings.general.lang,
  () => {
    if (!request.value) return;
    keyDataCache.clear();
    selectKey(activeKey.value, true, true);
  },
);
watch(overlay, (node) => {
  if (node) preventScrollChaining(node);
});
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  close();
});
</script>
<template>
  <Teleport to="body"
    ><DialogTransition
      ><div
        class="cf-clist-modal-overlay cf-aurora-dialog cf-storage-json-modal"
        v-if="request"
        ref="overlay"
        v-on="backdrop"
      >
        <div class="cf-clist-modal-card cf-aurora-card cf-storage-json-card">
          <div class="cf-clist-modal-header">
            <div class="cf-clist-modal-title">
              <span class="cf-modal-title-icon cf-aurora-emblem"
                ><InlineSvg :source="cfAssets.jsonDocumentIcon"
              /></span>
              <span>{{ t(displayed.title) }}</span>
              <span class="cf-storage-modal-badge">{{ preview.badgeText }}</span>
            </div>
            <button type="button" class="cf-modal-close-btn cf-aurora-close" @click="close">
              ×
            </button>
          </div>
          <div class="cf-clist-modal-body cf-storage-json-body">
            <div class="cf-storage-json-toolbar">
              <div class="cf-storage-json-key">
                <span class="cf-storage-json-key-label">{{ t('storageKeyPrefix') }}:</span>{{ ' ' }}
                <code class="cf-storage-active-key">{{ activeKey || '(none)' }}</code>
              </div>
              <button
                type="button"
                class="cf-storage-copy-json-btn cf-aurora-btn"
                :class="{ 'is-copied': copied }"
                @click="copyFull"
              >
                <InlineSvg :source="cfAssets.jsonCopyIcon" />
                <span class="copy-btn-text">{{
                  t(copied ? 'storageCopiedBtn' : 'storageCopyBtn')
                }}</span>
              </button>
            </div>
            <div class="cf-storage-key-buttons" v-show="displayed.keys.length">
              <button
                type="button"
                class="cf-storage-key-tab-btn"
                v-for="key in displayed.keys"
                :key="key"
                :data-key="key"
                @click="selectKey(key)"
                :class="{ active: activeKey === key }"
              >
                {{ displayed.keyLabel?.(key) || key }}
              </button>
            </div>
            <div class="cf-storage-json-view">
              <pre class="cf-storage-json-pre" v-html="preview.highlightedHtml" ref="pre"></pre>
            </div>
          </div>
          <div class="cf-clist-modal-footer cf-storage-json-footer">
            <span class="cf-storage-json-tip">{{ t('storageViewFooterTip') }}</span>
            <button type="button" class="cf-aurora-btn cf-aurora-btn--primary" @click="close">
              {{ t('storageCloseBtn') }}
            </button>
          </div>
        </div>
      </div></DialogTransition
    ></Teleport
  >
</template>
<style>
/* 数据查看弹窗：外壳与配色来自幻彩主题，这里只写本弹窗特有的布局与数据区。 */
.cf-clist-modal-card.cf-storage-json-card {
  width: 640px;
  max-height: 85vh;
}

.cf-storage-modal-badge {
  margin-left: 4px;
  padding: 2px 8px;
  border: 1px solid var(--cf-aurora-glass-border);
  border-radius: 999px;
  background: #ffffff85;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-medium);
  line-height: 1.5;
}

.cf-clist-modal-body.cf-storage-json-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding-top: 14px;
  padding-bottom: 16px;
}

.cf-storage-json-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-sm);
}

.cf-storage-json-key {
  flex: 1;
  min-width: 0;
  line-height: 1.6;
  word-break: break-all;
}

.cf-storage-json-key-label {
  margin-right: 6px;
  color: var(--cf-control-ink);
  font-weight: var(--cf-font-weight-semibold);
}

.cf-storage-active-key {
  padding: 2px 8px;
  border: 1px solid var(--cf-aurora-glass-border);
  border-radius: var(--cf-radius-sm);
  background: #ffffff99;
  color: #5565b0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--cf-font-size-sm);
  font-weight: var(--cf-font-weight-semibold);
}

.cf-aurora-btn.cf-storage-copy-json-btn {
  flex-shrink: 0;
  align-self: flex-start;
  padding: 4px 12px;
  font-size: var(--cf-font-size-sm);
}

.cf-storage-copy-json-btn svg {
  width: 13px;
  height: 13px;
}

.cf-aurora-btn.cf-storage-copy-json-btn.is-copied,
.cf-aurora-btn.cf-storage-copy-json-btn.is-copied:hover {
  border-color: #a9dcc6;
  background: #e6f7efd9;
  color: #2f9a6b;
}

.cf-storage-copy-json-btn .copy-btn-text {
  display: inline-block;
  white-space: nowrap;
}

.cf-storage-key-buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

/* 数据项页签：未选中是半透明白，选中是与主按钮同系的蓝紫渐变。 */
.cf-storage-key-tab-btn {
  padding: 3px 10px;
  border: 1px solid #cdd5e8;
  border-radius: var(--cf-radius-sm);
  background: #ffffff8f;
  color: var(--cf-control-ink);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--cf-font-size-sm);
  font-weight: var(--cf-font-weight-medium);
  line-height: 1.4;
  cursor: pointer;
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
}

.cf-storage-key-tab-btn:not(.active):hover {
  border-color: #b4bfdc;
  background: #ffffffe0;
}

.cf-storage-key-tab-btn.active {
  border-color: #8590cf;
  background: linear-gradient(135deg, #8b9ddd, #9c8fd6);
  color: #fff;
  font-weight: var(--cf-font-weight-semibold);
}

.cf-storage-json-view {
  position: relative;
  flex: 1;
  min-height: 0;
}

.cf-storage-json-pre {
  box-sizing: border-box;
  max-height: 50vh;
  margin: 0;
  padding: 12px 14px;
  overflow: auto;
  border: 1px solid var(--cf-guide-code-border);
  border-radius: var(--cf-radius-xl);
  background: var(--cf-guide-code-bg);
  box-shadow: inset 0 1px 0 #ffffff14;
  color: #cfd8f2;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--cf-font-size-sm);
  line-height: 1.5;
  white-space: pre;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #5a6390 transparent;
}

.cf-storage-json-pre::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}

.cf-storage-json-pre::-webkit-scrollbar-track,
.cf-storage-json-pre::-webkit-scrollbar-corner {
  background: transparent;
}

.cf-storage-json-pre::-webkit-scrollbar-thumb {
  border-radius: var(--cf-radius-xs);
  background: #5a6390;
}

.cf-storage-json-pre::-webkit-scrollbar-thumb:hover {
  background: #6d77a8;
}

/* 语法着色取与幻彩底色相称的粉彩，在深靛蓝底上保持可读。 */
.cf-json-key {
  color: #9db8ff;
  font-weight: var(--cf-font-weight-medium);
}

.cf-json-string {
  color: #8fe0c2;
}

.cf-json-number {
  color: #f5c08a;
  font-weight: var(--cf-font-weight-medium);
}

.cf-json-boolean {
  color: #d4a8f5;
  font-weight: var(--cf-font-weight-semibold);
}

.cf-json-null {
  color: #9aa3c4;
  font-style: italic;
}

.cf-json-punct {
  color: #9aa3c4;
}

.cf-clist-modal-footer.cf-storage-json-footer {
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.cf-storage-json-tip {
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
}
</style>
