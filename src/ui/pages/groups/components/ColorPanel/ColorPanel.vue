<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue';
import { translate as t } from '../../../../../i18n/index.js';
import { appSettings, saveSettings } from '../../../../../settings.js';
import {
  hexToHsl,
  hexToHsv,
  hslToHex,
  hsvToHex,
  readHex,
} from '../../../../../utils/color-models.js';
import SegmentedSwitch from '../../../../components/forms/SegmentedSwitch/SegmentedSwitch.vue';

// 自定义分组颜色：什么颜色都能选。两种调法，右上角的开关切换，记在设置里（groups.colorMode）：
//   滑杆（sliders）：三条滑杆，色相、鲜艳（饱和度）、深浅（亮度），按 HSL 算；
//   色板（board）：一块色板加一条色相，色板横着是鲜艳、竖着是明暗，按 HSV 算。
// 右边是选到的颜色和色值输入框。拖的时候只发 preview（分组弹窗拿它当场改预览，不存），
// 松手、输完色值才发 commit（这时才存）。拖的过程中反复存的话，别的标签页和页面上的标签都会跟着重算，
// 存回来的颜色又会和手上的打架，滑块来回跳。
const props = defineProps({ color: { type: String, required: true } });
const emit = defineEmits(['preview', 'commit']);

const MODES = ['sliders', 'board'];
const mode = computed(() =>
  MODES.includes(appSettings.groups.colorMode) ? appSettings.groups.colorMode : 'board',
);
const modeOptions = computed(() => [
  { value: 'sliders', label: t('groupsColorSliders') },
  { value: 'board', label: t('groupsColorBoard') },
]);

// 两种调法各有各的数，共用的是颜色本身和色相。灰色（黑、白也是）没有色相：留着上一次的，
// 拖鲜艳、在色板上往右拖时，颜色从原来的色相长出来，不会突然变成红的。
const state = reactive({ hex: '', hue: 0, hsl: { s: 0, l: 0 }, hsv: { s: 0, v: 0 } });
function readColor(hex) {
  const hsl = hexToHsl(hex);
  const hsv = hexToHsv(hex);
  state.hex = hex;
  if (hsl.h !== null) state.hue = hsl.h;
  state.hsl = { s: hsl.s, l: hsl.l };
  state.hsv = { s: hsv.s, v: hsv.v };
}
// 正在拖（或正在输入框里改）时外面传进来的颜色是自己刚发出去的，不再读回来：读回来会按取整后的颜色倒推，滑块跳一下。
const busy = ref(false);
const typed = ref('');
watch(
  () => props.color,
  (color) => {
    if (busy.value) return;
    const hex = readHex(color);
    if (hex && hex !== state.hex) readColor(hex);
    typed.value = state.hex;
  },
  { immediate: true },
);

// 滑杆的底色跟着另外两条变：色相那条用眼下的鲜艳和深浅（太灰、太暗、太亮时提一点，不然一条全是灰的看不出色相）；
// 鲜艳那条从灰到最鲜艳；深浅那条从黑经过眼下的颜色到白。
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const tracks = computed(() => {
  const { hue } = state;
  const { s, l } = state.hsl;
  const showS = Math.max(s, 0.45),
    showL = clamp(l, 0.3, 0.7),
    midL = clamp(l, 0.2, 0.8);
  const stops = [0, 60, 120, 180, 240, 300, 360].map((value) => hslToHex(value, showS, showL));
  return {
    h: `linear-gradient(90deg, ${stops.join(', ')})`,
    s: `linear-gradient(90deg, ${hslToHex(hue, 0, midL)}, ${hslToHex(hue, 1, midL)})`,
    l: `linear-gradient(90deg, #000000, ${hslToHex(hue, s, 0.5)}, #ffffff)`,
  };
});
const pure = computed(() => hsvToHex(state.hue, 1, 1));

// 选到了一个颜色：滑杆、色板上的数照手放的地方留着，不按算出来的颜色倒推（纯黑时鲜艳算回来是 0，拖鲜艳会被弹回最左）。
function preview(hex, keep) {
  busy.value = true;
  readColor(hex);
  Object.assign(state, keep);
  typed.value = hex;
  emit('preview', hex);
}
function commit() {
  busy.value = false;
  emit('commit', state.hex);
}

