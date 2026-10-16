<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { translate as t } from '../../../../../../../i18n/index.js';
import * as assets from '../../../../../../../assets/index.js';
import { appSettings } from '../../../../../../../settings.js';
import InlineSvg from '../../../../../../components/icons/InlineSvg/InlineSvg.vue';
import SmoothText from '../../../../../../components/transitions/SmoothText/SmoothText.vue';
import ExpandTransition from '../../../../../../components/transitions/ExpandTransition/ExpandTransition.vue';
import SegmentedSwitch from '../../../../../../components/forms/SegmentedSwitch/SegmentedSwitch.vue';
import CodeBox from '../../../../../../components/forms/CodeBox/CodeBox.vue';
import AvatarFrame from '../../../../../../components/avatars/AvatarFrame/AvatarFrame.vue';
import { frameText } from '../../../../../../../features/user/frames/format.js';
import { creditOf } from '../../../../../../../features/user/frames/catalog.js';
import {
  readPaste,
  sameFrame,
  syntaxError,
  lineAt,
  languagesOf,
} from '../../../../../../../features/user/frames/custom/read.js';
import {
  framePrompt,
  promptText,
  promptParts,
} from '../../../../../../../features/user/frames/custom/prompt/index.js';
import {
  customFrame,
  saveCustomFrames,
  updateCustomFrame,
} from '../../../../../../../features/user/frames/custom/data.js';
import FramePreview from '../FramePreview/FramePreview.vue';
import SelectTools from '../SelectTools/SelectTools.vue';
import CountPicker from '../CountPicker/CountPicker.vue';
// 新建、编辑一个自定义头像框：头像框库的中栏和右栏换成这一块。
// 中栏两步：① 写下想法、复制提示词（发给 AI）；② 粘贴 AI 的回答（或者导出的代码），也能直接改。
// 右栏顶上「试戴 / 提示词全文」：试戴贴进来的代码，或者看提示词全文。最下面一行是理由和「保存」。
// AI 给了好几段代码时列成格子，平时点格子选一段；新建时还能批量保存几段。
//   frameId  编辑的是哪个（空的是新建）
//   picture  试戴用的头像
// 事件：back 想回到格子（不保存，有没保存的内容时由头像框库先问一下）；saved({ ids, kind }) 保存了，kind 是 'new' 一个、'many' 几个、'edit' 改了一个。
const props = defineProps({
  frameId: { type: String, default: '' },
  picture: { type: String, default: '' },
});
const emit = defineEmits(['back', 'saved']);
const icons = assets.FRAME_EDITOR_ICONS;
const lang = computed(() => appSettings.general.lang);
const editing = computed(() => Boolean(props.frameId));
// 编辑的那个头像框（刚打开时的样子）。名字跟着语言走。
const original = customFrame(props.frameId);
const editName = computed(
  () => frameText(customFrame(props.frameId)?.meta, lang.value, t('frameUnnamed'))[0],
);

// —— 第一步：想法、几个方案和动效、复制提示词 ——
// 几个方案、要不要动效不记住：每次打开编辑区都是 1 个、有动效。
const idea = ref('');
const motion = ref(true);
const count = ref(1);
// 「已复制提示词」那张卡片：每次复制提示词后出现，代码框里的内容一变（粘贴、打字、删改）就收起；再复制又出现。
const copiedNote = ref(false);
const dismissNote = () => (copiedNote.value = false);
// 刚复制过的是哪个按钮（'main' 第一步的、'pane' 右栏提示词下面的），按钮变绿、换成「已复制!」，2 秒后变回来。
const flashed = ref('');
let flashTimer = 0;

// —— 第二步：代码 ——
const text = ref(original?.code || '');
// 读代码用的文字：打字停下 200 毫秒后才跟上（每段代码都要做成图片试戴，不必每敲一个字做一次）；
// 粘贴、刚打开时马上跟上。
const settled = ref(text.value);
let settleTimer = 0;
let pasted = false;
watch(text, (value) => {
  dismissNote();
  clearTimeout(settleTimer);
  if (pasted) {
    pasted = false;
    settled.value = value;
    return;
  }
  settleTimer = setTimeout(() => (settled.value = value), 200);
});
// 粘贴了代码：右栏马上切回试戴（看着提示词全文时也一样）。贴进去的和原来一模一样时内容没变，卡片也收起。
function onPaste() {
  pasted = true;
  promptOpen.value = false;
  dismissNote();
}

