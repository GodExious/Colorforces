<script>
import * as cfAssets from '../../../../../assets/index.js';
import { ref } from 'vue';
const visible = ref(false);
const origin = ref(null);
// 打开本页专用的原版帮助说明。
export function openTimeFormatGuide(anchor) {
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
function showTimeFormatGuideModal(lang) {
  const l = lang || (typeof appSettings !== 'undefined' && appSettings && appSettings.lang) || 'zh';
  const badge = (tok) =>
    `<code style="display: inline-block; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 700; color: var(--cf-control-ink); background: var(--cf-control-active); border: 1px solid var(--cf-surface-border); border-radius: 4px; padding: 1.5px 6px; line-height: 1.3; box-shadow: 0 1px 1px rgba(2, 132, 199, 0.06); letter-spacing: 0.2px;">${tok}</code>`;
  const slash = `<span style="color: #94a3b8; font-size: 11px; margin: 0 3px; user-select: none;">/</span>`;
  const pair = (a, b) => `${badge(a)}${slash}${badge(b)}`;

  return guideOptions({
    className: 'cf-time-guide-modal',
    width: '620px',
    maxWidth: '95vw',
    iconSvg: `${cfAssets.timeFormatGuideIcon}`,
    title: t('timeGuideModalTitle', l),
    confirmText: t('timeGuideCloseBtn', l),
    bodyHtml: `
                <div style="margin-bottom: 14px;">
                    <div style="font-weight:600; color:var(--cf-control-ink); margin-bottom:8px; font-size: 13px; display:flex; align-items:center; gap:6px;">
                        <span>🔤</span><span>${t('timeGuideSectionTokens', l)}</span>
                    </div>
                    <div style="border: 1px solid var(--cf-surface-border); border-radius: 8px; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                            <thead>
                                <tr style="background: var(--cf-control-surface); border-bottom: 1px solid var(--cf-surface-border); color: #475569;">
                                    <th style="padding: 7px 12px; text-align: left; font-weight: 600; width: 140px;">${t('timeGuideColToken', l)}</th>
                                    <th style="padding: 7px 12px; text-align: left; font-weight: 600;">${t('timeGuideColMeaning', l)}</th>
                                    <th style="padding: 7px 12px; text-align: left; font-weight: 600; width: 140px;">${t('timeGuideColExample', l)}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom: 1px solid var(--cf-surface-border);">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${badge('YYYY')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenYear4', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">2026</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--cf-surface-border); background: var(--cf-control-surface);">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${badge('YY')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenYear2', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">26</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--cf-surface-border);">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('MM', 'M')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenMonth', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">09<span style="color: #94a3b8; margin: 0 3px;">/</span>9</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--cf-surface-border); background: var(--cf-control-surface);">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('DD', 'D')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenDay', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">06<span style="color: #94a3b8; margin: 0 3px;">/</span>6</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--cf-surface-border);">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('HH', 'H')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenHour24', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">14<span style="color: #94a3b8; margin: 0 3px;">/</span>14</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--cf-surface-border); background: var(--cf-control-surface);">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('hh', 'h')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenHour12', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">02<span style="color: #94a3b8; margin: 0 3px;">/</span>2</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--cf-surface-border);">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('mm', 'm')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenMinute', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">05<span style="color: #94a3b8; margin: 0 3px;">/</span>5</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--cf-surface-border); background: var(--cf-control-surface);">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('ss', 's')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenSecond', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">08<span style="color: #94a3b8; margin: 0 3px;">/</span>8</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--cf-surface-border);">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('A', 'a')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenAmPm', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">PM<span style="color: #94a3b8; margin: 0 3px;">/</span>pm</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--cf-surface-border); background: var(--cf-control-surface);">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('dddd', 'ddd')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenWeekday', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">Sunday<span style="color: #94a3b8; margin: 0 3px;">/</span>Sun</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--cf-surface-border);">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('MMMM', 'MMM')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenMonthName', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">September<span style="color: #94a3b8; margin: 0 3px;">/</span>Sep</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 12px; white-space: nowrap;">${badge('[...]')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenEscape', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #64748b;">${t('tokenEscapeExample', l)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div>
                    <div style="font-weight:600; color:var(--cf-control-ink); margin-bottom:8px; font-size: 13px; display:flex; align-items:center; gap:6px;">
                        <span>💡</span><span>${t('timeGuideSectionExamples', l)}</span>
                    </div>
                    <div style="border: 1px solid var(--cf-surface-border); border-radius: 8px; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                            <tbody>
                                <tr style="border-bottom: 1px solid var(--cf-surface-border);">
                                    <td style="padding: 7px 12px; width: 210px; white-space: nowrap;">${badge('YY/MM/DD HH:mm')}</td>
                                    <td style="padding: 7px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #334155; font-weight: 500;">26/09/06 14:30</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--cf-surface-border); background: var(--cf-control-surface);">
                                    <td style="padding: 7px 12px; width: 210px; white-space: nowrap;">${badge('YYYY-MM-DD HH:mm:ss')}</td>
                                    <td style="padding: 7px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #334155; font-weight: 500;">2026-09-06 14:30:08</td>
                                </tr>
                                <tr>
                                    <td style="padding: 7px 12px; width: 210px; white-space: nowrap;">${badge('YYYY/M/D h:mm A')}</td>
                                    <td style="padding: 7px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #334155; font-weight: 500;">2026/9/6 2:30 PM</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `,
  });
}
const options = computed(() => showTimeFormatGuideModal(appSettings.lang));
</script>
<template>
  <GuideDialog :visible="visible" :origin="origin" :options="options" @close="visible = false" />
</template>
