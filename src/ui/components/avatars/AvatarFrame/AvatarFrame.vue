<script setup>
import { computed } from 'vue';
import { appSettings } from '../../../../settings.js';
import { frameImage } from '../../../../features/user/frames/catalog.js';
import { profileFrame, watchChosenFrames } from '../../../../features/user/frames/chosen.js';
// 插件界面里（分组页、管理弹窗、右键菜单）头像上套的头像框。放在头像那个圆形的元素里面，
// 那个元素要是定位过的方块（position: relative），头像框按它的大小摆：边长 2 倍，头像在正中。
// 和页面上一样是两张图片，显示哪张看根元素上的动效设置（样式在 styles/codeforces/user/frames.css）；
// 鼠标停在哪里算「移到了这个人上面」，由用它的地方在外面加 cf-frame-host。
// profile 是这个人的资料（见 features/user/groups/profiles.js），还没读到时不戴；关掉了「显示头像框」也不戴。
// 戴哪个按 choose.js：自己从头像框库里戴的、所在分组的、段位的（见 chosen.js）。
// frame 给了就直接戴它（设置里预览头像框用），不看资料和设置。
// admin 为真表示这个人是管理员（页面上认出来的），戴管理员的头像框。
// place 是这个头像所在的地方（设置里「显示位置」的一项，比如 'menus' 是右键菜单，'groups' 是分组管理），那一项关掉时不戴；不给时不看。
const props = defineProps({
  profile: { type: Object, default: null },
  frame: { type: String, default: '' },
  admin: Boolean,
  place: { type: String, default: '' },
});
watchChosenFrames();
const frame = computed(() => {
  if (props.frame) return props.frame;
  if (props.place && appSettings.user.avatar.frameAt[props.place] === false) return '';
  return profileFrame(props.profile, props.admin);
});
</script>
<template>
  <!-- 换了头像框（改了设置、读到了资料）：旧的淡出，新的长出来。 -->
  <Transition name="cf-avatar-frame">
    <span v-if="frame" :key="frame" class="cf-avatar-frame" aria-hidden="true"
      ><img
        class="cf-frame is-still"
        :src="frameImage(frame, false)"
        alt=""
        draggable="false" /><img
        class="cf-frame is-live"
        :src="frameImage(frame, true)"
        alt=""
        draggable="false"
    /></span>
  </Transition>
</template>
<style>
.cf-avatar-frame {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  pointer-events: none;
}
.cf-avatar-frame > .cf-frame {
  top: 0;
  left: 0;
  width: 100% !important;
  height: 100% !important;
}
.cf-avatar-frame-enter-active,
.cf-avatar-frame-leave-active {
  transition:
    opacity var(--cf-duration-moderate) ease,
    transform var(--cf-duration-moderate) var(--cf-ease-out);
}
.cf-avatar-frame-enter-from,
.cf-avatar-frame-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
@media (prefers-reduced-motion: reduce) {
  .cf-avatar-frame-enter-active,
  .cf-avatar-frame-leave-active {
    transition: none;
  }
}
</style>