// 读出来的每一段：浏览器读不了的（XML 写错了）记成 broken，line 是出错的大概在代码框的第几行。
function checkBlock(block, source) {
  if (block.cut || !syntaxError(block.code)) return block;
  const raw = syntaxError(block.raw);
  return { ...block, broken: true, line: raw?.line ? lineAt(source, block.at) + raw.line - 1 : 0 };
}
const read = computed(() => {
  const result = readPaste(settled.value);
  return { ...result, blocks: result.blocks.map((block) => checkBlock(block, settled.value)) };
});
const usable = (block) => Boolean(block) && !block.cut && !block.broken;
const pick = ref(0);
const index = computed(() => Math.min(pick.value, Math.max(0, read.value.blocks.length - 1)));
const chosen = computed(() => read.value.blocks[index.value]);
const several = computed(() => read.value.blocks.length > 1);
// 批量保存（新建时、贴了好几段才有）：选上的是第几段；刚进来一段都不选。读不了的那几段选不上。
const batch = ref(false);
const selected = ref(new Set());
const picked = computed(() =>
  [...selected.value].filter((i) => usable(read.value.blocks[i])).sort((a, b) => a - b),
);
const usableCount = computed(() => read.value.blocks.filter(usable).length);
watch(several, (value) => !value && (batch.value = false));
function enterBatch() {
  batch.value = true;
  selected.value = new Set();
}
function exitBatch() {
  batch.value = false;
  selected.value = new Set();
}
const selectAll = () =>
  (selected.value = new Set(read.value.blocks.flatMap((block, i) => (usable(block) ? [i] : []))));
function choose(i) {
  pick.value = i;
  if (!batch.value || !usable(read.value.blocks[i])) return;
  const next = new Set(selected.value);
  next.has(i) ? next.delete(i) : next.add(i);
  selected.value = next;
}

// 名字和介绍写了没有。
const filled = (field) =>
  typeof field === 'string'
    ? Boolean(field.trim())
    : Array.isArray(field)
      ? field.some(filled)
      : Boolean(field && Object.values(field).some(filled));
