<script setup lang="ts">
/** „Welt wechseln“ neben Spielen auf breiten Bildschirmen: die belegten, nicht aktiven Plätze mit „Laden“. */
const { places } = usePlaces();
const { status } = useServerStatus();
const loadWorld = useWorldLoad();

const others = computed(() => places.value?.places.filter((p) => p.world && !p.active) ?? []);

/** Platz, für den die Warnung offen ist, sonst null. */
const confirming = ref<number | null>(null);
const confirmingPlace = computed(() => others.value.find((p) => p.place === confirming.value) ?? null);

/** Spielt gerade jemand, kommt erst die Warnung (im Menü wie bei Welten), sonst wird sofort geladen. */
function requestLoad(entry: Place) {
  if (status.value?.players.length) confirming.value = entry.place;
  else void loadWorld(entry.place, entry.world!.name);
}
</script>

<template>
  <section class="flex flex-col gap-2.5" data-testid="world-switch" aria-labelledby="world-switch-heading">
    <div class="flex items-baseline justify-between gap-2">
      <h2 id="world-switch-heading" class="font-pixel text-xl font-semibold text-highlighted">
        Welt wechseln
      </h2>
      <ULink to="/welten" class="text-sm font-semibold text-primary">Alle Welten</ULink>
    </div>

    <p v-if="others.length === 0" class="text-muted">Es gibt noch keine andere Welt.</p>

    <ul v-else class="divide-y divide-default overflow-hidden rounded-xl border border-default bg-muted">
      <li
        v-for="entry in others"
        :key="entry.place"
        class="flex min-h-15 items-center gap-3 px-3 py-2"
        :data-testid="`world-switch-${entry.place}`"
      >
        <span
          aria-hidden="true"
          class="flex size-9 shrink-0 items-center justify-center rounded-md font-pixel font-bold text-neutral-950 shadow-[inset_0_-3px_0_rgb(0_0_0/0.3)]"
          :class="entry.world!.type === 'flach' ? 'bg-amber-400' : 'bg-grass-400'"
        >
          {{ entry.place }}
        </span>
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate font-semibold">{{ entry.world!.name }}</span>
          <span class="text-sm text-muted">
            {{ worldTypeLabel(entry.world!.type) }} · {{ gameModeLabel(entry.world!.mode) }}
          </span>
        </span>
        <UButton
          icon="i-lucide-play"
          color="neutral"
          variant="subtle"
          size="lg"
          class="block-btn"
          :aria-label="`${entry.world!.name} laden`"
          data-testid="world-switch-load"
          @click="requestLoad(entry)"
        >
          Laden
        </UButton>
      </li>
    </ul>

    <PlaceSheet :place="confirmingPlace" confirmLoad @close="confirming = null" />
  </section>
</template>
