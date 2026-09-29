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
                    <div style="font-weight:600; color:var(--cf-control-ink); margin-bottom:4px;">${t('guideStep1Title', lang)}</div>
                    <div style="color:#64748b;">${t('guideStep1Desc', lang)} <a href="https://clist.by/" target="_blank" class="cf-clist-guide-link">https://clist.by/</a></div>
                </div>

                <div style="margin-bottom: 14px;">
                    <div style="font-weight:600; color:var(--cf-control-ink); margin-bottom:4px;">${t('guideStep2Title', lang)}</div>
                    <div style="color:#64748b;">${t('guideStep2Desc', lang)} <a href="https://clist.by/api/v4/doc/" target="_blank" class="cf-clist-guide-link">https://clist.by/api/v4/doc/</a></div>
                </div>

                <div style="margin-bottom: 14px;">
                    <div style="font-weight:600; color:var(--cf-control-ink); margin-bottom:4px;">${t('guideStep3Title', lang)}</div>
                    <div style="color:#64748b;">${t('guideStep3Desc', lang)}</div>
                    <div class="cf-clist-mock-panel" style="margin: 6px 0; background:var(--cf-control-surface); font-style:italic; color:#334155; font-size:12.5px;">
                        "Accessing the API requires an API key, available to authenticated users <span class="cf-clist-guide-here">here</span>."
                    </div>
                    <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:8px 12px; font-size:12px; color:#b45309; line-height:1.5;">
                        <strong>${t('guideNoteLabel', lang)}</strong> ${t('guideStep3Note', lang)}
                    </div>
                </div>

                <div style="margin-bottom: 10px;">
                    <div style="font-weight:600; color:var(--cf-control-ink); margin-bottom:4px;">${t('guideStep4Title', lang)}</div>
                    <div style="color:#64748b;">${t('guideStep4Desc', lang)}</div>

                    <div class="cf-clist-popover-demo">
                        <div style="font-size:11px; font-weight:600; color:#64748b; margin-bottom:4px;">Request header:</div>
                        <div class="cf-clist-code-block" style="margin:0;">Authorization: ApiKey YourUsername:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b</div>
                    </div>

                    <div style="font-size:12px; color:#475569; margin-top:8px; line-height:1.5;">
                        <strong>${t('guideNoticeLabel', lang)}</strong> ${t('guideStep4Notice', lang)}
                    </div>
                </div>
            `,
  });
}
const options = computed(() => showClistKeyGuideModal(appSettings.lang));
</script>
<template>
  <GuideDialog :visible="visible" :origin="origin" :options="options" @close="visible = false" />
</template>

<style>
/* 链接和示例 here 使用主题深色，兼容原站 a:link 并保留悬停反馈。 */
.cf-clist-guide-modal .cf-clist-guide-link:any-link {
  color: var(--cf-control-ink);
  text-decoration: none;
  font-weight: 500;
}
.cf-clist-guide-modal .cf-clist-guide-link:hover {
  color: var(--cf-control-ink);
  text-decoration: underline;
}
.cf-clist-guide-modal .cf-clist-guide-here {
  color: var(--cf-control-ink);
  font-weight: bold;
  text-decoration: underline;
}
</style>
