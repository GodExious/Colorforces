<script setup>
// 评分预测页专属弹窗，同时供原生榜单的单用户分析入口调用。
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { translate as t } from '../../../../../i18n/index.js';
import { appSettings } from '../../../../../settings.js';
import { predictionState as state } from '../../../../../features/contest/rating-prediction/state.js';
import {
  runPredictionAnalysis,
  cancelPredictionAnalysis,
  getPredictionAnalysisBounds,
} from '../../../../../features/contest/rating-prediction/index.js';
import DialogTransition from '../../../../components/transitions/DialogTransition/DialogTransition.vue';
import ActionButton from '../../../../components/forms/ActionButton/ActionButton.vue';
import analyzeIcon from '../../../../../assets/icons/prediction/analyze.svg?raw';
import { predictionNumberColor } from '../../../../../features/contest/rating-prediction/presentation.js';
import {
  normalizeAvatarUrl,
  DEFAULT_AVATAR_URL,
} from '../../../../../features/user/avatars/data.js';
import { appStorage } from '../../../../../storage/gm.js';
import { AVATAR_CACHE_KEY } from '../../../../../storage/keys.js';
const mode = ref('rating'),
  value = ref(''),
  dialog = ref(null),
  input = ref(null),
  handle = ref('');
const avatar = ref(''),
  drafts = ref({ rating: '', rank: '' });
