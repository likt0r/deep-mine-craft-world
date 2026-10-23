<script setup lang="ts">
const { status, refresh } = useServerStatus();
const { places } = usePlaces();

/** Dieselben Symbole wie bei den Spielmodus-Knöpfen */
const MODE_ICONS: Record<string, string> = {
  creative: "i-lucide-box",
  survival: "i-lucide-heart",
  adventure: "i-lucide-compass"
};

const active = computed(() => places.value?.places.find((p) => p.active));

const badge = computed(() => {
  // Was gerade passiert, steht ausführlich darunter und in der Statusleiste.
  if (status.value?.busy) return { label: "Wechselt …", color: "warning" as const };
  switch (status.value?.state) {
    case "running":
      return { label: "Läuft", color: "success" as const };
    case "starting":
      return { label: "Startet …", color: "warning" as const };
    case "stopped":
      return { label: "Aus", color: "error" as const };
    default:
      return { label: "Unbekannt", color: "neutral" as const };
  }
});

const starting = ref(false);

async function start() {
  starting.value = true;
  try {
    await $fetch("/api/start", { method: "POST" });
    await refresh();
  } finally {
    starting.value = false;
  }
}
</script>

<template>
  <section
    aria-label="Aktive Welt"
    class="overflow-hidden rounded-xl border border-default bg-muted"
    data-testid="status-header"
  >
    <div aria-hidden="true" class="grass-edge" />
    <div aria-hidden="true" class="dirt-edge" />
    <div class="flex flex-col gap-3.5 p-4 sm:p-5">
      <div class="flex items-center gap-3.5">
        <div aria-hidden="true" class="grass-block size-13 shrink-0" />
        <div class="flex min-w-0 flex-col gap-1">
          <span class="text-sm text-muted">
            Aktive Welt<template v-if="active"> · Platz {{ active.place }}</template>
          </span>
          <h1
            class="font-pixel text-3xl leading-tight font-bold break-words text-highlighted sm:text-4xl"
            data-testid="active-world"
          >
            {{ status?.world || "…" }}
          </h1>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-1.5">
        <UBadge
          :color="badge.color"
          variant="subtle"
          size="lg"
          class="rounded-full font-bold"
          data-testid="server-state"
        >
          {{ badge.label }}
        </UBadge>
        <template v-if="active?.world">
          <!-- Symbole, weil Welttyp und Schwierigkeit beide „Normal“ heißen können. -->
          <UBadge
            color="neutral"
            variant="soft"
            size="lg"
            :icon="active.world.type === 'flach' ? 'i-lucide-grid-2x2' : 'i-lucide-mountain'"
            :title="`Welttyp ${worldTypeLabel(active.world.type)}`"
          >
            {{ worldTypeLabel(active.world.type) }}
          </UBadge>
          <UBadge
            color="neutral"
            variant="soft"
            size="lg"
            :icon="MODE_ICONS[active.world.mode] ?? 'i-lucide-gamepad-2'"
            :title="`Spielmodus ${gameModeLabel(active.world.mode)}`"
          >
            {{ gameModeLabel(active.world.mode) }}
          </UBadge>
          <UBadge
            color="neutral"
            variant="soft"
            size="lg"
            icon="i-lucide-swords"
            :title="`Schwierigkeit ${difficultyLabel(active.world.difficulty)}`"
          >
            {{ difficultyLabel(active.world.difficulty) }}
          </UBadge>
        </template>
        <UBadge
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-lucide-users"
          class="ms-auto"
          data-testid="player-count"
        >
          {{ status?.players.length ?? 0 }} online
        </UBadge>
      </div>

      <div
        v-if="status?.switching"
        class="relative flex items-center gap-3 overflow-hidden rounded-lg border border-warning/40 bg-warning/10 px-3.5 pt-3 pb-4"
        data-testid="card-switching"
      >
        <UIcon name="i-lucide-loader-circle" class="size-6 shrink-0 animate-spin text-warning" />
        <div class="flex min-w-0 flex-col">
          <p class="truncate font-semibold text-warning">Wechsel zu {{ status.switching.world }} …</p>
          <p class="text-sm text-toned">{{ switchPhaseLabel(status.switching.phase) }}</p>
        </div>
        <span aria-hidden="true" class="switch-stripes absolute inset-x-0 bottom-0 h-1.5" />
      </div>

      <div
        v-if="status?.state === 'stopped'"
        class="flex flex-col gap-2.5 rounded-lg border border-error/40 bg-error/10 p-3.5"
        data-testid="server-off"
      >
        <p class="font-semibold text-error">Der Server ist aus</p>
        <p class="text-sm text-toned">Niemand kann gerade spielen. Starte ihn hier wieder.</p>
        <UButton
          size="xl"
          icon="i-lucide-power"
          block
          :loading="starting"
          class="block-btn font-pixel text-lg"
          @click="start"
        >
          Server starten
        </UButton>
      </div>
    </div>
  </section>
</template>
