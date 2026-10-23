<script setup lang="ts">
const { status, locked } = useServerStatus();
</script>

<template>
  <UContainer class="flex flex-col gap-6 py-5">
    <ActiveWorldCard />

    <!-- Die Steuerung ist gesperrt, solange der Server nicht läuft oder eine Welt gewechselt wird. -->
    <fieldset :disabled="locked" class="flex min-w-0 flex-col gap-6" data-testid="controls">
      <PlayerPanel :players="status?.players ?? []" />
      <GameModePanel />
      <DifficultyPanel />
      <TimeWeather />
    </fieldset>
  </UContainer>
</template>