const bounds = ref(null);
const languagePulse = ref(false);
let languagePulseTimer = null;
let languagePulseFrame = 0;
const participant = computed(() =>
  state.snapshot?.participants.find((p) => p.handle === handle.value),
);
const inputPlaceholder = computed(() => {
  const current = bounds.value;
  return mode.value === 'rating'
    ? t('predictionTargetRatingPlaceholder', current?.ratingMin, current?.ratingMax)
    : t('predictionTargetRankPlaceholder', current?.rankMin, current?.rankMax);
});
const inputMin = computed(() =>
  mode.value === 'rating' ? bounds.value?.ratingMin : bounds.value?.rankMin,
);
const inputMax = computed(() =>
  mode.value === 'rating' ? bounds.value?.ratingMax : bounds.value?.rankMax,
);
let previousFocus = null;
watch(
  () => appSettings.lang,
  () => {
    languagePulse.value = false;
    clearTimeout(languagePulseTimer);
    cancelAnimationFrame(languagePulseFrame);
    if (!state.openHandle || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    languagePulseFrame = requestAnimationFrame(() => {
      languagePulse.value = true;
      languagePulseTimer = setTimeout(() => (languagePulse.value = false), 240);
    });
  },
);
// 打开时锁定用户并聚焦输入，关闭动画保留最后一帧内容。
watch(
  () => state.openHandle,
  async (current) => {
    if (current) {
      previousFocus = document.activeElement;
      handle.value = current;
      mode.value = 'rating';
      drafts.value = {
        rating: String(participant.value?.rating ?? 1400),
        rank: String(state.results[current]?.rank ?? participant.value?.rank ?? 1),
      };
      bounds.value = null;
      const requestedHandle = current;
      getPredictionAnalysisBounds(current)
        .then((next) => {
          if (handle.value === requestedHandle) bounds.value = next;
        })
        .catch(() => {});
      value.value = drafts.value.rating;
      await nextTick();
      input.value?.focus();
    } else previousFocus?.isConnected && previousFocus.focus();
  },
);
// 优先复用页面头像，缺失时读取缓存；打开弹窗不增加头像请求。
watch([handle, () => appSettings.show.userAvatar], ([name, enabled]) => {
  avatar.value = '';
  if (!enabled || !name) return;
  const link = [...document.querySelectorAll('td.contestant-cell a[href]')].find((link) => {
    try {
      return (
        decodeURIComponent(
          new URL(link.href).pathname.split('/profile/')[1] || '',
        ).toLowerCase() === name.toLowerCase() && link.querySelector('img')
      );
    } catch {
      return false;
    }
  });
  const image = link?.querySelector('img');
  const cache = image ? null : appStorage.getJSON(AVATAR_CACHE_KEY, {});
  const cached =
    cache && Object.entries(cache).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
  avatar.value = normalizeAvatarUrl(
    image?.currentSrc || image?.src || cached?.url || DEFAULT_AVATAR_URL,
  );
});
// 两种模式独立保留输入，不将 Rating 数字直接当成目标名次。
function changeMode(next, focus = false) {
  if (mode.value !== next) {
    drafts.value[mode.value] = value.value;
    mode.value = next;
    value.value = drafts.value[next];
    invalidate();
  }
  if (focus) nextTick(() => dialog.value?.querySelector(`#cf-analysis-tab-${next}`)?.focus());
}
// 页签支持方向键及首尾键，只有活动页签进入 Tab 焦点序列。
function modeKeyboard(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  changeMode(
    event.key === 'Home'
      ? 'rating'
      : event.key === 'End'
        ? 'rank'
        : mode.value === 'rating'
          ? 'rank'
          : 'rating',
    true,
  );
}

// 输入变化立即作废旧分析，避免旧值误显示为新目标结果。
function invalidate() {
  cancelPredictionAnalysis();
}
// 只提交明确输入，不在每次按键时重算全场。
function calculate() {
  const numericValue = Number(value.value);
  const outOfRange =
    !Number.isInteger(numericValue) ||
    (inputMin.value != null && numericValue < inputMin.value) ||
    (inputMax.value != null && numericValue > inputMax.value);
  if (!value.value.trim() || outOfRange) {
    state.analysisError = outOfRange ? 'predictionTargetOutOfRange' : 'predictionInvalidInput';
    return;
  }
  runPredictionAnalysis(mode.value, numericValue);
}
// 关闭与取消统一清理计算，保留全场普通预测。
function close() {
  cancelPredictionAnalysis(true);
}
// 弹窗中保持键盘焦点，Escape 不影响其他设置。
function keyboard(event) {
  if (!state.openHandle || event.defaultPrevented) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    close();
  }
  if (event.key !== 'Tab') return;
  const items = [
    ...dialog.value.querySelectorAll(
      'button:not(:disabled),input:not(:disabled),select:not(:disabled)',
    ),
  ];
  if (!dialog.value.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? items.at(-1) : items[0])?.focus();
    return;
  }
  if (event.shiftKey && document.activeElement === items[0]) {
    event.preventDefault();
    items.at(-1)?.focus();
  } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
    event.preventDefault();
    items[0]?.focus();
  }
}
onMounted(() => document.addEventListener('keydown', keyboard, true));
onBeforeUnmount(() => {
  clearTimeout(languagePulseTimer);
  cancelAnimationFrame(languagePulseFrame);
  document.removeEventListener('keydown', keyboard, true);
});
</script>
<template>
  <Teleport to="body">
    <DialogTransition>
      <div
        v-if="state.openHandle"
        class="cf-prediction-overlay"
        @click.self="close"
        @keydown="keyboard"
      >
        <section
          ref="dialog"
          class="cf-prediction-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cf-prediction-title"
        >
          <header>
            <div class="cf-analysis-heading">
              <span class="cf-analysis-emblem"
                ><img
                  v-if="avatar"
                  :src="avatar"
                  :alt="handle"
                  @error="avatar = avatar === DEFAULT_AVATAR_URL ? '' : DEFAULT_AVATAR_URL" /><span
                  v-else
                  v-html="analyzeIcon"
                ></span
              ></span>
              <div>
                <small>{{ t('predictionAnalyze') }}</small>
                <h3
                  id="cf-prediction-title"
                  :style="{ color: predictionNumberColor(participant?.rating) || '#34435f' }"
                >
                  {{ handle }}
                </h3>
              </div>
            </div>
            <button
              type="button"
              class="cf-analysis-close"
              :aria-label="t(`predictionClose`)"
              @click="close"
            >
              ×
            </button>
          </header>
          <div class="cf-analysis-content" :class="{ 'cf-analysis-language-pulse': languagePulse }">
            <p class="cf-analysis-context">
              <span class="cf-analysis-contest">{{ state.snapshot?.name }}</span>
              <span class="cf-analysis-meta">
                <span
                  >{{ t('predictionModelRating') }}
                  <strong :style="{ color: predictionNumberColor(participant?.rating) }">{{
                    participant?.rating
                  }}</strong></span
                >
                <span
                  >{{ t('predictionDataTime') }}
                  {{
                    new Date(state.snapshot?.fetchedAt).toLocaleString(
                      appSettings.lang === 'zh' ? 'zh-CN' : 'en-US',
                      {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      },
                    )
                  }}</span
                >
              </span>
            </p>
            <form @submit.prevent="calculate">
              <div
                class="cf-analysis-tabs"
                role="tablist"
                :aria-label="t('predictionMode')"
                @keydown="modeKeyboard"
              >
                <span
                  class="cf-analysis-tab-indicator"
                  :class="{ right: mode === 'rank' }"
                  aria-hidden="true"
                ></span>
                <button
                  v-for="key in ['rating', 'rank']"
                  :key="key"
                  :id="`cf-analysis-tab-${key}`"
                  type="button"
                  role="tab"
                  :aria-selected="mode === key"
                  aria-controls="cf-analysis-target-panel"
                  :tabindex="mode === key ? 0 : -1"
                  @click="changeMode(key)"
                >
                  {{ t(key === 'rating' ? 'predictionTargetRating' : 'predictionTargetRank') }}
                </button>
              </div>
              <div
                id="cf-analysis-target-panel"
                role="tabpanel"
                :aria-labelledby="`cf-analysis-tab-${mode}`"
              >
                <label class="cf-analysis-field">
                  <span class="cf-analysis-field-label-slot">
                    <Transition name="cf-analysis-swap" mode="out-in">
                      <span :key="mode" class="cf-analysis-field-label">{{
                        t(
                          mode === 'rating'
                            ? 'predictionTargetRatingInput'
                            : 'predictionTargetRankInput',
                        )
                      }}</span>
                    </Transition>
                  </span>
                  <input
                    ref="input"
                    v-model="value"
                    inputmode="numeric"
                    autocomplete="off"
                    :placeholder="inputPlaceholder"
                    :min="inputMin"
                    :max="inputMax"
                    aria-describedby="cf-analysis-range-hint"
                    :style="{
                      color: mode === 'rating' ? predictionNumberColor(Number(value)) : undefined,
                    }"
                    :aria-label="
                      t(
                        mode === `rating`
                          ? `predictionTargetRatingInput`
                          : `predictionTargetRankInput`,
                      )
                    "
                    @input="invalidate"
                  />
                </label>
                <small id="cf-analysis-range-hint" class="cf-analysis-range-hint">
                  {{ inputPlaceholder }}
                </small>
              </div>
              <div class="cf-analysis-actions">
                <ActionButton
                  class="cf-analysis-target-button"
                  :disabled="state.computing || !value.trim()"
                  @click="calculate"
                >
                  <span class="cf-analysis-button-label">
                    <Transition name="cf-analysis-button-swap" mode="out-in">
                      <span :key="mode">{{
                        t(mode === 'rating' ? 'predictionEstimateRank' : 'predictionEstimateRating')
                      }}</span>
                    </Transition>
                  </span>
                </ActionButton>
              </div>
            </form>
            <div class="cf-analysis-result" aria-live="polite" :aria-busy="state.computing">
              <Transition name="cf-analysis-result-swap" mode="out-in">
                <div
                  :key="
                    state.computing
                      ? 'computing'
                      : state.analysisError
                        ? state.analysisError
                        : state.analysisResult
                          ? `${state.analysisResult.mode}-${state.analysisResult.rank ?? state.analysisResult.performance ?? 'done'}`
                          : 'empty'
                  "
                  class="cf-analysis-result-content"
                >
                  <span v-if="state.computing">{{ t('predictionComputing') }}</span>
                  <span v-else-if="state.analysisError" class="cf-analysis-error">{{
                    t(state.analysisError)
                  }}</span>
                  <template v-else-if="state.analysisResult">
                    <span v-if="state.analysisResult.unreachable">{{
                      t('predictionUnreachable')
                    }}</span>
                    <template v-else-if="state.analysisResult.mode === `refine`"
                      ><span>{{ t('predictionRefined') }}</span
                      ><strong
                        :style="{ color: predictionNumberColor(state.analysisResult.performance) }"
                        >{{
                          state.analysisResult.bound === 'lower'
                            ? '≤'
                            : state.analysisResult.bound === 'upper'
                              ? '>'
                              : ''
                        }}{{ state.analysisResult.performance }}</strong
                      ></template
                    >
                    <template v-else
                      ><span
                        >{{ t('predictionEstimatedRank') }}
                        <strong>#{{ state.analysisResult.rank }}</strong></span
                      ><span
                        >Δ
                        <strong
                          :style="{
                            color: predictionNumberColor(state.analysisResult.delta, true),
                          }"
                          >{{ state.analysisResult.delta > 0 ? '+' : ''
                          }}{{ state.analysisResult.delta }}</strong
                        >
                        · {{ t('predictionResultRating') }}
                        <strong
                          :style="{ color: predictionNumberColor(state.analysisResult.rating) }"
                          >{{ state.analysisResult.rating }}</strong
                        ></span
                      ></template
                    >
                  </template>
                  <span v-else>{{ t('predictionInputHint') }}</span>
                </div>
              </Transition>
            </div>
            <p class="cf-analysis-note">{{ t('predictionScenarioHint') }}</p>
            <p
              v-for="warning in state.snapshot?.warnings"
              :key="warning"
              class="cf-analysis-warning"
            >
              {{ t(warning) }}
            </p>
          </div>
        </section>
      </div>
    </DialogTransition>
  </Teleport>
