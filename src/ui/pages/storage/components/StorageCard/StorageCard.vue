<script setup>
import { computed } from 'vue';
import { translate as t } from '../../../../../i18n/index.js';
import { formatStorageBytes } from '../../../../../features/storage/overview.js';
import * as assets from '../../../../../assets/index.js';
import InlineSvg from '../../../../components/icons/InlineSvg/InlineSvg.vue';
const props = defineProps({ group: Object, data: Object });
defineEmits(['clear', 'view']);
const countLabel = computed(() =>
  props.group.id === 'settings' ||
  props.data.count > 0 ||
  (props.group.id === 'solved' && props.data.bytes > 0 && props.data.keys.length)
    ? t(props.data.countKey, props.data.count)
    : t('storageClearedBadge'),
);
</script>
<template>
  <div class="cf-storage-item">
    <div class="cf-storage-item-main">
      <div
        class="cf-storage-icon-box"
        :class="'icon-' + (group.id === 'local' ? 'legacy' : group.id)"
      >
        <img
          v-if="group.id === 'clist'"
          :src="assets.clistImage"
          width="18"
          height="18"
          style="border-radius: 2px"
          alt="CList"
        /><InlineSvg v-else :source="assets.STORAGE_ICONS[group.id]" />
      </div>
      <div class="cf-storage-item-body">
        <div class="cf-storage-item-header">
          <span class="cf-storage-item-title" v-text="t(group.title)"></span>
          <div class="cf-storage-btn-group">
            <button type="button" class="cf-storage-btn btn-view" v-on:click="$emit('view')">
              <inline-svg v-bind:source="assets.storageViewIcon"></inline-svg
              ><span class="btn-text" v-text="t('storageViewBtn')"></span></button
            ><button
              type="button"
              class="cf-storage-btn"
              v-bind:class="group.id === 'settings' ? 'btn-reset' : 'btn-clear'"
              v-on:click="$emit('clear')"
            >
              <inline-svg
                v-bind:source="
                  group.id === 'settings' ? assets.storageResetIcon : assets.storageClearIcon
                "
              ></inline-svg
              ><span class="btn-text" v-text="t(group.action)"></span>
            </button>
          </div>
        </div>
        <div class="cf-storage-item-meta">
          <span class="cf-storage-size-val" v-text="formatStorageBytes(data.bytes)"></span
          ><span class="cf-storage-meta-dot">·</span
          ><span class="cf-storage-count-tag" v-text="countLabel"></span>
        </div>
      </div>
    </div>
    <p class="cf-storage-item-desc" v-text="t(group.description)"></p>
  </div>
</template>