const nameOf = (block) => frameText(block.meta, lang.value, t('frameUnnamed'))[0];
// 格子右上角的小标签：不能用的红色，能用但有问题的黄色。
function flagOf(block) {
  if (block.cut) return ['bad', t('frameFlagCut')];
  if (block.broken) return ['bad', t('frameFlagBroken')];
  if (block.scripts) return ['warn', t('frameFlagScript')];
  if (!block.box) return ['warn', t('frameFlagBox')];
  return null;
}
const tiles = computed(() =>
  read.value.blocks.map((block, i) => ({
    i,
    block,
    name: block.cut ? t('frameBlockCut') : nameOf(block),
    flag: flagOf(block),
  })),
);
// 代码下面的说明：一句一行，先说处理了什么、有什么不对，最后一行说读到了什么。
const check = computed(() => {
  const result = read.value;
  if (result.empty) return null;
  if (!result.blocks.length) return { tone: 'bad', lines: [t('frameCheckNotFound')] };
  const block = chosen.value;
  if (block.cut) return { tone: 'bad', lines: [t('frameCheckCut', several.value)] };
  if (block.broken)
    return { tone: 'bad', lines: [t('frameCheckBroken', several.value, block.line)] };
  const lines = [];
  if (result.trimmed) lines.push(t('frameCheckTrimmed'));
  if (block.scripts) lines.push(t('frameCheckScripts', block.scripts));
  if (!block.box) lines.push(t('frameCheckBox'));
  const named = filled(block.meta.name);
  const described = filled(block.meta.intro);
  lines.push(
    named
      ? t('frameCheckRead', nameOf(block), languagesOf(block.meta), block.motion, described)
      : t('frameCheckUnnamed', block.motion, described),
  );
  const warn = block.scripts || !block.box || !named || !described;
  return { tone: warn ? 'warn' : 'ok', lines };
});
// 右栏名字下面、介绍前面的短提醒：黄的能保存，红的不能。没问题时不出现。
const callout = computed(() => {
  if (read.value.empty) return null;
  const block = chosen.value;
  if (!block) return { tone: 'bad', lines: [t('frameShortNotFound')] };
  if (block.cut) return { tone: 'bad', lines: [t('frameShortCut')] };
  if (block.broken) return { tone: 'bad', lines: [t('frameShortBroken')] };
  const lines = [];
  if (!block.box) lines.push(t('frameShortBox'));
  if (block.scripts) lines.push(t('frameShortScripts'));
  const named = filled(block.meta.name);
  const described = filled(block.meta.intro);
  if (!named || !described)
    lines.push(
      t(
        !named && !described
          ? 'frameShortNoText'
          : named
            ? 'frameShortNoIntro'
            : 'frameShortNoName',
      ),
    );
  return lines.length ? { tone: 'warn', lines } : null;
});
// 右栏试戴的：选着的那一段；还没有能用的代码时只写名字和一句说明。
// 名字下面的署名和第几版：署名照代码里写的；第几版是保存后的样子——编辑时改过了是现在的下一版、没改是现在这一版
// （插件保存时自己加 1，见 custom/store.js 的 updateFrame），新建的照代码里写的（导出来的头像框带着它改过几次）。
const preview = computed(() => {
  const block = chosen.value;
  const stored = editing.value ? customFrame(props.frameId) : null;
  const now = stored ? creditOf(stored.meta) : null;
  if (usable(block)) {
    const [name, intro] = frameText(block.meta, lang.value, t('frameUnnamed'));
    const { author, edition } = creditOf(block.meta);
    return {
      code: block.code,
      name,
      intro: intro || t('frameNoIntro'),
      author,
      edition: now ? now.edition + (unchanged.value ? 0 : 1) : edition,
    };
  }
  const name = editing.value ? editName.value : t('frameNewTitle');
  return {
    code: '',
    name,
    intro: read.value.empty ? t('framePreviewEmpty') : '',
    author: now?.author || '',
    edition: now?.edition || 0,
  };
});
// 最下面一行：理由和「保存」（不能保存时灰掉）。
const foot = computed(() => {
  if (several.value && batch.value) {
    const n = picked.value.length;
    return {
      why: n > 1 ? t('frameWhySaveMany', n) : n ? t('frameWhySaveNew') : t('frameWhyPickFirst'),
      label: t('frameSaveCount', n),
      ok: n > 0,
    };
  }
  const block = chosen.value;
  let why = editing.value ? t('frameWhySaveEdit') : t('frameWhySaveNew');
  if (read.value.empty) why = t('frameWhyPasteFirst');
  else if (!block) why = t('frameShortNotFound');
  else if (block.cut) why = t('frameWhyCut');
  else if (block.broken) why = t('frameWhyBroken');
  else if (unchanged.value) why = t('frameWhyUnchanged');
  return { why, label: t('frameSave'), ok: usable(block) && !unchanged.value };
});
// 编辑时，读出来的代码（整理成标准格式后）和存着的一样：没有改动，「保存」灰掉。
// 存着的就是整理过的，再整理一遍不会变，所以直接比；只改了 revisions（改过几次）那个数也算没改（见 read.js 的 sameFrame）。
const unchanged = computed(
  () =>
    editing.value &&
    usable(chosen.value) &&
    sameFrame(chosen.value.code, customFrame(props.frameId)?.code || ''),
);
// 有没有没保存的内容（离开编辑区之前问一下，见 FrameDialog.vue 的 leaveEditor）：写了想法，或者代码和打开时不一样。
// 编辑时代码整理成标准格式后和存着的一样（「保存」灰着的那种，只改了 revisions 的也算）不算改动。不等打字停下，按现在框里的算。
function unsaved() {
  if (idea.value.trim()) return true;
  const source = text.value.trim();
  if (!editing.value) return Boolean(source);
  const stored = customFrame(props.frameId)?.code || '';
  if (source === stored.trim()) return false;
  const { blocks } = readPaste(text.value);
  return !(blocks.length === 1 && sameFrame(blocks[0].code, stored));
}
defineExpose({ unsaved });
function save() {
  if (!foot.value.ok) return;
  if (several.value && batch.value) {
    const ids = saveCustomFrames(picked.value.map((i) => read.value.blocks[i].code));
    emit('saved', { ids, kind: 'many' });
    return;
  }
  const code = chosen.value.code;
  // 编辑的那个已经不在了（比如在别的标签页里删了）：当作新的存。
  if (editing.value && updateCustomFrame(props.frameId, code))
    emit('saved', { ids: [props.frameId], kind: 'edit' });
  else emit('saved', { ids: saveCustomFrames([code]), kind: 'new' });
}

