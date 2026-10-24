<script setup lang="ts">
useSeoMeta({ title: "Spieler · Deep Mine Control" });

const feedback = useFeedback();
const { data, refresh } = useFetch<PlayersInfo>("/api/players", { key: "players" });
useWhileVisible(refresh, 5000, { immediate: false });

/** Ab so vielen Spielern gibt es ein Suchfeld. */
const SEARCH_FROM = 11;
const query = ref("");
const players = computed(() => {
  const all = data.value?.players ?? [];
  const needle = query.value.trim().toLowerCase();
  return needle ? all.filter((p) => p.name.toLowerCase().includes(needle)) : all;
});
const online = computed(() => players.value.filter((p) => p.online));
const whitelisted = computed(() => players.value.filter((p) => !p.online && p.whitelisted));
const seen = computed(() => players.value.filter((p) => !p.online && !p.whitelisted));

const GAMERTAG = /^[A-Za-z0-9 ]{1,16}(#\d{1,4})?$/;
const newName = ref("");
const busy = ref<string | null>(null);

async function setWhitelisted(name: string, on: boolean) {
  busy.value = name;
  try {
    await $fetch("/api/players/whitelist", { method: on ? "POST" : "DELETE", body: { name } });
    feedback.done(
      on ? `${name} steht jetzt auf der Whitelist.` : `${name} steht nicht mehr auf der Whitelist.`
    );
    await refresh();
    return true;
  } catch {
    feedback.failed();
    return false;
  } finally {
    busy.value = null;
  }
}

async function add() {
  if (await setWhitelisted(newName.value.trim(), true)) newName.value = "";
}
</script>

<template>
  <UContainer class="flex flex-col gap-5 py-5 lg:max-w-3xl">
    <h1 class="font-pixel text-3xl font-bold text-highlighted">Spieler</h1>

    <SystemCard title="Zur Whitelist hinzufügen" icon="i-lucide-user-plus" data-testid="whitelist-add">
      <p class="text-sm text-muted">Geht auch für Freunde, die noch nie da waren.</p>
      <form class="flex gap-2" @submit.prevent="add">
        <UInput
          v-model="newName"
          placeholder="Gamertag"
          aria-label="Gamertag"
          size="lg"
          class="min-w-0 flex-1"
          autocomplete="off"
          data-testid="whitelist-input"
        />
        <UButton
          type="submit"
          icon="i-lucide-plus"
          size="lg"
          class="block-btn"
          :loading="busy === newName.trim()"
          :disabled="!GAMERTAG.test(newName.trim()) || busy !== null"
          data-testid="whitelist-submit"
        >
          Hinzufügen
        </UButton>
      </form>
    </SystemCard>

    <UInput
      v-if="(data?.players.length ?? 0) >= SEARCH_FROM"
      v-model="query"
      icon="i-lucide-search"
      placeholder="Spieler suchen"
      aria-label="Spieler suchen"
      size="lg"
      data-testid="players-search"
    />

    <section class="flex flex-col gap-2.5" data-testid="players-online">
      <h2 class="font-pixel text-xl font-semibold text-highlighted">Online</h2>
      <p v-if="online.length === 0" class="text-muted">Niemand ist gerade online.</p>
      <ul v-else class="flex flex-col gap-2">
        <PlayerRow v-for="player in online" :key="player.name" :player="player" />
      </ul>
    </section>

    <section class="flex flex-col gap-2.5" data-testid="players-whitelist">
      <h2 class="font-pixel text-xl font-semibold text-highlighted">Whitelist</h2>
      <p v-if="whitelisted.length === 0" class="text-muted">Sonst steht niemand auf der Whitelist.</p>
      <ul v-else class="flex flex-col gap-2">
        <PlayerRow v-for="player in whitelisted" :key="player.name" :player="player">
          <UButton
            icon="i-lucide-user-minus"
            color="neutral"
            variant="subtle"
            size="lg"
            class="block-btn"
            :aria-label="`${player.name} von der Whitelist nehmen`"
            :loading="busy === player.name"
            :disabled="busy !== null"
            data-testid="whitelist-remove"
            @click="setWhitelisted(player.name, false)"
          >
            Entfernen
          </UButton>
        </PlayerRow>
      </ul>
    </section>

    <!-- Beim Suchen offen, damit Treffer nicht versteckt sind. -->
    <details v-if="seen.length > 0" class="group" :open="query.trim() !== ''" data-testid="players-seen">
      <summary
        class="flex cursor-pointer list-none items-center gap-2 font-pixel text-xl font-semibold text-highlighted"
      >
        <UIcon
          name="i-lucide-chevron-right"
          class="size-5 shrink-0 transition-transform group-open:rotate-90"
        />
        Schon mal da gewesen ({{ seen.length }})
      </summary>
      <ul class="mt-2.5 flex flex-col gap-2">
        <PlayerRow v-for="player in seen" :key="player.name" :player="player">
          <UButton
            icon="i-lucide-user-plus"
            color="neutral"
            variant="subtle"
            size="lg"
            class="block-btn"
            :aria-label="`${player.name} auf die Whitelist setzen`"
            :loading="busy === player.name"
            :disabled="busy !== null"
            data-testid="whitelist-add-known"
            @click="setWhitelisted(player.name, true)"
          >
            Whitelist
          </UButton>
        </PlayerRow>
      </ul>
    </details>
  </UContainer>
</template>
