<script setup lang="ts">
useSeoMeta({ title: "Welten · Deep Mine Control" });
const { locked } = useServerStatus();
</script>

<template>
  <UContainer class="flex flex-col gap-4 py-5">
    <h1 class="font-pixel text-3xl font-bold text-highlighted">Welten</h1>
    <fieldset :disabled="locked" class="min-w-0" data-testid="controls">
      <PlacesGrid />
    </fieldset>
  </UContainer>
</template>