// —— 提示词 ——
// 编辑时带上现在的代码：代码框里能用的那一段，没有就是原来的。
const prompt = computed(() =>
  framePrompt(lang.value, {
    idea: idea.value,
    motion: motion.value,
    count: count.value,
    code: editing.value ? (usable(chosen.value) ? chosen.value.code : original?.code || '') : '',
  }),
);
const promptView = computed(() => promptParts(prompt.value));
// 右栏顶上的切换：试戴 / 提示词全文。复制之后留在提示词这边，粘贴代码时切回试戴。
const promptOpen = ref(false);
const tabs = computed(() => [
  { value: 'try', label: t('frameTabTry') },
  { value: 'prompt', label: t('frameTabPrompt') },
]);
function copy(which) {
  navigator.clipboard
    .writeText(promptText(prompt.value))
    .then(() => {
      copiedNote.value = true;
      flashed.value = which;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => (flashed.value = ''), 2000);
    })
    .catch((error) => console.error('Colorforces: copy failed', error));
}
// 占位文字：露出大致的结构（两格缩进），每行不超过代码框的宽度。代码不分语言。
const PLACEHOLDER = [
  '<svg viewBox="-20 -20 160 160" ...>',
  '  <metadata><![CDATA[{',
  '    "format": "colorforces-frame",',
  '    "name": { ... },',
  '    "intro": { ... }',
  '  }]]></metadata>',
  '  <style>@keyframes ... { ... }</style>',
  '  <g>...</g>',
  '</svg>',
].join('\n');
onBeforeUnmount(() => {
  clearTimeout(settleTimer);
  clearTimeout(flashTimer);
});
</script>
<template>
  <div class="cf-frame-view">
    <!-- 中栏：左上角返回和「自定义 / 新建头像框」，下面两步。左边一列放返回按钮和两步的序号，竖着对齐。 -->
    <div class="cf-frame-dialog-main cf-scrollbar">
      <div class="cf-frame-dialog-tools cf-frame-editor-head">
        <button
          type="button"
          class="cf-frame-back"
          :data-tooltip="t('frameBackToCustom')"
          @click="emit('back')"
        >
          <InlineSvg :source="icons.back" />
        </button>
        <span class="cf-frame-crumb">
          <button type="button" class="cf-frame-crumb-link" @click="emit('back')">
            {{ t('frameCatCustom') }}</button
          ><span class="cf-frame-crumb-sep">/</span
          ><b>{{ editing ? t('frameEditTitle', editName) : t('frameNewTitle') }}</b>
        </span>
      </div>
      <div class="cf-frame-editor">
        <section class="cf-frame-step">
          <span class="cf-frame-step-no">1</span>
          <div class="cf-frame-step-head">
            <b>{{ editing ? t('frameStepIdeaEdit') : t('frameStepIdea') }}</b
            ><small>{{ editing ? t('frameStepIdeaEditHint') : t('frameStepIdeaHint') }}</small>
          </div>
          <textarea
            v-model="idea"
            class="cf-frame-idea"
            :placeholder="editing ? t('frameIdeaEditPlaceholder') : t('frameIdeaPlaceholder')"
          ></textarea>
          <div class="cf-frame-step-line">
            <CountPicker v-model:count="count" v-model:motion="motion" />
            <button
              type="button"
              class="cf-aurora-btn cf-aurora-btn--soft cf-frame-copy"
              :class="{ 'is-copied': flashed === 'main' }"
              @click="copy('main')"
            >
              <Transition name="cf-frame-fade" mode="out-in"
                ><InlineSvg
                  :key="flashed === 'main' ? 'done' : 'copy'"
                  :source="flashed === 'main' ? icons.check : assets.USER_MENU_ICONS.copy"
              /></Transition>
              <SmoothText
                :text="flashed === 'main' ? t('storageCopiedBtn') : t('frameCopyPrompt')"
              />
            </button>
          </div>
          <ExpandTransition :show="copiedNote">
            <div class="cf-frame-copied">
              <span class="cf-frame-copied-icon"><InlineSvg :source="icons.success" /></span>
              <div>
                <b>{{ t('framePromptCopied') }}</b
                ><span>{{ t('framePromptCopiedHint') }}</span>
              </div>
            </div>
          </ExpandTransition>
        </section>
        <section class="cf-frame-step">
          <span class="cf-frame-step-no">2</span>
          <div class="cf-frame-step-head">
            <b>{{ editing ? t('frameStepCodeEdit') : t('frameStepCode') }}</b
            ><small>{{ editing ? t('frameStepCodeEditHint') : t('frameStepCodeHint') }}</small>
          </div>
          <CodeBox
            v-model="text"
            :placeholder="PLACEHOLDER"
            :label="t('frameStepCode')"
            @paste="onPaste"
          />
          <!-- 好几段：上面一行「N 段代码 / 批量保存」（批量保存时是选择工具），下面一样大的格子。 -->
          <ExpandTransition :show="several">
            <div class="cf-frame-picks">
              <div class="cf-frame-picks-bar">
                <Transition name="cf-frame-fade" mode="out-in">
                  <SelectTools
                    v-if="batch"
                    key="batch"
                    :count="picked.length"
                    :total="usableCount"
                    kind="blocks"
                    @all="selectAll"
                    @none="selected = new Set()"
                    @exit="exitBatch"
                  />
                  <span v-else key="plain" class="cf-frame-picks-plain">
                    <span class="cf-frame-select-count">{{
                      editing
                        ? t('frameBlocksReplace', read.blocks.length)
                        : t('frameBlocks', read.blocks.length)
                    }}</span>
                    <button
                      v-if="!editing"
                      type="button"
                      class="cf-aurora-btn cf-aurora-btn--soft cf-frame-small"
                      @click="enterBatch"
                    >
                      <InlineSvg :source="icons.selectAll" />{{ t('frameBatchSave') }}
                    </button>
                  </span>
                </Transition>
              </div>
              <TransitionGroup name="cf-frame-tiles" tag="div" class="cf-frame-picks-grid">
                <button
                  v-for="tile in tiles"
                  :key="tile.i"
                  type="button"
                  class="cf-frame-pick cf-frame-host"
                  :class="{
                    'is-on': !batch && tile.i === index,
                    'is-chosen': batch && picked.includes(tile.i),
                    'is-unchosen': batch && !picked.includes(tile.i),
                    'is-cut': !usable(tile.block),
                  }"
                  :disabled="batch && !usable(tile.block)"
                  @click="choose(tile.i)"
                >
                  <span class="cf-frame-pick-top"
                    ><Transition name="cf-frame-fade"
                      ><span
                        v-if="tile.flag"
                        :key="tile.flag[1]"
                        class="cf-frame-pick-flag"
                        :class="'is-' + tile.flag[0]"
                        >{{ tile.flag[1] }}</span
                      ></Transition
                    ></span
                  >
                  <span class="cf-frame-pick-stage"
                    ><span class="cf-frame-pick-face"
                      ><img v-if="picture" :src="picture" alt="" /><AvatarFrame
                        :code="usable(tile.block) ? tile.block.code : ''" /></span
                  ></span>
                  <span class="cf-frame-pick-name">{{ tile.name }}</span>
                </button>
              </TransitionGroup>
            </div>
          </ExpandTransition>
          <Transition name="cf-frame-fade" mode="out-in">
            <div
              v-if="check"
              :key="check.tone + check.lines.join('\n')"
              class="cf-frame-check"
              :class="'is-' + check.tone"
            >
              <p v-for="(line, i) in check.lines" :key="i">{{ line }}</p>
            </div>
          </Transition>
        </section>
      </div>
    </div>
    <!-- 右栏：顶上「试戴 / 提示词全文」，下面是试戴的样子或提示词全文，最下面一行是理由和按钮。 -->
    <div class="cf-frame-dialog-aside">
      <div class="cf-frame-editor-aside">
        <div class="cf-frame-tabs">
          <SegmentedSwitch
            :model-value="promptOpen ? 'prompt' : 'try'"
            :options="tabs"
            @update:model-value="(value) => (promptOpen = value === 'prompt')"
          />
        </div>
        <Transition name="cf-frame-fade" mode="out-in">
          <div v-if="promptOpen" key="prompt" class="cf-frame-prompt-pane">
            <!-- 换语言时整段淡出、新的淡入（代码块不在换语言的逐项过渡里）。平时改想法、换动效只换字，不淡。 -->
            <Transition name="cf-frame-fade" mode="out-in">
              <pre
                :key="lang"
                class="cf-frame-prompt cf-scrollbar">{{ promptView[0] }}<mark>{{ promptView[1] }}</mark>{{ promptView[2] }}</pre>
            </Transition>
            <div class="cf-frame-preview-foot">
              <span class="cf-frame-why"
                ><span>{{ t('framePromptLive') }}</span></span
              >
              <button
                type="button"
                class="cf-aurora-btn cf-aurora-btn--soft cf-frame-act cf-frame-copy"
                :class="{ 'is-copied': flashed === 'pane' }"
                @click="copy('pane')"
              >
                <SmoothText :text="flashed === 'pane' ? t('storageCopiedBtn') : t('frameCopy')" />
              </button>
            </div>
          </div>
          <FramePreview
            v-else
            key="try"
            class="cf-frame-editor-preview"
            :code="preview.code"
            :picture="picture"
            :name="preview.name"
            :kind="preview.code ? t('frameKindCustom') : ''"
            :author="preview.author"
            :edition="preview.edition"
            :intro="preview.intro"
          >
            <template #before>
              <Transition name="cf-frame-fade" mode="out-in">
                <div
                  v-if="callout"
                  :key="callout.tone + callout.lines.join('\n')"
                  class="cf-frame-callout"
                  :class="'is-' + callout.tone"
                >
                  <InlineSvg :source="callout.tone === 'bad' ? icons.bad : icons.warn" />
                  <span
                    ><span v-for="(line, i) in callout.lines" :key="i">{{ line }}</span></span
                  >
                </div>
              </Transition>
            </template>
            <template #foot>
              <Transition name="cf-frame-fade" mode="out-in">
                <span :key="foot.why" class="cf-frame-why"
                  ><span>{{ foot.why }}</span></span
                >
              </Transition>
              <button
                type="button"
                class="cf-aurora-btn cf-aurora-btn--soft cf-frame-act"
                :disabled="!foot.ok"
                @click="save"
              >
                <SmoothText :text="foot.label" />
              </button>
            </template>
          </FramePreview>
        </Transition>
      </div>
    </div>
  </div>
