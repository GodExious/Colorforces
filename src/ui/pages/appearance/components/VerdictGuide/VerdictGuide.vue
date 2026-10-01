<script>
import * as cfAssets from '../../../../../assets/index.js';
import { ref } from 'vue';
const visible = ref(false);
const origin = ref(null);
// 打开本页专用的原版帮助说明。
export function openVerdictGuide(anchor) {
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
function showVerdictGuideModal(lang) {
  const l = lang || (typeof appSettings !== 'undefined' && appSettings && appSettings.lang) || 'zh';
  return guideOptions({
    className: 'cf-verdict-guide-modal',
    width: '680px',
    maxWidth: '96vw',
    iconSvg: `${cfAssets.verdictGuideIcon}`,
    title: t('verdictGuideModalTitle', l),
    confirmText: t('verdictGuideCloseBtn', l),
    bodyHtml: `
                <div style="margin-bottom: 12px; font-size: 13px; color: #475569; line-height: 1.5;">
                    ${t('verdictGuideDesc', l)}
                </div>

                <div class="cf-guide-table-wrap" style="margin-bottom: 14px;">
                    <table class="cf-guide-table">
                        <thead>
                            <tr>
                                <th style="padding: 7px 10px; text-align: left; font-weight: 600;">${t('verdictGuideColStatus', l)}</th>
                                <th style="padding: 7px 10px; text-align: center; font-weight: 600;">${t('verdictGuideColAbbr', l)}</th>
                                <th style="padding: 7px 10px; text-align: left; font-weight: 600;">${t('verdictGuideColMeaning', l)}</th>
                                <th style="padding: 7px 10px; text-align: left; font-weight: 600;">${t('verdictGuideColRaw', l)}</th>
                                <th style="padding: 7px 10px; text-align: left; font-weight: 600;">${t('verdictGuideColExample', l)}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style="border-bottom: 1px solid var(--cf-surface-border);">
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Accepted</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: #dcfce7; color: #15803d; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">AC</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictAcMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #00aa00; font-weight: bold;">Accepted</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #00aa00; font-weight: bold;">AC</span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid var(--cf-surface-border);">
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Wrong answer</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: #fee2e2; color: #b91c1c; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">WA</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictWaMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;">Wrong answer on test 3</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;"><b>WA</b> on test 3</span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid var(--cf-surface-border);">
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Time limit exceeded</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: #ffedd5; color: #c2410c; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">TLE</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictTleMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;">Time limit exceeded on test 5</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;"><b>TLE</b> on test 5</span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid var(--cf-surface-border);">
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Memory limit exceeded</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: #fef3c7; color: #b45309; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">MLE</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictMleMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;">Memory limit exceeded on test 2</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;"><b>MLE</b> on test 2</span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid var(--cf-surface-border);">
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Runtime error</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: #f3e8ff; color: #7e22ce; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">RE</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictReMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;">Runtime error on test 1</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;"><b>RE</b> on test 1</span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid var(--cf-surface-border);">
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Compilation error</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: var(--cf-control-surface); color: #475569; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">CE</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictCeMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #000000;">Compilation error</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #000000;"><b>CE</b></span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid var(--cf-surface-border);">
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Idleness limit exceeded</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: #e0e7ff; color: #4338ca; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">ILE</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictIleMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;">Idleness limit exceeded on test 4</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;"><b>ILE</b> on test 4</span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid var(--cf-surface-border);">
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Presentation error</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: #e0f2fe; color: #0369a1; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">PE</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictPeMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;">Presentation error on test 1</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;"><b>PE</b> on test 1</span></td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Skipped</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: var(--cf-control-surface); color: #64748b; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">SK</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictSkMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #000000;">Skipped</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #000000;"><b>SK</b></span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div style="background: var(--cf-control-surface); border: 1px solid var(--cf-surface-border); border-radius: 6px; padding: 8px 12px; font-size: 12px; color: #475569; line-height: 1.5;">
                    <strong style="color: #0f172a;">${t('verdictGuideTipTitle', l)}</strong> ${t('verdictGuideTipDesc', l)}
                </div>
            `,
  });
}
const options = computed(() => showVerdictGuideModal(appSettings.lang));
</script>
<template>
  <GuideDialog :visible="visible" :origin="origin" :options="options" @close="visible = false" />
</template>
