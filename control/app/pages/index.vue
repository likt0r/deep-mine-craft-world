<script setup lang="ts">
const { status, refresh, locked } = useServerStatus();
</script>

<template>
  <UContainer class="flex flex-col gap-6 py-6">
    <StatusHeader :status="status" />
    <ServerOffBanner v-if="status?.state === 'stopped'" @started="refresh()" />

    <!-- Die Bereiche der Steuerung sind gesperrt, solange der Server nicht läuft. -->
    <fieldset :disabled="locked" class="flex flex-col gap-6" data-testid="controls">
      <PlacesGrid />
      <TimeWeather />
      <!-- Neu laden, wenn eine andere Welt aktiv wird oder der Server wieder läuft. -->
      <GameRules :key="`${status?.world}:${status?.state}`" />
      <PlayerPanel :players="status?.players ?? []" />
    </fieldset>
  </UContainer>
</template>
