<script setup>
defineProps({ controller: { type: Object, required: true }, open: Boolean });
</script>
<template>
  <template v-if="open && controller.size.enabled">
    <div
      v-for="edge in controller.edges"
      :key="edge"
      class="cf-menu-resize-handle"
      :class="['cf-menu-resize-' + edge, { 'is-dragging': controller.resizing }]"
      :data-resize-edge="edge"
      aria-hidden="true"
      @pointerdown="controller.startResize($event, edge)"
      @pointermove="controller.moveDrag"
      @pointerup="controller.finishDrag"
      @pointercancel="controller.finishDrag"
      @lostpointercapture="controller.finishDrag"
    />
  </template>
</template>
<style scoped>
.cf-menu-resize-handle {
  position: absolute;
  z-index: 6;
  touch-action: none;
  user-select: none;
}
.cf-menu-resize-west,
.cf-menu-resize-east {
  top: 14px;
  bottom: 14px;
  width: 5px;
  cursor: ew-resize;
}
.cf-menu-resize-west {
  left: 0;
}
.cf-menu-resize-east {
  right: 0;
}
.cf-menu-resize-north,
.cf-menu-resize-south {
  left: 14px;
  right: 14px;
  height: 5px;
  cursor: ns-resize;
}
.cf-menu-resize-north {
  top: 0;
}
.cf-menu-resize-south {
  bottom: 0;
}
.cf-menu-resize-northwest,
.cf-menu-resize-northeast,
.cf-menu-resize-southwest,
.cf-menu-resize-southeast {
  width: 16px;
  height: 16px;
}
.cf-menu-resize-northwest {
  left: 0;
  top: 0;
  cursor: nwse-resize;
}
.cf-menu-resize-northeast {
  right: 0;
  top: 0;
  cursor: nesw-resize;
}
.cf-menu-resize-southwest {
  left: 0;
  bottom: 0;
  cursor: nesw-resize;
}
.cf-menu-resize-southeast {
  right: 0;
  bottom: 0;
  cursor: nwse-resize;
}
.cf-menu-resize-handle::after {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--cf-menu-accent) 45%, transparent);
  opacity: 0;
  transition: opacity 140ms ease;
  pointer-events: none;
}
.cf-menu-resize-handle:hover::after,
.cf-menu-resize-handle.is-dragging::after {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .cf-menu-resize-handle::after {
    transition: none;
  }
}
</style>
