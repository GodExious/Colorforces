<script setup>
import { inject } from 'vue';
defineProps({ bottom: Boolean });
// 共用菜单可见性，关闭或进入后台时只暂停装饰光效。
const active = inject('cf-menu-motion-active', true);
</script>

<template>
  <div class="cf-menu-glass-surface" :class="{ 'is-bottom': bottom, 'is-resting': !active }">
    <span class="cf-menu-glass-light" aria-hidden="true"></span>
    <slot />
  </div>
</template>

<style scoped>
.cf-menu-glass-surface,
.cf-menu-glass-light::after,
.cf-menu-glass-light::before {
  --cf-paint-accent: var(--cf-menu-accent);
  --cf-paint-secondary: var(--cf-menu-secondary);
  /* 与侧栏指示条的位移同一个时长和缓动，指示条停下时玻璃的颜色也正好变完。 */
  transition:
    --cf-paint-accent 480ms cubic-bezier(0.16, 1, 0.3, 1),
    --cf-paint-secondary 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* 内容可向上弹出；只有独立的装饰层裁切，不截断贡献者名单。 */
.cf-menu-glass-surface {
  position: relative;
  isolation: isolate;
  z-index: 3;
  background: linear-gradient(
    112deg,
    color-mix(in srgb, var(--cf-paint-accent) 18%, #ffffff70),
    #ffffff45 46%,
    color-mix(in srgb, var(--cf-paint-secondary) 20%, #ffffff78)
  );
  -webkit-backdrop-filter: blur(9px) saturate(155%) contrast(102%);
  backdrop-filter: blur(9px) saturate(155%) contrast(102%);
  border-color: color-mix(in srgb, var(--cf-paint-accent) 23%, #c5d5df78);
  box-shadow:
    inset 0 1px 0 #ffffffeb,
    inset 0 2px 4px #ffffff45,
    inset 0 -1px 0 #ffffffd0,
    inset 0 -3px 5px color-mix(in srgb, var(--cf-paint-accent) 8%, transparent);
}

.cf-menu-glass-light {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  /* 跟随玻璃自身的圆角，光效不会在圆角外露出直角。 */
  border-radius: inherit;
  pointer-events: none;
}
.cf-menu-glass-light::before {
  content: '';
  position: absolute;
  inset: -80% -15%;
  background:
    radial-gradient(ellipse at 23% 50%, #ffffff70 0%, #ffffff05 32%, transparent 44%),
    conic-gradient(
      from 145deg at 65% 70%,
      transparent 0deg,
      #ffffff60 10deg,
      transparent 22deg,
      transparent 170deg,
      color-mix(in srgb, var(--cf-paint-secondary) 30%, #ffffff40) 190deg,
      transparent 204deg
    );
  filter: blur(7px);
  animation: cf-menu-glass-caustic 13s ease-in-out infinite alternate;
}
.is-bottom > .cf-menu-glass-light::before {
  animation-delay: -5s;
}
.is-resting > .cf-menu-glass-light::before {
  animation-play-state: paused;
}

.cf-menu-glass-light::after {
  content: '';
  position: absolute;
  inset-inline: 0;
  height: 2px;
  bottom: -1px;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    #ffffff30,
    #ffffffd0 20%,
    color-mix(in srgb, var(--cf-paint-accent) 28%, #e8fbffa0) 50%,
    #ffffffe0 80%,
    #ffffff30
  );
  box-shadow: 0 -2px 4px #ffffff4d;
}
.is-bottom > .cf-menu-glass-light::after {
  top: -1px;
  bottom: auto;
  background: linear-gradient(
    90deg,
    #ffffff30,
    #ffffffe0 20%,
    color-mix(in srgb, var(--cf-paint-accent) 28%, #e8fbffa0) 50%,
    #ffffffd0 80%,
    #ffffff30
  );
  box-shadow: 0 2px 4px #ffffff4d;
}

@keyframes cf-menu-glass-caustic {
  from {
    transform: translateX(-8%) rotate(-5deg);
    opacity: 0.72;
  }
  to {
    transform: translateX(8%) rotate(5deg);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cf-menu-glass-light::before {
    animation: none;
  }
  .cf-menu-glass-surface,
  .cf-menu-glass-light::after,
  .cf-menu-glass-light::before {
    transition: none;
  }
}
@supports not (backdrop-filter: blur(1px)) {
  .cf-menu-glass-surface {
    background: color-mix(in srgb, var(--cf-paint-accent) 14%, var(--cf-gray-50));
  }
}
</style>
