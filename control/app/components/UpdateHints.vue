<script setup lang="ts">
/** Hinweise auf neue Versionen, oben auf Spielen und System → Übersicht. Während eines Updates keine. */
const { available, updating } = useUpdates();
</script>

<template>
  <template v-if="!updating">
    <UpdateHint v-for="update in available" :key="update.kind" :update="update" />
  </template>
</template>
