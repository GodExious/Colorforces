<script setup>
import { ref, nextTick } from 'vue';
import { translate as t } from '../../../../../../../i18n/index.js';
import { USER_MENU_ICONS } from '../../../../../../../assets/index.js';
import { MEMO_LIMIT } from '../../../../../../../features/user/groups/store.js';
import InlineSvg from '../../../../../../components/icons/InlineSvg/InlineSvg.vue';
import { keepWithinLimit } from '../../../../../../../utils/input-limit.js';
// 横向名片右栏里的备注：一张淡灰底的卡片，左上角羽毛笔和「备注」，下面是备注的字；用的地方让它撑满空处。
// 点一下（或者在它上面按回车、空格）就地改：字换成能折行的输入框，跟着字长高，字数写在「备注」那一行的右边
// （输入框和原来的字一样高，不在下面另让位置，换过去时卡片不变高，菜单不会被顶起来）；
// 回车保存（输入法拼字时的回车是选字，不算），Esc 不改，点到别处也保存。备注是一行字，回车不换行，太长了自己折行。
// 不在任何分组里时不能写：灰掉，写着要先加入分组。
//   memo 现在的备注；locked 为真时不能写。事件 save(text)：要存的备注（连着的空白并成一个、两头去掉）。
const props = defineProps({
  memo: { type: String, default: '' },
  locked: Boolean,
});
const emit = defineEmits(['save']);
const editing = ref(false),
  draft = ref(''),
  box = ref(null);
// 输入框跟着字长高、变矮（折行、删字），高度滑过去：先不带过渡量出要多高，放回原来的高度，再滑到新的高度。
// 卡片放得下时卡片不变；放不下时卡片和菜单跟着它一起滑。刚换成输入框时直接定好，不滑。
function fit(animate = true) {
  const input = box.value;
  if (!input) return;
  const before = input.offsetHeight;
  input.style.transition = 'none';
  input.style.height = 'auto';
  const after = input.scrollHeight;
  if (!animate || before === after) {
    input.style.height = after + 'px';
    input.style.transition = '';
    return;
  }
  input.style.height = before + 'px';
  void input.offsetHeight;
  input.style.transition = '';
  input.style.height = after + 'px';
}
function start() {
  if (props.locked || editing.value) return;
  draft.value = props.memo;
  editing.value = true;
  nextTick(() => {
    fit(false);
    box.value?.focus();
    box.value?.setSelectionRange(draft.value.length, draft.value.length);
  });
}
function finish(save) {
  if (!editing.value) return;
  editing.value = false;
  if (save) emit('save', draft.value.replace(/\s+/g, ' ').trim());
}
function onKey(event) {
  if (event.isComposing || event.keyCode === 229) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    finish(true);
  } else if (event.key === 'Escape') {
    // 只是不改，菜单不关。
    event.preventDefault();
    event.stopPropagation();
    finish(false);
  }
}
</script>
<template>
  <div
    class="cf-memo-card"
    :class="{ 'is-editing': editing, 'is-locked': locked }"
    :tabindex="locked || editing ? -1 : 0"
    :aria-disabled="locked || undefined"
    @click="start"
    @keydown.enter.self.prevent="start"
    @keydown.space.self.prevent="start"
  >
    <span class="cf-memo-card-head"
      ><InlineSvg class="cf-user-menu-icon" :source="USER_MENU_ICONS.quill" /><span>{{
        t('groupsMenuMemo')
      }}</span
      ><Transition name="cf-user-menu-swap"
        ><span
          v-if="editing"
          class="cf-memo-card-count"
          :class="{ 'is-full': draft.length >= MEMO_LIMIT }"
          >{{ draft.length }}/{{ MEMO_LIMIT }}</span
        ></Transition
      ></span
    >
    <textarea
      v-if="editing"
      ref="box"
      v-model="draft"
      class="cf-memo-card-input"
      rows="1"
      :maxlength="MEMO_LIMIT"
      @beforeinput="keepWithinLimit"
      :placeholder="t('groupsMemoPlaceholder')"
      @input="fit()"
      @keydown="onKey"
      @blur="finish(true)"
    ></textarea>
    <p v-else class="cf-memo-card-text" :class="{ 'is-muted': locked || !memo }">
      {{ locked ? t('groupsMemoLocked') : memo || t('groupsMemoPlaceholder') }}
    </p>
  </div>
</template>
<style>
.cf-memo-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 64px;
  padding: 8px 10px 10px;
  border-radius: var(--cf-radius-md);
  outline: none;
  background: var(--cf-gray-50);
  box-shadow: inset 0 0 0 1px var(--cf-gray-100);
  box-sizing: border-box;
  cursor: text;
  transition:
    background-color var(--cf-duration-fast) ease,
    box-shadow var(--cf-duration-fast) ease,
    opacity var(--cf-duration-base) ease;
}
.cf-memo-card:hover:not(.is-editing, .is-locked),
.cf-memo-card:focus-visible {
  background: var(--cf-gray-100);
}
/* 正在改：白底，一圈主题色的边和光圈（和新建分组的输入框一样）。 */
.cf-memo-card.is-editing {
  background: var(--cf-white-surface);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--cf-menu-accent) 55%, transparent),
    0 0 0 2px color-mix(in srgb, var(--cf-menu-accent) 22%, transparent);
  cursor: auto;
}
.cf-memo-card.is-locked {
  cursor: not-allowed;
  opacity: 0.55;
}
.cf-memo-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-xs);
  line-height: 16px;
}
.cf-memo-card-head .cf-user-menu-icon {
  width: 14px;
  height: 14px;
}
.cf-memo-card-text,
.cf-memo-card-input {
  margin: 0;
  color: var(--cf-gray-700);
  font: inherit;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.cf-memo-card-text.is-muted {
  color: var(--cf-gray-400);
}
/* 输入框：没有框（框画在卡片上），和原来的字一样排；换上时淡入一下。 */
.cf-memo-card-input {
  display: block;
  width: 100%;
  min-height: 20px;
  padding: 0;
  border: 0;
  outline: none;
  background: none;
  resize: none;
  overflow: hidden;
  user-select: text;
  animation: cf-memo-card-in var(--cf-duration-fast) ease;
  transition: height var(--cf-duration-fast) var(--cf-ease-out);
}
.cf-memo-card-input::placeholder {
  color: var(--cf-gray-400);
}
@keyframes cf-memo-card-in {
  from {
    opacity: 0.4;
  }
}
.cf-memo-card-count {
  margin-left: auto;
  color: var(--cf-gray-400);
  font-size: var(--cf-font-size-2xs);
  font-variant-numeric: tabular-nums;
  line-height: 12px;
  transition: color var(--cf-duration-fast) ease;
}
.cf-memo-card-count.is-full {
  color: color-mix(in srgb, var(--cf-menu-accent) 46%, #27364e);
}
@media (prefers-reduced-motion: reduce) {
  .cf-memo-card,
  .cf-memo-card-input {
    transition: none;
    animation: none;
  }
}
</style>
