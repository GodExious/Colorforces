<script>
import { ref } from 'vue';
import { SCRIPT_UPDATE_URL } from '../../../../../config/release.js';
const remoteVersion = ref(null);
const downloadUrl = ref(SCRIPT_UPDATE_URL);
// 新版本的更新内容：{ 语言: [{ version, sections }] }，见更新检查里的 loadReleaseNotes。没取到时是空的。
const releaseNotes = ref({});
// 显示新版本提示，并保留本次检测成功的安装地址。
export function showUpdateModal(version, url = SCRIPT_UPDATE_URL, notes = {}) {
  downloadUrl.value = url;
  releaseNotes.value = notes || {};
  remoteVersion.value = version;
}
</script>
<script setup>
import { computed, watch } from 'vue';
import DialogTransition from '../../../../components/transitions/DialogTransition/DialogTransition.vue';
import InlineSvg from '../../../../components/icons/InlineSvg/InlineSvg.vue';
import { updateBellIcon } from '../../../../../assets/index.js';
import { menuTabColor } from '../../../../../utils/petal-palette.js';
import { appSettings, saveSettings } from '../../../../../settings.js';
import { translate as t } from '../../../../../i18n/index.js';
import { CURRENT_VERSION } from '../../../../../config/runtime.js';
import { resetUpdateCooldown } from '../../../../../features/general/updates.js';
import { splitInline } from '../../../../../features/general/release-notes.js';
const displayedVersion = ref(remoteVersion.value);
// 关闭时保留检测到的版本，直到退出过渡完成。
watch(
  remoteVersion,
  (value) => {
    if (value) displayedVersion.value = value;
  },
  { flush: 'sync' },
);
// 更新内容按菜单的语言列出；这种语言的没取到时用取到了的另一种。
const notes = computed(() => {
  const all = releaseNotes.value;
  const own = all[appSettings.general.lang];
  return own?.length ? own : Object.values(all).find((list) => list?.length) || [];
});
// 重新开启自动检查时清除旧冷却时间。
function autoCheckChanged() {
  saveSettings();
  if (!appSettings.general.disableUpdateCheck) resetUpdateCooldown();
}
// 普通点击后关闭提示；新标签跳转交给链接，保留中键和修饰键行为。
function installUpdate(event) {
  if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey)
    remoteVersion.value = null;
}
</script>
<template>
  <Teleport to="body"
    ><DialogTransition
      ><div id="cf-update-modal-overlay" class="cf-aurora-dialog" v-if="remoteVersion">
        <div class="cf-update-card cf-aurora-card" :class="{ 'has-notes': notes.length }">
          <div class="cf-update-title">
            <span
              class="cf-update-title-icon cf-aurora-emblem"
              :style="{ '--cf-emblem-petal': menuTabColor('general') }"
              ><InlineSvg :source="updateBellIcon"
            /></span>
            <span v-text="t('updateModalTitle')"></span>
          </div>
          <div class="cf-update-desc">
            <div v-html="t('updateModalDesc', displayedVersion, CURRENT_VERSION)"></div>
            <div class="cf-update-subdesc" v-text="t('updateModalSubDesc')"></div>
          </div>
          <!-- 新版本的更新内容，逐个版本列出，每个版本排成两栏：左边一栏是版本号的标签和发布日期
               （只有一个版本时也有），右边是内容。左边这一栏本身就把几个版本分开了，
               往下滚时它停在这一段的顶上，滚到哪都知道在看哪个版本。
               每个分类（新增、优化、修复）左边一条它自己颜色的竖条，分类名后面带条数。 -->
          <div class="cf-update-notes" v-if="notes.length">
            <div class="cf-update-notes-title" v-text="t('updateModalNotes')"></div>
            <div class="cf-update-notes-list cf-scrollbar">
              <div class="cf-update-note" v-for="note in notes" :key="note.version">
                <div class="cf-update-note-head">
                  <span class="cf-update-note-version">v{{ note.version }}</span>
                  <span v-if="note.date" class="cf-update-note-date">{{ note.date }}</span>
                </div>
                <div class="cf-update-note-body">
                  <!-- 各个分类按位置对应，不按标题：标题随语言变（新增 / Added），按标题的话换语言时
                     整块会被当成另一块重建，文字直接换掉，没有过渡。 -->
                  <div
                    class="cf-update-section"
                    :class="section.type"
                    v-for="(section, sectionIndex) in note.sections"
                    :key="sectionIndex"
                  >
                    <div class="cf-update-section-head">
                      <span v-text="section.title"></span
                      ><small v-text="t('updateModalItemCount', section.items.length)"></small>
                    </div>
                    <div class="cf-update-items">
                      <div
                        class="cf-update-item"
                        v-for="(item, itemIndex) in section.items"
                        :key="itemIndex"
                      >
                        <span class="cf-update-item-index" v-text="itemIndex + 1 + '.'"></span>
                        <div class="cf-update-item-content">
                          <template v-for="(part, partIndex) in splitInline(item)" :key="partIndex">
                            <a
                              v-if="part.href"
                              class="cf-changelog-link"
                              :href="part.href"
                              target="_blank"
                              rel="noopener noreferrer"
                              >{{ part.text }}</a
                            >
                            <span v-else-if="part.code" class="cf-changelog-code">{{
                              part.code
                            }}</span>
                            <template v-else>{{ part.text }}</template>
                          </template>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <label class="cf-update-stop">
            <input
              type="checkbox"
              id="cf-update-stop-cb"
              v-model="appSettings.general.disableUpdateCheck"
              v-on:change="autoCheckChanged"
            />
            <span v-text="t('updateModalStopCheck')"></span>
          </label>
          <div class="cf-update-actions">
            <button
              type="button"
              id="cf-update-btn-later"
              class="cf-aurora-btn"
              v-text="t('updateModalBtnLater')"
              v-on:click="remoteVersion = null"
            ></button>
            <a
              id="cf-update-btn-update"
              class="cf-aurora-btn cf-aurora-btn--primary"
              v-bind:href="downloadUrl"
              target="_blank"
              rel="noopener noreferrer"
              v-text="t('updateModalBtnUpdate')"
              v-on:click="installUpdate"
            ></a>
          </div>
        </div></div></DialogTransition
  ></Teleport>
