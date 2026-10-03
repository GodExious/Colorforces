<script setup>
defineProps({ status: String, busy: Boolean, disabled: Boolean });
</script>
<template>
  <button
    type="button"
    class="cf-action-button"
    :data-state="status || 'idle'"
    :disabled="busy || disabled"
    :aria-busy="busy"
  >
    <slot />
  </button>
</template>
<style>
/* 查询和同步共用基础外观，结果色由状态决定，不由鼠标事件写入。 */
.cf-action-button {
  --cf-action-color: var(--cf-menu-accent, #3b82f6);
  --cf-action-ink: color-mix(in srgb, var(--cf-action-color) 40%, #243447);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 5px 12px;
  font-size: var(--cf-font-size-base);
  font-weight: var(--cf-font-weight-medium);
  line-height: 18px;
  color: var(--cf-action-ink);
  background: color-mix(in srgb, var(--cf-action-color) 22%, var(--cf-card-surface, #ffffff));
  border: 1px solid color-mix(in srgb, var(--cf-action-color) 48%, var(--cf-card-surface, #ffffff));
  box-shadow:
    inset 0 1px 0 #ffffff60,
    0 1px 2px color-mix(in srgb, var(--cf-action-color) 12%, transparent);
  border-radius: var(--cf-radius-sm);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    color 180ms ease,
    box-shadow 180ms ease;
}
.cf-action-button:not(:disabled):hover {
  background: color-mix(in srgb, var(--cf-action-color) 32%, var(--cf-card-surface, #ffffff));
  color: var(--cf-action-ink);
  border-color: color-mix(in srgb, var(--cf-action-color) 65%, var(--cf-card-surface, #ffffff));
  box-shadow:
    inset 0 1px 0 #ffffff60,
    0 2px 5px color-mix(in srgb, var(--cf-action-color) 17%, transparent);
}
.cf-action-button:focus-visible {
  outline: 2px solid var(--cf-action-color);
  outline-offset: 2px;
}
.cf-action-button[data-state='preview'] {
  --cf-action-color: #0284c7;
}
.cf-action-button[data-state='latest'] {
  --cf-action-color: #168451;
}
.cf-action-button[data-state='failed'] {
  --cf-action-color: #c74747;
}
.cf-action-button:is([data-state='preview'], [data-state='latest'], [data-state='failed']) {
  border-color: color-mix(in srgb, var(--cf-action-color) 58%, var(--cf-card-surface, #ffffff));
}
.cf-action-button:disabled,
.cf-action-button.cooldown {
  cursor: not-allowed;
  box-shadow: none;
}
/* 结果提示只禁用交互，保留成功、失败和预览状态的语义色。 */
.cf-action-button:disabled:not(
    :where([data-state='preview'], [data-state='latest'], [data-state='failed'])
  ),
.cf-action-button.cooldown {
  color: var(--cf-gray-400);
  background: var(--cf-control-surface, var(--cf-gray-50));
  border-color: var(--cf-surface-border, var(--cf-gray-200));
}
.cf-action-button[aria-busy='true'],
.cf-action-button.syncing {
  color: var(--cf-action-ink);
  background: color-mix(in srgb, var(--cf-action-color) 15%, var(--cf-card-surface, #ffffff));
  border-color: color-mix(in srgb, var(--cf-action-color) 45%, white);
  cursor: wait;
}
.cf-action-button svg {
  width: 14px;
  height: 14px;
  transition: transform 200ms ease;
}
.cf-action-button:not(:disabled):hover svg {
  transform: rotate(45deg);
}
@keyframes cfSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.cf-spin,
.cf-action-button[aria-busy='true'] svg,
.cf-action-button.syncing svg {
  animation: cfSpin 1s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .cf-action-button,
  .cf-action-button svg {
    transition: none;
  }
  .cf-action-button svg,
  .cf-spin {
    animation: none !important;
  }
}
</style>
