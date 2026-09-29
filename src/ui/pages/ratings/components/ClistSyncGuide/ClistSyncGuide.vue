<script>
import * as cfAssets from '../../../../../assets/index.js';
import { ref } from 'vue';
const visible = ref(false);
const origin = ref(null);
// 打开本页专用的原版帮助说明。
export function openClistSyncGuide(anchor) {
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
function showClistSyncSpecModal(lang) {
  return guideOptions({
    className: 'cf-clist-spec-modal',
    width: '580px',
    iconSvg: `${cfAssets.clistSyncGuideIcon}`,
    title: t('specModalTitle', lang),
    confirmText: t('specConfirmBtn', lang),
    bodyHtml: `
                <div class="cf-clist-mock-panel" style="margin-top:0;">
                    <div style="font-weight:600; color:var(--cf-control-ink); margin-bottom:6px;">${t('specRateLimitTitle', lang)}</div>
                    <div style="font-size:12.5px; color:#475569; line-height:1.6;">
                        • <strong>${t('specRateLimitLabel', lang)}</strong>${t('specRateLimitDesc', lang)}<br>
                        • <strong>${t('specPageLimitLabel', lang)}</strong>${t('specPageLimitDesc', lang)}
                    </div>
                </div>

                <div class="cf-clist-mock-panel">
                    <div style="font-weight:600; color:var(--cf-control-ink); margin-bottom:6px;">${t('specBatchStrategyTitle', lang)}</div>
                    <div style="font-size:12.5px; color:#475569; line-height:1.6;">
                        • <strong>${t('specDatasetLabel', lang)}</strong>${t('specDatasetDesc', lang)}<br>
                        • <strong>${t('specPacemakerLabel', lang)}</strong>${t('specPacemakerDesc', lang)}<br>
                        • <strong>${t('specProgressLabel', lang)}</strong>${t('specProgressDesc', lang)}
                    </div>
                </div>

                <div class="cf-clist-mock-panel" style="margin-bottom:0;">
                    <div style="font-weight:600; color:var(--cf-control-ink); margin-bottom:6px;">${t('specCooldownTitle', lang)}</div>
                    <div style="font-size:12.5px; color:#475569; line-height:1.6;">
                        • <strong>${t('specCooldownLabel', lang)}</strong>${t('specCooldownDesc', lang)}<br>
                        • <strong>${t('specErrorCooldownLabel', lang)}</strong>${t('specErrorCooldownDesc', lang)}
                    </div>
                </div>
            `,
  });
}
const options = computed(() => showClistSyncSpecModal(appSettings.lang));
</script>
<template>
  <GuideDialog :visible="visible" :origin="origin" :options="options" @close="visible = false" />
</template>
