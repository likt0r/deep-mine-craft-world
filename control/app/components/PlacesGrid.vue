<script setup lang="ts">
const { places } = usePlaces();
</script>

<template>
  <section class="flex flex-col gap-3" data-testid="places">
    <h2 class="text-xl font-semibold">Welten</h2>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <div
        v-for="entry in places?.places"
        :key="entry.place"
        class="flex flex-col gap-2 rounded-xl border p-3"
        :class="entry.active ? 'border-primary bg-primary/10' : 'border-default bg-default/40'"
        :data-testid="`place-${entry.place}`"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs text-muted">Platz {{ entry.place }}</span>
          <UBadge v-if="entry.active" color="success" data-testid="place-active">Aktiv</UBadge>
        </div>
        <template v-if="entry.world">
          <p class="font-semibold break-words">{{ entry.world.name }}</p>
          <div class="flex flex-wrap gap-1">
            <UBadge color="neutral" variant="subtle">{{ worldTypeLabel(entry.world.type) }}</UBadge>
            <UBadge color="neutral" variant="subtle">{{ gameModeLabel(entry.world.mode) }}</UBadge>
          </div>
        </template>
        <p v-else class="text-muted">Frei</p>
      </div>
    </div>
  </section>
</template>
