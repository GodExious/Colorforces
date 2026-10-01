<script>
import * as cfAssets from '../../../../../assets/index.js';
import InlineSvg from '../../../../components/icons/InlineSvg/InlineSvg.vue';
import { shallowRef } from 'vue';
const request = shallowRef(null);
// 提供同文件调用入口，查看器始终只保留一个实例。
export function showStorageJsonModal(title, keys, getContent, options = {}) {
  request.value = { title, keys: [...keys], getContent, ...options };
}
// 将多个存储键作为一份快照展示，不合并或写入底层存储。
export function showStorageJsonDocument(title, content, bytes) {
  request.value = { title, keys: [], document: { content, bytes } };
}
</script>
<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { translate as t } from '../../../../../i18n/index.js';
import { appStorage } from '../../../../../storage/gm.js';
import { PARALLEL_CONTESTS_KEY } from '../../../../../storage/keys.js';
import { preventScrollChaining } from '../../../../../utils/scroll.js';
import { buildPreview } from './json-preview.js';
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
// 切换预览时只解析当前键，避免大缓存导致菜单卡顿。
function selectKey(key, initial = false) {
  activeKey.value = key;
  cancelAnimationFrame(frame);
  const render = () => {
    if (!request.value) return;
    if (request.value.document) {
      const { content, bytes } = request.value.document;
      preview.value = buildPreview(null, () => content, bytes);
      return;
    }
    if (!key) {
      preview.value = {
        highlightedHtml:
          '<span style="color:#64748b;font-style:italic;">' + t('storageEmptyData') + '</span>',
        badgeText: t('storageItemCount', 0) + ' · 0 B',
      };
      return;
    }
    if (!keyDataCache.has(key)) keyDataCache.set(key, buildPreview(key, request.value.getContent));
    preview.value = keyDataCache.get(key);
    nextTick(() => {
      if (pre.value) pre.value.scrollTop = 0;
    });
  };
  if (initial) render();
  else frame = requestAnimationFrame(render);
}
// 关闭查看器后交给原确认流程清理当前分类，不静默扩大清理范围。
function clearActive() {
  const action = request.value?.onClear,
    key = activeKey.value;
  close();
  action?.(key);
}
// 复制完整数据，而不是经过裁剪和着色的预览。
function copyFull() {
  const activeKeyValue = activeKey.value;
  const getContentForKeyFn = request.value.getContent;
  let fullJsonStr = '';
  try {
    let contentToExport;
    if (request.value.document) {
      contentToExport = preview.value.content;
    } else if (
      keyDataCache.has(activeKeyValue) &&
      keyDataCache.get(activeKeyValue).content !== undefined
    ) {
      contentToExport = keyDataCache.get(activeKeyValue).content;
    } else if (typeof getContentForKeyFn === 'function') {
      contentToExport = getContentForKeyFn(activeKeyValue);
    } else {
      contentToExport = appStorage.getJSON(activeKeyValue, null);
    }
    const exportObj = request.value.document
      ? contentToExport
      : {
          [activeKeyValue]: contentToExport !== undefined ? contentToExport : null,
        };
    fullJsonStr = JSON.stringify(exportObj, null, 2);
    if (activeKeyValue === PARALLEL_CONTESTS_KEY || activeKeyValue === 'cf_parallel_contests') {
      fullJsonStr = fullJsonStr.replace(/\[\s*([-\d\s,]+?)\s*\]/g, (match, nums) => {
        const compact = nums
          .split(/\s*,\s*/)
          .map((s) => s.trim())
          .filter(Boolean)
          .join(', ');
        return `[${compact}]`;
      });
    }
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
        class="cf-clist-modal-overlay cf-storage-json-modal"
        v-if="request"
        ref="overlay"
        @click.self="close"
      >
        <div class="cf-clist-modal-card" style="width: 640px; max-height: 85vh">
          <div class="cf-clist-modal-header" style="padding: 12px 18px">
            <div class="cf-clist-modal-title" style="font-size: 14.5px">
              <InlineSvg :source="cfAssets.jsonDocumentIcon" />
              <span>{{ displayed.title }}</span>
              <span
                class="cf-storage-modal-badge"
                style="
                  font-size: 11px;
                  font-weight: 500;
                  color: #64748b;
                  background: #f1f5f9;
                  padding: 2px 7px;
                  border-radius: 4px;
                  border: 1px solid #e2e8f0;
                  margin-left: 6px;
                "
                >{{ preview.badgeText }}</span
              >
            </div>
            <button
              type="button"
              class="cf-modal-close-btn"
              style="
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                color: #94a3b8;
                line-height: 1;
                padding: 2px 4px;
                transition: color 0.15s ease;
                flex-shrink: 0;
              "
              @click="close"
            >
              ×
            </button>
          </div>
          <div
            class="cf-clist-modal-body"
            style="
              padding: 14px 18px;
              display: flex;
              flex-direction: column;
              gap: 10px;
              flex: 1;
              min-height: 0;
            "
          >
            <div
              style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 14px;
                font-size: 11.5px;
                color: #64748b;
              "
            >
              <div style="flex: 1; min-width: 0; line-height: 1.6; word-break: break-all">
                <template v-if="!displayed.document">
                  <span style="font-weight: 600; margin-right: 6px; color: #334155"
                    >{{ t('storageKeyPrefix') }}:</span
                  >{{ ' ' }}
                  <code
                    class="cf-storage-active-key"
                    style="
                      background: #f1f5f9;
                      padding: 2px 7px;
                      border-radius: 4px;
                      color: #0284c7;
                      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                      font-size: 11.5px;
                      font-weight: 600;
                      border: 1px solid #e2e8f0;
                    "
                    >{{ activeKey || '(none)' }}</code
                  >
                </template>
              </div>
              <button
                type="button"
                class="cf-storage-copy-json-btn"
                @click="copyFull"
                :style="
                  copied ? { background: '#ecfdf5', borderColor: '#a7f3d0', color: '#059669' } : {}
                "
              >
                <InlineSvg :source="cfAssets.jsonCopyIcon" />
                <span class="copy-btn-text">{{
                  t(copied ? 'storageCopiedBtn' : 'storageCopyBtn')
                }}</span>
              </button>
            </div>
            <div
              class="cf-storage-key-buttons"
              style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 2px"
              v-show="displayed.keys.length"
            >
              <button
                type="button"
                class="cf-storage-key-tab-btn"
                style="
                  padding: 3px 9px;
                  border-radius: 5px;
                  font-size: 11.5px;
                  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                  cursor: pointer;
                  transition: 0.15s;
                  border: 1px solid rgb(2, 132, 199);
                  background: rgb(2, 132, 199);
                  color: rgb(255, 255, 255);
                  line-height: 1.4;
                  font-weight: 600;
                "
                v-for="key in displayed.keys"
                :key="key"
                :data-key="key"
                @click="selectKey(key)"
                :class="{ active: activeKey === key }"
                :style="{
                  background: activeKey === key ? '#0284c7' : '#f8fafc',
                  color: activeKey === key ? '#ffffff' : '#334155',
                  borderColor: activeKey === key ? '#0284c7' : '#cbd5e1',
                  fontWeight: activeKey === key ? '600' : '500',
                }"
              >
                {{ displayed.keyLabels?.[key] || key }}
              </button>
              <button
                v-if="displayed.onClear"
                type="button"
                class="cf-storage-btn btn-clear"
                @click="clearActive"
              >
                {{ t('storageClearSection') }}
              </button>
            </div>
            <div style="flex: 1; min-height: 0; position: relative">
              <pre
                class="cf-storage-json-pre"
                style="
                  margin: 0;
                  padding: 12px 14px;
                  background: #0f172a;
                  color: #cbd5e1;
                  border-radius: 8px;
                  font-size: 11.5px;
                  line-height: 1.5;
                  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                  overflow: auto;
                  overscroll-behavior: contain;
                  max-height: 50vh;
                  border: 1px solid #1e293b;
                  box-sizing: border-box;
                  white-space: pre;
                "
                v-html="preview.highlightedHtml"
                ref="pre"
              ></pre>
            </div>
          </div>
          <div
            class="cf-clist-modal-footer"
            style="
              padding: 10px 18px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              background: #f8fafc;
              border-top: 1px solid #e2e8f0;
            "
          >
            <span style="font-size: 11px; color: #94a3b8">{{ t('storageViewFooterTip') }}</span>
            <button
              type="button"
              class="cf-guide-confirm-btn"
              style="
                background: #0284c7;
                color: #fff;
                border: 1px solid #0284c7;
                border-radius: 6px;
                padding: 5px 16px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
              "
              @click="close"
            >
              {{ t('storageCloseBtn') }}
            </button>
          </div>
        </div>
      </div></DialogTransition
    ></Teleport
  >
</template>
<style>
.cf-storage-key-tab-btn:not(.active):hover {
  background: #f1f5f9 !important;
  border-color: #94a3b8 !important;
}
</style>

<style>
.cf-storage-json-pre {
  scrollbar-width: thin;
  scrollbar-color: #334155 #0f172a;
  overscroll-behavior: contain;
}

.cf-storage-json-pre::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}

