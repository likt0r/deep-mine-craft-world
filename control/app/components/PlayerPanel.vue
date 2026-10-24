<script setup lang="ts">
defineProps<{ players: string[] }>();

const feedback = useFeedback();
/** Spieler, zu dem gerade geholt wird. */
const sending = ref<string | null>(null);

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
        <!-- Führt zum Spieler-Sheet im Bereich Spieler. -->
        <NuxtLink
          :to="{ path: '/spieler', query: { spieler: player } }"
          class="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg"
          data-testid="player-open"
        >
          <PlayerAvatar :name="player" />
          <span class="min-w-0 truncate font-semibold">{{ player }}</span>
          <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-dimmed" />
        </NuxtLink>
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
