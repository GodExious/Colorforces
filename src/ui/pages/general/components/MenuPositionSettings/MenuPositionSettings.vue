<script setup>
import { inject } from 'vue';
import MenuLayoutControl from '../MenuLayoutControl/MenuLayoutControl.vue';
const position = inject('cf-menu-position');
const fields = [
  {
    key: 'x',
    label: 'menuPositionX',
    control: 'menuPositionXInput',
    min: 0,
    max: 100,
    step: 0.1,
    unit: '%',
  },
  {
    key: 'y',
    label: 'menuPositionY',
    control: 'menuPositionYInput',
    min: 0,
    max: 100,
    step: 0.1,
    unit: '%',
  },
];
</script>
<template>
  <MenuLayoutControl
    :controller="position"
    :fields="fields"
    :apply="position.setPosition"
    control="cbCustomMenuPosition"
    title-key="menuPositionCustom"
    hint-key="menuPositionHint"
  />
</template>
