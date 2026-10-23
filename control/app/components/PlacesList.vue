<script setup lang="ts">
const { places } = usePlaces();
const { status } = useServerStatus();

/** Platz, auf dem gerade eine Welt geladen wird, sonst null. */
const switching = computed(() => status.value?.switching ?? null);

/** Platz, dessen Aktionsmenü offen ist, sonst null. */
const selected = ref<number | null>(null);
const selectedPlace = computed(() => places.value?.places.find((p) => p.place === selected.value) ?? null);

/** Farbe des Nummernblocks: Gras für normale Welten, Sand für flache. */
function tileClass(entry: Place) {
  if (!entry.world) return "bg-elevated text-dimmed";
  return entry.world.type === "flach" ? "bg-amber-400 text-neutral-950" : "bg-green-400 text-neutral-950";
}
</script>

<template>
  <section data-testid="places" aria-label="Plätze">
    <ul class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      <li v-for="entry in places?.places" :key="entry.place" :data-testid="`place-${entry.place}`">
        <button
          type="button"
          data-testid="place-open"
          class="relative flex min-h-17 w-full items-center gap-3 overflow-hidden rounded-xl border-2 px-3 py-2.5 text-left transition-transform active:translate-y-px disabled:cursor-not-allowed"
          :class="
            switching?.place === entry.place
              ? 'border-warning bg-warning/10'
              : entry.world
                ? entry.active
                  ? 'border-primary bg-primary/10 disabled:opacity-50'
                  : 'border-default bg-muted disabled:opacity-50'
                : 'border-dashed border-accented bg-transparent text-muted disabled:opacity-50'
          "
          @click="selected = entry.place"
        >
          <span
            aria-hidden="true"
            class="flex size-10 shrink-0 items-center justify-center rounded-md font-pixel text-lg font-bold shadow-[inset_0_-4px_0_rgb(0_0_0/0.3)]"
            :class="tileClass(entry)"
          >
            {{ entry.place }}
          </span>
          <span class="sr-only">Platz {{ entry.place }}</span>

          <!-- Hier kommt gerade die Welt hin: Laden oder Anlegen läuft. -->
          <template v-if="switching?.place === entry.place">
            <span class="flex min-w-0 flex-1 flex-col" data-testid="place-switching">
              <span class="truncate text-lg font-bold text-highlighted">{{ switching.world }}</span>
              <!-- Die Phase steht in der Statusleiste; hier reicht eine Zeile. -->
              <span class="truncate text-sm font-semibold text-warning">Wird geladen …</span>
            </span>
            <UIcon name="i-lucide-loader-circle" class="size-6 shrink-0 animate-spin text-warning" />
            <span aria-hidden="true" class="switch-stripes absolute inset-x-0 bottom-0 h-1.5" />
          </template>
          <template v-else-if="entry.world">
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-lg font-bold text-highlighted">{{ entry.world.name }}</span>
              <span class="text-sm text-muted">
                {{ worldTypeLabel(entry.world.type) }} · {{ gameModeLabel(entry.world.mode) }}
              </span>
            </span>
            <UBadge v-if="entry.active" class="rounded-full font-bold" data-testid="place-active"
              >Aktiv</UBadge
            >
            <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-dimmed" />
          </template>
          <template v-else>
            <span class="flex-1">Frei</span>
            <span class="flex items-center gap-1.5 font-semibold text-primary">
              <UIcon name="i-lucide-plus" class="size-5" />
              Neue Welt
            </span>
          </template>
        </button>
      </li>
    </ul>

    <PlaceSheet :place="selectedPlace" @close="selected = null" />
  </section>
</template>
