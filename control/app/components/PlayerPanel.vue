<script setup lang="ts">
const props = defineProps<{ players: string[] }>();

const selected = ref<string | null>(null);
const sending = ref(false);
const result = ref("");
const failed = ref(false);

// Die Auswahl gilt nur, solange der Spieler auch wirklich online ist.
watch(
  () => props.players,
  (players) => {
    if (selected.value && !players.includes(selected.value)) selected.value = null;
  }
);

function select(player: string) {
  selected.value = selected.value === player ? null : player;
  result.value = "";
  failed.value = false;
}

async function teleport() {
  if (!selected.value) return;
  sending.value = true;
  result.value = "";
  failed.value = false;
  try {
    await $fetch("/api/teleport", { method: "POST", body: { player: selected.value } });
    result.value = `Alle sind jetzt bei ${selected.value}.`;
  } catch {
    failed.value = true;
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <section class="flex flex-col gap-3" data-testid="players">
    <h2 class="text-xl font-semibold">Spieler</h2>

    <p v-if="players.length === 0" class="text-muted" data-testid="players-empty">
      Niemand ist gerade online.
    </p>

    <div v-else class="flex flex-wrap gap-2">
      <UButton
        v-for="player in players"
        :key="player"
        data-testid="player-option"
        :data-player="player"
        :variant="selected === player ? 'solid' : 'outline'"
        :aria-pressed="selected === player"
        size="xl"
        @click="select(player)"
      >
        {{ player }}
      </UButton>
    </div>

    <UButton
      data-testid="teleport-all"
      icon="i-lucide-users-round"
      size="xl"
      :disabled="!selected || sending"
      :loading="sending"
      @click="teleport"
    >
      Alle hierher holen
    </UButton>

    <UAlert
      v-if="result"
      color="success"
      variant="subtle"
      icon="i-lucide-check"
      :description="result"
      data-testid="teleport-sent"
    />
    <UAlert
      v-else-if="failed"
      color="error"
      variant="subtle"
      icon="i-lucide-x"
      description="Das hat nicht geklappt. Versuch es nochmal."
      data-testid="teleport-error"
    />
  </section>
</template>
