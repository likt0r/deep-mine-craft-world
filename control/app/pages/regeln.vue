<script setup lang="ts">
useSeoMeta({ title: "Regeln · Deep Mine Control" });
const { status, locked } = useServerStatus();
</script>

<template>
  <UContainer class="flex flex-col gap-4 py-5">
    <h1 class="font-pixel text-3xl font-bold text-highlighted">Spielregeln</h1>
    <fieldset :disabled="locked" class="min-w-0" data-testid="controls">
      <!-- Neu laden, wenn eine andere Welt aktiv wird oder der Server wieder läuft. -->
      <GameRules :key="`${status?.world}:${status?.state}`" />
    </fieldset>
  </UContainer>
</template>