// 滑杆。
function slide(key, event) {
  const value = Number(event.target.value);
  const hue = key === 'h' ? value : state.hue;
  const hsl = { ...state.hsl, ...(key === 'h' ? {} : { [key]: value / 100 }) };
  preview(hslToHex(hue, hsl.s, hsl.l), { hue, hsl });
}
// 色板上的色相条。
function slideBoardHue(event) {
  const hue = Number(event.target.value);
  preview(hsvToHex(hue, state.hsv.s, state.hsv.v), { hue, hsv: { ...state.hsv } });
}
// 色板：按下就选到这一点，拖着跟着走，松手存。
const board = ref(null);
let pressing = false;
function pickAt(event) {
  const rect = board.value.getBoundingClientRect();
  const hsv = {
    s: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    v: 1 - clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
  preview(hsvToHex(state.hue, hsv.s, hsv.v), { hue: state.hue, hsv });
}
function pressBoard(event) {
  if (event.button !== 0) return;
  board.value.setPointerCapture(event.pointerId);
  pressing = true;
  pickAt(event);
}
const dragBoard = (event) => pressing && pickAt(event);
function releaseBoard() {
  if (!pressing) return;
  pressing = false;
  commit();
}

// 色值输入框：认得出就当场预览，按回车或离开时存；认不出的标红，离开时换回原来的。
const badHex = computed(() => typed.value.trim() !== '' && !readHex(typed.value));
function typeHex(event) {
  typed.value = event.target.value;
  const hex = readHex(typed.value);
  if (hex) preview(hex, {});
}
function leaveHex() {
  if (busy.value) commit();
  typed.value = state.hex;
}

// 换调法：开关的滑块滑过去；两种之间淡入淡出，高度从旧的滑到新的。
const modes = ref(null);
async function chooseMode(next) {
  if (next === mode.value) return;
  const box = modes.value;
  const from = box?.offsetHeight || 0;
  appSettings.groups.colorMode = next;
  saveSettings();
  await nextTick();
  if (!box?.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const to = box.offsetHeight;
  if (!from || from === to) return;
  // 滑的这一会儿里，比框高的那部分先藏着，免得压到下面的内容上。
  box.style.overflow = 'hidden';
  const sliding = box.animate([{ height: from + 'px' }, { height: to + 'px' }], {
    duration: 250,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  });
  const done = () => (box.style.overflow = '');
  sliding.onfinish = done;
  sliding.oncancel = done;
}
</script>
<template>
  <div class="cf-groups-color">
    <div ref="modes" class="cf-groups-color-modes">
      <div class="cf-groups-color-mode" :class="{ 'is-on': mode === 'sliders' }">
        <label v-for="key in ['h', 's', 'l']" :key="key" class="cf-groups-color-row">
          <span>{{
            t(
              key === 'h'
                ? 'groupsColorHue'
                : key === 's'
                  ? 'groupsColorSaturation'
                  : 'groupsColorLightness',
            )
          }}</span>
          <input
            class="cf-groups-hue"
            type="range"
            min="0"
            :max="key === 'h' ? 360 : 100"
            step="1"
            :value="key === 'h' ? Math.round(state.hue) : Math.round(state.hsl[key] * 100)"
            :style="{ background: tracks[key], '--cf-group-color': state.hex }"
            :tabindex="mode === 'sliders' ? 0 : -1"
            @input="slide(key, $event)"
            @change="commit"
          />
        </label>
      </div>
      <div class="cf-groups-color-mode" :class="{ 'is-on': mode === 'board' }">
        <div
          ref="board"
          class="cf-groups-color-board"
          :style="{ '--cf-groups-board-hue': pure }"
          :aria-label="t('groupsColorBoard')"
          @pointerdown="pressBoard"
          @pointermove="dragBoard"
          @pointerup="releaseBoard"
          @lostpointercapture="releaseBoard"
        >
          <span
            class="cf-groups-color-thumb"
            :style="{
              left: state.hsv.s * 100 + '%',
              top: (1 - state.hsv.v) * 100 + '%',
              '--cf-group-color': state.hex,
            }"
          ></span>
        </div>
        <div class="cf-groups-color-row">
          <input
            class="cf-groups-hue is-rainbow"
            type="range"
            min="0"
            max="360"
            step="1"
            :value="Math.round(state.hue)"
            :style="{ '--cf-group-color': pure }"
            :aria-label="t('groupsColorHue')"
            :tabindex="mode === 'board' ? 0 : -1"
            @input="slideBoardHue"
            @change="commit"
          />
        </div>
      </div>
    </div>
    <div class="cf-groups-color-side">
      <SegmentedSwitch
        class="cf-groups-color-switch"
        :model-value="mode"
        :options="modeOptions"
        @update:model-value="chooseMode"
      />
      <span class="cf-groups-color-swatch" :style="{ '--cf-group-color': state.hex }"></span>
      <input
        class="cf-groups-input cf-groups-color-hex"
        :class="{ 'has-conflict': badHex }"
        type="text"
        maxlength="7"
        spellcheck="false"
        :value="typed"
        :aria-label="t('groupsColorCustom')"
        @input="typeHex"
        @change="leaveHex"
        @blur="leaveHex"
        @keydown.enter="$event.target.blur()"
      />
    </div>
  </div>
</template>
<style>
.cf-groups-color {
  display: flex;
  align-items: stretch;
  gap: 14px;
  padding: 12px 16px 2px;
}
/* 两种调法叠在一起：用着的那种占位置，另一种浮在上面、看不见、点不到。换的时候淡入淡出，高度由脚本滑过去。 */
.cf-groups-color-modes {
  position: relative;
  flex: 1;
  min-width: 0;
}
.cf-groups-color-mode {
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: opacity var(--cf-duration-base) ease;
}
.cf-groups-color-mode:not(.is-on) {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  opacity: 0;
  pointer-events: none;
}
.cf-groups-color-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cf-groups-color-row span {
  flex: none;
  min-width: 26px;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
}
.cf-groups-color-row .cf-groups-hue {
  flex: 1;
}
/* 色板上的色相条：一整圈色相，不跟着别的变。 */
.cf-groups-hue.is-rainbow {
  background: linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);
}
/* 色板：底下是眼下的色相，往左叠白、往下叠黑。圆角；滑块和色相滑杆的一样。 */
.cf-groups-color-board {
  position: relative;
  height: 96px;
  border-radius: var(--cf-radius-md);
  background:
    linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent),
    var(--cf-groups-board-hue);
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 8%);
  cursor: crosshair;
  touch-action: none;
}
.cf-groups-color-thumb {
  position: absolute;
  width: 18px;
  height: 18px;
  margin: -9px 0 0 -9px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: var(--cf-group-color);
  box-shadow:
    0 0 0 1px var(--cf-surface-border),
    0 1px 4px rgb(0 0 0 / 22%);
  box-sizing: border-box;
  pointer-events: none;
}
/* 右边一栏：开关、选到的颜色一大块、色值。 */
.cf-groups-color-side {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 6px;
  width: 84px;
}
.cf-groups-color-switch .cf-segmented-btn {
  padding: 2px 0;
  font-size: var(--cf-font-size-xs);
}
.cf-groups-color-swatch {
  flex: 1;
  min-height: 30px;
  border-radius: var(--cf-radius-md);
  background: var(--cf-group-color);
  box-shadow:
    inset 0 0 0 1px rgb(0 0 0 / 8%),
    0 0 0 1px var(--cf-surface-border);
  transition: background-color var(--cf-duration-fast) ease;
}
.cf-groups-card .cf-groups-color-hex {
  flex: none;
  width: 100%;
  height: 26px;
  padding: 0 4px;
  font-family: Consolas, 'SFMono-Regular', monospace;
  text-align: center;
}
@media (prefers-reduced-motion: reduce) {
  .cf-groups-color-mode {
    transition: none;
  }
}
</style>