</template>
<style>
/* 编辑区左上角：圆形返回按钮 + 「自定义 / 新建头像框」。和淡色按钮同一套渐变和边。 */
.cf-frame-dialog-tools.cf-frame-editor-head {
  justify-content: flex-start;
  align-items: center;
  gap: 10px;
  min-height: 28px;
  margin-bottom: 18px;
}
.cf-frame-back {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #c3caee;
  border-radius: 50%;
  background: linear-gradient(135deg, #eef1fd, #f3eefc);
  box-shadow:
    inset 0 1px 0 #fff,
    0 4px 10px -7px #8590cf;
  color: #4e5aa8;
  cursor: pointer;
  transition:
    border-color var(--cf-duration-fast) ease,
    box-shadow var(--cf-duration-fast) ease,
    transform var(--cf-duration-fast) ease;
}
.cf-frame-back:hover {
  border-color: #aeb8ea;
  box-shadow:
    inset 0 1px 0 #fff,
    0 6px 12px -7px #8590cf;
  transform: translateX(-1px);
}
.cf-frame-back svg {
  width: 14px;
  height: 14px;
}
.cf-frame-crumb {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.cf-frame-crumb-link {
  flex: none;
  padding: 0;
  border: 0;
  background: none;
  color: var(--cf-aurora-muted);
  font: inherit;
  cursor: pointer;
  transition: color var(--cf-duration-fast) ease;
}
.cf-frame-crumb-link:hover {
  color: #4e5aa8;
}
.cf-frame-crumb-sep {
  color: #c3caee;
}
.cf-frame-crumb b {
  overflow: hidden;
  color: var(--cf-control-ink);
  font-weight: var(--cf-font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 两步：左边一列是序号（和返回按钮竖着对齐），内容都从同一条线开始。 */
.cf-frame-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-left: 40px;
}
.cf-frame-step {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* 标题和后面的说明排成一段文字：标题一行写完不折开，说明接在后面，放不下时折到标题下面、从行首接着写
   （不是挂在说明自己那一栏里）。 */
.cf-frame-step-head {
  color: var(--cf-control-ink);
}
.cf-frame-step-head b {
  margin-right: 8px;
  white-space: nowrap;
}
.cf-frame-step-head small {
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
}
.cf-frame-step-no {
  position: absolute;
  top: -1px;
  left: -36px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #eef1fd, #f3eefc);
  box-shadow: inset 0 0 0 1px #c3caee;
  color: #4e5aa8;
  font-size: var(--cf-font-size-2xs);
  font-weight: var(--cf-font-weight-semibold);
}
.cf-frame-idea {
  width: 100%;
  height: 64px;
  padding: 8px 10px;
  border: 1px solid var(--cf-surface-border);
  border-radius: var(--cf-radius-md);
  outline: none;
  background: var(--cf-control-surface);
  box-sizing: border-box;
  color: var(--cf-aurora-text);
  font: inherit;
  font-size: var(--cf-font-size-base);
  line-height: 20px;
  resize: none;
  transition:
    border-color var(--cf-duration-fast) ease,
    box-shadow var(--cf-duration-fast) ease;
}
.cf-frame-idea:focus {
  border-color: color-mix(in srgb, var(--cf-menu-accent) 60%, var(--cf-surface-border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--cf-menu-accent) 18%, transparent);
}
.cf-frame-step-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
/* 复制的反馈：照插件「复制 JSON」那个按钮，变绿，图标换成勾，文字换成「已复制!」，2 秒后变回来。 */
.cf-frame-copy svg {
  width: 14px;
  height: 14px;
}
.cf-aurora-btn.cf-frame-copy.is-copied,
.cf-aurora-btn.cf-frame-copy.is-copied:hover {
  border-color: #a9dcc6;
  background: #e6f7efd9;
  box-shadow: none;
  color: #2f9a6b;
}
/* 「已复制提示词」：复制按钮下面的淡紫卡片，第一行粗体，第二行说明，左边白底圆里的绿勾。 */
.cf-frame-copied {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid #c3caee;
  border-radius: var(--cf-radius-lg);
  background: linear-gradient(135deg, #eef1fd, #f3eefc);
  box-shadow:
    inset 0 1px 0 #fff,
    0 5px 12px -8px #8590cf;
  font-size: var(--cf-font-size-base);
  line-height: 1.5;
}
.cf-frame-copied b {
  display: block;
  color: var(--cf-control-ink);
  font-weight: var(--cf-font-weight-semibold);
}
.cf-frame-copied div > span {
  display: block;
  color: var(--cf-aurora-muted);
  font-size: var(--cf-font-size-xs);
}
.cf-frame-copied-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 1px #d4ece0;
  color: #2f9a6b;
}
/* 好几段：上面一行，下面一样大的格子。格子分三行：上面标签，中间试戴（头像框只在这一块里），下面名字。 */
.cf-frame-picks {
  padding-bottom: 8px;
}
.cf-frame-picks-bar {
  display: flex;
  align-items: center;
  min-height: 28px;
  margin-bottom: 8px;
}
.cf-frame-picks-plain {
  display: flex;
  flex: 1;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.cf-frame-picks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 6px;
}
.cf-frame-pick {
  display: grid;
  grid-template-rows: 22px 58px 22px;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--cf-surface-border);
  border-radius: var(--cf-radius-lg);
  background: #ffffffa8;
  color: var(--cf-aurora-text);
  font: inherit;
  cursor: pointer;
  transition:
    border-color var(--cf-duration-fast) ease,
    background-color var(--cf-duration-fast) ease,
    box-shadow var(--cf-duration-fast) ease,
    color var(--cf-duration-fast) ease,
    opacity var(--cf-duration-fast) ease;
}
.cf-frame-pick:hover {
  border-color: #c3caee;
}
.cf-frame-pick.is-on {
  border-color: #aeb8ea;
  background: #eff0fd;
  box-shadow:
    inset 0 1px 0 #fff,
    0 5px 12px -8px #8590cf;
  color: #4e5aa8;
}
.cf-frame-pick.is-chosen {
  border-color: var(--cf-menu-accent);
  background: #ebeafc;
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--cf-menu-accent) 20%, transparent),
    inset 0 1px 0 #fff;
  color: #3f4c99;
}
.cf-frame-pick.is-unchosen {
  opacity: 0.62;
}
.cf-frame-pick.is-unchosen:not(:disabled):hover {
  opacity: 0.85;
}
.cf-frame-pick.is-cut {
  color: var(--cf-aurora-muted);
}
.cf-frame-pick.is-cut .cf-frame-pick-face {
  opacity: 0.45;
}
.cf-frame-pick:disabled {
  cursor: not-allowed;
}
.cf-frame-pick-top {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 4px 5px 0;
}
.cf-frame-pick-flag {
  padding: 0 6px;
  border-radius: 999px;
  font-size: var(--cf-font-size-2xs);
  line-height: 16px;
}
.cf-frame-pick-flag.is-warn {
  background: #fdf3df;
  color: #9a6514;
}
.cf-frame-pick-flag.is-bad {
  background: #fdebec;
  color: #b2404a;
}
.cf-frame-pick-stage {
  display: grid;
  place-items: center;
  overflow: hidden;
}
.cf-frame-pick-face {
  position: relative;
  width: 29px;
  height: 29px;
  border-radius: 50%;
  background: var(--cf-gray-100);
}
.cf-frame-pick-face > img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.cf-frame-pick-name {
  min-width: 0;
  padding: 0 6px;
  overflow: hidden;
  font-size: var(--cf-font-size-xs);
  line-height: 18px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cf-frame-pick.is-on .cf-frame-pick-name,
.cf-frame-pick.is-chosen .cf-frame-pick-name {
  font-weight: var(--cf-font-weight-semibold);
}
/* 代码下面的说明：一句一行；绿的读好了，黄的能用但有问题，红的用不了。 */
.cf-frame-check {
  padding: 6px 10px;
  border-radius: var(--cf-radius-md);
  font-size: var(--cf-font-size-xs);
  line-height: 17px;
}
.cf-frame-check p {
  margin: 0;
}
.cf-frame-check.is-ok {
  background: #e7f6ef;
  color: #2b7a57;
}
.cf-frame-check.is-warn,
.cf-frame-callout.is-warn {
  background: #fdf3df;
  color: #9a6514;
}
.cf-frame-check.is-bad,
.cf-frame-callout.is-bad {
  background: #fdebec;
  color: #b2404a;
}
/* 右栏：顶上切换，下面试戴或提示词全文。 */
.cf-frame-editor-aside {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.cf-frame-tabs {
  flex: none;
  padding: 0 16px 10px;
}
/* 试戴那一块占满切换下面剩下的高度（它自己默认是整栏高）。 */
.cf-frame-editor-aside > .cf-frame-editor-preview {
  flex: 1;
  height: auto;
  min-height: 0;
}
.cf-frame-editor-preview .cf-frame-preview-stage {
  padding-top: 40px;
}
/* 名字下面、介绍前面的一句短提醒：带图标、淡底色的一小块，一条一行。 */
.cf-frame-callout {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0 0 10px;
  padding: 6px 10px;
  border-radius: var(--cf-radius-md);
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-semibold);
  line-height: 18px;
}
.cf-frame-callout svg {
  flex: none;
  width: 14px;
  height: 14px;
  margin-top: 2px;
}
.cf-frame-callout > span > span {
  display: block;
}
.cf-frame-prompt-pane {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}
.cf-frame-prompt {
  flex: 1;
  min-height: 0;
  margin: 0 12px 0;
  padding: 10px 12px;
  overflow: auto;
  border: 1px solid var(--cf-surface-border);
  border-radius: var(--cf-radius-md);
  background: #fbfcff;
  color: #56627b;
  font-family: Consolas, 'Cascadia Mono', Menlo, monospace;
  font-size: var(--cf-font-size-xs);
  line-height: 18px;
  white-space: pre-wrap;
  word-break: break-word;
}
.cf-frame-prompt mark {
  padding: 1px 2px;
  border-radius: 3px;
  background: #ffe08a80;
  color: inherit;
}
</style>
