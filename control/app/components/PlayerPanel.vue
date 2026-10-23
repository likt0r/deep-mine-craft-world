<script setup lang="ts">
defineProps<{ players: string[] }>();

const feedback = useFeedback();
/** Spieler, zu dem gerade geholt wird. */
const sending = ref<string | null>(null);

/** Farbe des Avatar-Blocks, fest pro Name. */
const COLORS = ["bg-sky-400", "bg-orange-400", "bg-lime-400", "bg-violet-300", "bg-amber-400", "bg-pink-300"];
function color(player: string) {
  let sum = 0;
  for (const char of player) sum += char.codePointAt(0) ?? 0;
  return COLORS[sum % COLORS.length];
}

async function teleport(player: string) {
  sending.value = player;
  try {
    await $fetch("/api/teleport", { method: "POST", body: { player } });
    feedback.done(`Alle sind jetzt bei ${player}.`);
  } catch {
    feedback.failed();
  } finally {
    sending.value = null;
  }
}
</script>

<template>
  <section class="flex flex-col gap-2.5" data-testid="players" aria-labelledby="players-heading">
    <!-- Wie viele online sind, zeigt schon die Karte der aktiven Welt. -->
    <h2 id="players-heading" class="font-pixel text-xl font-semibold text-highlighted">Spieler</h2>

    <p v-if="players.length === 0" class="text-muted" data-testid="players-empty">
      Niemand ist gerade online.
    </p>

    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="player in players"
        :key="player"
        class="flex items-center gap-3 rounded-xl border border-default bg-muted py-2 ps-2 pe-2"
        data-testid="player-option"
        :data-player="player"
      >
        <span
          aria-hidden="true"
          class="flex size-10 shrink-0 items-center justify-center rounded-lg font-pixel text-lg font-bold text-neutral-950 shadow-[inset_0_-4px_0_rgb(0_0_0/0.25)]"
          :class="color(player)"
        >
          {{ player.charAt(0).toUpperCase() }}
        </span>
        <span class="min-w-0 flex-1 truncate font-semibold">{{ player }}</span>
        <UButton
          data-testid="teleport-to"
          icon="i-lucide-users-round"
          color="neutral"
          variant="subtle"
          size="lg"
          class="block-btn"
          :aria-label="`Alle zu ${player} holen`"
          :loading="sending === player"
          :disabled="sending !== null"
          @click="teleport(player)"
        >
          Alle hierher
        </UButton>
      </li>
    </ul>
  </section>
</template>