.cf-storage-json-pre::-webkit-scrollbar-track {
  background: #0f172a;
  border-radius: 6px;
}

.cf-storage-json-pre::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
  border: 1px solid #1e293b;
  transition: background 0.15s ease;
}

.cf-storage-json-pre::-webkit-scrollbar-thumb:hover {
  background: #475569;
}

.cf-storage-json-pre::-webkit-scrollbar-corner {
  background: #0f172a;
}

.cf-json-key {
  color: #38bdf8;
  font-weight: 500;
}

.cf-json-string {
  color: #4ade80;
}

.cf-json-number {
  color: #fb923c;
  font-weight: 500;
}

.cf-json-boolean {
  color: #c084fc;
  font-weight: 600;
}

.cf-json-null {
  color: #94a3b8;
  font-style: italic;
}

.cf-json-punct {
  color: #94a3b8;
}

.cf-storage-copy-json-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 4px 11px;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  background: #f0f9ff;
  color: #0284c7;
  border: 1px solid #bae6fd;
  transition: all 0.15s ease;
  white-space: nowrap !important;
  flex-shrink: 0 !important;
  align-self: flex-start;
  user-select: none;
  box-sizing: border-box;
}

.cf-storage-copy-json-btn:hover {
  background: #e0f2fe;
  color: #0369a1;
  border-color: #7dd3fc;
}

.cf-storage-copy-json-btn .copy-btn-text {
  white-space: nowrap !important;
  display: inline-block;
}
</style>
