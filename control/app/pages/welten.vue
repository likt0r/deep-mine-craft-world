<script setup lang="ts">
useSeoMeta({ title: "Welten · Deep Mine Control" });
const { locked } = useServerStatus();
const { places } = usePlaces();

const used = computed(() => places.value?.places.filter((p) => p.world).length ?? 0);
</script>

<template>
  <UContainer class="flex flex-col gap-3 py-5">
    <div class="flex items-baseline justify-between gap-2">
      <h1 class="font-pixel text-3xl font-bold text-highlighted">Welten</h1>
      <span class="text-sm text-muted">{{ used }} von 10 Plätzen belegt</span>
    </div>
    <p class="text-muted">Tippe eine Welt an, um sie zu laden oder zu ändern.</p>
    <fieldset :disabled="locked" class="min-w-0" data-testid="controls">
      <PlacesList />
    </fieldset>
  </UContainer>
</template>