</template>

<style>
/* 更新提示：外观来自幻彩主题，与其他弹窗一致，不再单独区分深浅色页面。 */
#cf-update-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.cf-update-card {
  box-sizing: border-box;
  width: 420px;
  max-width: 90vw;
  padding: 26px 26px 22px;
}

/* 列出更新内容时卡片宽一些，一条内容少折几行。 */
.cf-update-card.has-notes {
  width: 500px;
}

.cf-update-title {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 14px;
  color: #3b4868;
  font-size: calc(19px * var(--cf-font-scale));
  font-weight: var(--cf-font-weight-bold);
  line-height: 1.3;
}

.cf-update-title-icon {
  width: 34px;
  height: 34px;
}

.cf-update-title-icon svg {
  width: 21px;
  height: 21px;
}

.cf-update-desc {
  margin-bottom: 18px;
  color: var(--cf-aurora-text);
  font-size: var(--cf-font-size-xl);
  line-height: 1.65;
}

/* 版本号：淡蓝紫的底，方一点的圆角，不带边。说明文字里的和下面每个版本前面的是同一种样子。 */
.cf-update-version {
  padding: 1px 7px;
  border-radius: var(--cf-radius-sm);
  background: #dfe4f7;
  color: #47579a;
  font-size: var(--cf-font-size-lg);
  font-weight: var(--cf-font-weight-bold);
  font-variant-numeric: tabular-nums;
}

.cf-update-subdesc {
  margin-top: 8px;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-lg);
}

