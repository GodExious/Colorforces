<script setup>
import { computed, inject } from 'vue';
import MenuLayoutControl from '../MenuLayoutControl/MenuLayoutControl.vue';
const sizing = inject('cf-menu-size');
const fields = computed(() => [
  {
    key: 'width',
    label: 'menuSizeWidth',
    control: 'menuWidthInput',
    min: sizing.limits.minWidth,
    max: sizing.limits.maxWidth,
    unit: 'px',
  },
  {
    key: 'height',
    label: 'menuSizeHeight',
    control: 'menuHeightInput',
    min: sizing.limits.minHeight,
    max: sizing.limits.maxHeight,
    unit: 'px',
  },
]);
</script>
<template>
  <MenuLayoutControl
    :controller="sizing"
    :fields="fields"
    :apply="sizing.setSize"
    control="cbCustomMenuSize"
    title-key="menuSizeCustom"
    hint-key="menuSizeHint"
  />
</template>
