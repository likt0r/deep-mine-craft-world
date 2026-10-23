<script setup lang="ts">
const { status, locked } = useServerStatus();
</script>

<template>
  <UContainer class="flex flex-col gap-6 py-5">
    <ActiveWorldCard />

    <!-- Die Steuerung ist gesperrt, solange der Server nicht läuft oder eine Welt gewechselt wird. -->
    <!-- Ab 1024 px zweispaltig: links die Steuerung, rechts Spieler und „Welt wechseln“. -->
    <fieldset
      :disabled="locked"
      class="flex min-w-0 flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start"
      data-testid="controls"
    >
      <aside class="flex flex-col gap-6 lg:col-start-2 lg:row-start-1" data-testid="play-aside">
        <PlayerPanel :players="status?.players ?? []" />
        <WorldSwitch class="hidden lg:flex" />
      </aside>
      <div class="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1" data-testid="play-main">
        <GameModePanel />
        <DifficultyPanel />
        <TimeWeather />
      </div>
    </fieldset>
  </UContainer>
</template>