/* 更新内容：直接写在弹窗的底色上，不另加底和框；内容多了在这一块里滚动，弹窗本身不超出屏幕。 */
.cf-update-notes {
  margin-bottom: 16px;
}

.cf-update-notes-title {
  margin-bottom: 6px;
  color: var(--cf-control-ink);
  font-size: var(--cf-font-size-lg);
  font-weight: var(--cf-font-weight-semibold);
}

.cf-update-notes-list {
  box-sizing: border-box;
  max-height: min(42vh, 300px);
  padding: 2px 6px 2px 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  /* 滚动条用公共的 cf-scrollbar（styles/scrollbar.css）。 */
}

/* 一个版本：左边一栏版本号和日期，右边内容。 */
.cf-update-note {
  display: grid;
  grid-template-columns: 66px minmax(0, 1fr);
  column-gap: 12px;
  align-items: start;
}

.cf-update-note + .cf-update-note {
  margin-top: 22px;
}

/* 左边一栏：滚动时停在这一段的顶上，滚过这个版本才被下一个版本的顶走。 */
.cf-update-note-head {
  position: sticky;
  top: 2px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}

.cf-update-note-date {
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.cf-update-note-version {
  width: fit-content;
  padding: 0 9px;
  border-radius: var(--cf-radius-sm);
  background: #dfe4f7;
  color: #47579a;
  font-size: var(--cf-font-size-base);
  font-weight: var(--cf-font-weight-bold);
  line-height: 20px;
  font-variant-numeric: tabular-nums;
}

/* 一个分类：左边一条它自己颜色的竖条。颜色和更新日志页里各分类的标签一致。 */
.cf-update-section {
  --cf-section-hue: #658078;
  position: relative;
  padding: 1px 0 1px 14px;
}

.cf-update-section.added {
  --cf-section-hue: #258064;
}

.cf-update-section.optimized {
  --cf-section-hue: #3b78a0;
}

.cf-update-section.fixed {
  --cf-section-hue: #aa752f;
}

.cf-update-section.announcement {
  --cf-section-hue: #866299;
}

.cf-update-section + .cf-update-section {
  margin-top: 14px;
}

.cf-update-section::before {
  content: '';
  position: absolute;
  left: 0;
  top: 3px;
  bottom: 3px;
  width: 3px;
  border-radius: var(--cf-radius-xs);
  background: color-mix(in srgb, var(--cf-section-hue) 55%, #fff);
}

/* 分类名和这一类有几条。 */
.cf-update-section-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 7px;
  color: color-mix(in srgb, var(--cf-section-hue) 70%, #23394a);
  font-size: var(--cf-font-size-lg);
  font-weight: var(--cf-font-weight-bold);
  letter-spacing: 0.3px;
}

.cf-update-section-head small {
  color: color-mix(in srgb, var(--cf-section-hue) 45%, #8b97a8);
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-semibold);
  letter-spacing: 0;
}

.cf-update-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cf-update-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: var(--cf-gray-700);
  font-size: var(--cf-font-size-lg);
  line-height: 1.6;
}

/* 序号跟着分类的颜色。 */
.cf-update-item-index {
  flex: none;
  min-width: 14px;
  color: color-mix(in srgb, var(--cf-section-hue) 45%, #8b97a8);
  font-size: var(--cf-font-size-base);
  font-weight: var(--cf-font-weight-semibold);
  line-height: 1.6;
  text-align: right;
  font-variant-numeric: tabular-nums;
  user-select: none;
}

.cf-update-item-content {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.cf-update-stop {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-lg);
  cursor: pointer;
  user-select: none;
}

.cf-update-stop input {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: var(--cf-menu-accent);
  cursor: pointer;
}

.cf-update-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cf-update-actions .cf-aurora-btn {
  padding-top: 8px;
  padding-bottom: 8px;
  font-size: var(--cf-font-size-lg);
}
</style>
