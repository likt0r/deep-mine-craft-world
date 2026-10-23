<script setup lang="ts">
useSeoMeta({ title: "Regeln · Deep Mine Control" });
const { status, locked } = useServerStatus();
</script>

<template>
  <UContainer class="flex flex-col gap-4 py-5">
    <div class="flex flex-col gap-1">
      <h1 class="font-pixel text-3xl font-bold text-highlighted">Spielregeln</h1>
      <p v-if="status?.world" class="text-muted" data-testid="rules-world">
        Gelten für die aktive Welt {{ status.world }}.
      </p>
    </div>
    <fieldset :disabled="locked" class="min-w-0 lg:max-w-3xl" data-testid="controls">
      <!-- Neu laden, wenn eine andere Welt aktiv wird oder der Server wieder läuft. -->
      <GameRules :key="`${status?.world}:${status?.state}`" />
    </fieldset>
  </UContainer>
</template>
