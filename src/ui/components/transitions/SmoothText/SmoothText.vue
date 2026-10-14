<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
// 一段会变的文字（按钮上「选中的 3 人」这种带数的、换了语言的）：文字变了时宽度从旧的滑到新的，
// 新的文字从淡到清楚。放在按内容定宽的元素里（按钮），外面的元素跟着一起变宽变窄，挨着的也跟着滑。
const props = defineProps({ text: { type: String, required: true } });
const shown = ref(props.text);
const box = ref(null);
let sliding = null,
  fading = null;
watch(
  () => props.text,
  async (next) => {
    const element = box.value;
    if (
      !element?.animate ||
      !element.getClientRects().length ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      shown.value = next;
      return;
    }
    // 上一段还没滑完就又变了：从眼下这一帧的宽度接着滑。
    const from = element.getBoundingClientRect().width;
    sliding?.cancel();
    fading?.cancel();
    shown.value = next;
    await nextTick();
    if (!element.isConnected) return;
    const to = element.getBoundingClientRect().width;
    const timing = { duration: 250, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
    if (Math.abs(to - from) > 0.5)
      sliding = element.animate([{ width: from + 'px' }, { width: to + 'px' }], timing);
    fading = element.animate([{ opacity: 0.35 }, { opacity: 1 }], { ...timing, duration: 200 });
  },
);
onBeforeUnmount(() => {
  sliding?.cancel();
  fading?.cancel();
});
</script>
<template>
  <span ref="box" class="cf-smooth-text">{{ shown }}</span>
</template>
<style>
/* 滑的过程中宽度比文字窄时，多出来的先藏着。藏东西会改变行内元素的对齐，所以顶端对齐，免得文字上下跳。 */
.cf-smooth-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  vertical-align: top;
}
</style>