</template>
<style scoped>
.cf-prediction-overlay {
  /* 独立分析视图固定使用柔彩，不继承当前设置页的色系。 */
  --cf-menu-accent: #91a2d6;
  --cf-card-surface: #f8f9ff;
  --cf-control-surface: #f0f2f9;
  --cf-surface-border: #dce1ee;
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  display: grid;
  place-items: center;
  padding: 18px;
  background: #27344833;
  backdrop-filter: blur(3px);
  box-sizing: border-box;
}
.cf-prediction-dialog {
  width: min(480px, 100%);
  max-height: 86vh;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid #ffffffd9;
  border-radius: 20px;
  color: #48546b;
  background:
    radial-gradient(ellipse at 0% 0%, #e0e6ffad, transparent 65%),
    radial-gradient(ellipse at 100% 20%, #f8e3edb0, transparent 60%),
    radial-gradient(ellipse at 70% 100%, #dff2eeb3, transparent 65%), #f8fafc;
  box-shadow:
    0 22px 75px #26345330,
    inset 0 1px 0 #fff;
  font:
    13px/1.6 Arial,
    sans-serif;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 22px 14px;
}
.cf-analysis-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.cf-analysis-emblem {
  display: grid;
  place-items: center;
  flex: 0 0 42px;
  height: 42px;
  border: 1px solid #ffffffdc;
  border-radius: 14px;
  background: linear-gradient(135deg, #dce7f9b3, #eee4f5b3);
  color: #7385ac;
}
.cf-analysis-emblem :deep(svg) {
  width: 25px;
  height: 25px;
}
.cf-analysis-emblem img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}
.cf-analysis-emblem > span {
  display: flex;
}
.cf-analysis-tabs {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 4px;
  margin: 18px 0;
  border: 1px solid #cbd5e57a;
  border-radius: 12px;
  background: #dde5f454;
}
.cf-analysis-tab-indicator {
  position: absolute;
  top: 4px;
  left: 4px;
  bottom: 4px;
  width: calc(50% - 4px);
  border-radius: 9px;
  background: linear-gradient(120deg, #fcfdffdb, #e7eefbcc);
  box-shadow:
    0 1px 4px #697a9d20,
    inset 0 0 0 1px #fff9;
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
.cf-analysis-tab-indicator.right {
  transform: translateX(100%);
}
.cf-analysis-tabs button {
  z-index: 1;
  position: relative;
  min-width: 0;
  padding: 8px 6px;
  border: 0;
  border-radius: 9px;
  font: inherit;
  color: #748198;
  background: transparent;
  cursor: pointer;
  transition: color 180ms;
}
.cf-analysis-tabs button[aria-selected='true'] {
  color: #456187;
  font-weight: 600;
}
.cf-analysis-tabs button:focus-visible {
  outline: 2px solid #9badd8;
  outline-offset: -2px;
}
header small {
  color: #69778f;
  font-size: 11px;
  letter-spacing: 0.03em;
}
header h3 {
  margin: 0;
  font-size: 19px;
  color: #34435f;
  word-break: break-word;
}
.cf-analysis-close {
  border: 0;
  background: none;
  color: #71818d;
  font:
    24px/1 Arial,
    sans-serif;
  cursor: pointer;
  padding: 5px;
}
.cf-analysis-close:hover {
  color: #263643;
}
.cf-analysis-content {
  padding: 0 22px 22px;
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
.cf-analysis-language-pulse {
  animation: cf-analysis-language-pulse 240ms ease both;
}
@keyframes cf-analysis-language-pulse {
  0% {
    opacity: 0.62;
    transform: translateY(3px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
.cf-analysis-swap-enter-active,
.cf-analysis-swap-leave-active,
.cf-analysis-result-swap-enter-active,
.cf-analysis-result-swap-leave-active,
.cf-analysis-button-swap-enter-active,
.cf-analysis-button-swap-leave-active {
  transition:
    opacity 170ms ease,
    transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}
.cf-analysis-swap-enter-from,
.cf-analysis-result-swap-enter-from {
  opacity: 0;
  transform: translateY(5px);
}
.cf-analysis-swap-leave-to,
.cf-analysis-result-swap-leave-to,
.cf-analysis-button-swap-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}
.cf-analysis-button-swap-enter-from {
  opacity: 0;
  transform: translateY(3px);
}
.cf-analysis-result-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.cf-analysis-field-label-slot {
  display: block;
  min-height: 1.6em;
}
.cf-analysis-field-label {
  display: block;
}
.cf-analysis-context {
  margin: 0 0 17px;
  color: #68778a;
  font-size: 12px;
}
.cf-analysis-contest {
  display: block;
  color: #4e5e76;
  margin-bottom: 7px;
}
.cf-analysis-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-size: 11px;
}
.cf-analysis-meta strong {
  color: #4d6080;
  font-variant-numeric: tabular-nums;
}
.cf-analysis-field {
  display: grid;
  grid-template-columns: minmax(100px, 0.85fr) minmax(0, 1.35fr);
  align-items: center;
  gap: 12px;
  margin: 11px 0;
}
.cf-analysis-field input,
.cf-analysis-field select {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  border: 1px solid #ccd5e5;
  border-radius: 9px;
  padding: 8px 10px;
  background: #f7f9ffb8;
  color: #425674;
  font: inherit;
}
.cf-analysis-field input:focus,
.cf-analysis-field select:focus {
  outline: 2px solid #9dafe466;
  outline-offset: 1px;
}
.cf-analysis-range-hint {
  display: block;
  margin: -5px 0 0;
  color: #7b879a;
  font-size: 10px;
  line-height: 1.45;
}
.cf-analysis-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}
.cf-analysis-target-button {
  min-width: 118px;
}
.cf-analysis-button-label {
  position: relative;
  display: inline-block;
  min-width: 94px;
  min-height: 18px;
}
.cf-analysis-result {
  height: 84px;
  min-height: 84px;
  padding: 14px 16px;
  box-sizing: border-box;
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  border: 1px solid #cdd9e880;
  border-radius: 12px;
  background: linear-gradient(120deg, #e7edfbb0, #e7f3efb0);
  overflow: hidden;
}
.cf-analysis-result strong {
  color: #415b7c;
  font-size: 17px;
  font-variant-numeric: tabular-nums;
}
.cf-analysis-note,
.cf-analysis-warning {
  margin: 11px 0 0;
  font-size: 11px;
  line-height: 1.65;
  color: #6b7a8a;
}
.cf-analysis-warning,
.cf-analysis-error {
  color: #966e54;
}
@media (max-width: 520px) {
  .cf-analysis-content {
    padding: 12px 15px;
  }
  .cf-analysis-field {
    grid-template-columns: 1fr;
    gap: 3px;
  }
  .cf-analysis-actions {
    justify-content: stretch;
  }
  .cf-analysis-target-button {
    min-width: 0;
    width: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cf-analysis-tab-indicator,
  .cf-analysis-tabs button,
  .cf-analysis-content,
  .cf-analysis-swap-enter-active,
  .cf-analysis-swap-leave-active,
  .cf-analysis-result-swap-enter-active,
  .cf-analysis-result-swap-leave-active,
  .cf-analysis-button-swap-enter-active,
  .cf-analysis-button-swap-leave-active {
    transition: none;
  }
  .cf-analysis-language-pulse {
    animation: none;
  }
}
</style>
