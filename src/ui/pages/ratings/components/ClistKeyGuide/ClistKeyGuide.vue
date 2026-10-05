<script>
import * as cfAssets from '../../../../../assets/index.js';
import { ref } from 'vue';
const visible = ref(false);
const origin = ref(null);
// 打开本页专用的原版帮助说明。
export function openClistKeyGuide(anchor) {
  origin.value = anchor?.getBoundingClientRect().toJSON();
  visible.value = true;
}
</script>
<script setup>
import { computed } from 'vue';
import { appSettings } from '../../../../../settings.js';
import { tGlobal as t } from '../../../../../i18n/index.js';
import GuideDialog from '../../../../components/dialogs/GuideDialog/GuideDialog.vue';
// 生成原版说明内容，不创建或手动挂载 DOM。
const guideOptions = (options) => options;
function showClistKeyGuideModal(lang) {
  return guideOptions({
    className: 'cf-clist-guide-modal',
    width: '620px',
    iconSvg: `${cfAssets.clistKeyGuideIcon}`,
    title: t('guideModalTitle', lang),
    confirmText: t('guideConfirmBtn', lang),
    bodyHtml: `
                <div style="margin-bottom: 14px;">
                    <div style="font-weight:var(--cf-font-weight-semibold); color:var(--cf-control-ink); margin-bottom:4px;">${t('guideStep1Title', lang)}</div>
                    <div style="color:var(--cf-gray-500);">${t('guideStep1Desc', lang)} <a href="https://clist.by/" target="_blank" class="cf-clist-guide-link">https://clist.by/</a></div>
                </div>

                <div style="margin-bottom: 14px;">
                    <div style="font-weight:var(--cf-font-weight-semibold); color:var(--cf-control-ink); margin-bottom:4px;">${t('guideStep2Title', lang)}</div>
                    <div style="color:var(--cf-gray-500);">${t('guideStep2Desc', lang)} <a href="https://clist.by/api/v4/doc/" target="_blank" class="cf-clist-guide-link">https://clist.by/api/v4/doc/</a></div>
                </div>

                <div style="margin-bottom: 14px;">
                    <div style="font-weight:var(--cf-font-weight-semibold); color:var(--cf-control-ink); margin-bottom:4px;">${t('guideStep3Title', lang)}</div>
                    <div style="color:var(--cf-gray-500);">${t('guideStep3Desc', lang)}</div>
                    <div class="cf-clist-doc-info">
                        <div class="cf-clist-doc-title">Authentication</div>
                        <div class="cf-clist-doc-text">
                            <ul>
                                <li>Accessing the API requires an API key, available to authenticated users <span class="cf-clist-guide-here">here</span>.</li>
                            </ul>
                        </div>
                    </div>
                    <div style="background:#fff5e4c7; border:1px solid #f0dcbc; border-radius:var(--cf-radius-lg); padding:8px 12px; font-size:var(--cf-font-size-base); color:#946a2f; line-height:1.5;">
                        <strong>${t('guideNoteLabel', lang)}</strong> ${t('guideStep3Note', lang)}
                    </div>
                </div>

                <div style="margin-bottom: 10px;">
                    <div style="font-weight:var(--cf-font-weight-semibold); color:var(--cf-control-ink); margin-bottom:4px;">${t('guideStep4Title', lang)}</div>
                    <div style="color:var(--cf-gray-500);">${t('guideStep4Desc', lang)}</div>

                    <div class="cf-clist-popover-demo">
                        <div style="font-size:var(--cf-font-size-xs); font-weight:var(--cf-font-weight-semibold); color:var(--cf-gray-500); margin-bottom:4px;">Request header:</div>
                        <div class="cf-clist-code-block" style="margin:0;">Authorization: ApiKey YourUsername:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b</div>
                    </div>

                    <div style="font-size:var(--cf-font-size-base); color:var(--cf-gray-600); margin-top:8px; line-height:1.5;">
                        <strong>${t('guideNoticeLabel', lang)}</strong> ${t('guideStep4Notice', lang)}
                    </div>
                </div>
            `,
  });
}
const options = computed(() => showClistKeyGuideModal(appSettings.general.lang));
</script>
<template>
  <GuideDialog :visible="visible" :origin="origin" :options="options" @close="visible = false" />
</template>

<style>
/* 链接和示例 here 使用主题深色，兼容原站 a:link 并保留悬停反馈。 */
.cf-clist-guide-modal .cf-clist-guide-link:any-link {
  color: var(--cf-control-ink);
  text-decoration: none;
  font-weight: var(--cf-font-weight-medium);
}
.cf-clist-guide-modal .cf-clist-guide-link:hover {
  color: var(--cf-control-ink);
  text-decoration: underline;
}
/*
 * 照搬 clist.by/api/v4/doc/ 页面「Authentication」一块的原样式（取自该站的 tastypie_swagger.css）：
 * 灰色加粗小标题，下面是浅蓝底、蓝灰边框、3px 圆角的说明框，列表不带圆点，链接为 #0F6AB4。
 * 这样用户到了原网页能一眼认出要找的那一块。
 */
.cf-clist-guide-modal .cf-clist-doc-info {
  margin: 8px 0;
  font:
    14px/1.43 'Droid Sans',
    sans-serif;
}
.cf-clist-guide-modal .cf-clist-doc-title {
  padding: 2px 0 3px;
  color: #999;
  font-weight: bold;
}
.cf-clist-guide-modal .cf-clist-doc-text {
  box-sizing: border-box;
  padding: 4px 10px;
  border: 1px solid #c3d9ec;
  border-radius: 3px;
  background-color: #e7f0f7;
  color: #000;
}
.cf-clist-guide-modal .cf-clist-doc-text ul,
.cf-clist-guide-modal .cf-clist-doc-text li {
  margin: 0;
  padding: 0;
  list-style: none;
}
/* 原网页里 here 是普通链接；这里只加一条下划线，标出要点击的位置。 */
.cf-clist-guide-modal .cf-clist-guide-here {
  color: #0f6ab4;
  text-decoration: underline;
  cursor: default;
}
</style>
