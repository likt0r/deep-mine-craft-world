<script setup lang="ts">
useSeoMeta({ title: "Spieler · Deep Mine Control" });

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
// Gesperrte stehen nur unter Gesperrt, außer sie sind noch online, bis der Kick greift.
const whitelisted = computed(() => players.value.filter((p) => !p.online && !p.banned && p.whitelisted));
const banned = computed(() => players.value.filter((p) => !p.online && p.banned));
const seen = computed(() => players.value.filter((p) => !p.online && !p.banned && !p.whitelisted));

const feedback = useFeedback();
const closed = computed(() => data.value?.closed ?? false);
const newPlayers = computed(() => data.value?.newPlayers ?? "member");
const unlistedOnline = computed(() =>
  (data.value?.players ?? []).filter((p) => p.online && !p.whitelisted && !p.banned)
);
const accessBusy = ref(false);
const askClose = ref(false);

type AccessBody = {
  closed?: boolean;
  newPlayers?: "visitor" | "member";
  onlineNotListed?: "whitelist" | "kick";
};

async function setAccess(body: AccessBody) {
  accessBusy.value = true;
  try {
    await $fetch("/api/players/access", { method: "PUT", body });
    askClose.value = false;
    await refresh();
    if (body.closed !== undefined)
      feedback.done(body.closed ? "Zugang ist geschlossen." : "Zugang ist offen.");
    else if (body.newPlayers) {
      feedback.done(
        body.newPlayers === "visitor" ? "Neue Spieler sind Besucher." : "Neue Spieler sind Mitglieder."
      );
    }
  } catch (error) {
    // Der Server hat inzwischen einen Spieler ohne Eintrag gesehen: dann erst nachfragen.
    if (
      !body.onlineNotListed &&
      body.closed === true &&
      (error as { statusCode?: number }).statusCode === 409
    ) {
      await refresh();
      askClose.value = true;
    } else {
      feedback.failed();
    }
  } finally {
    accessBusy.value = false;
  }
}

function chooseClosed(value: boolean) {
  // Beim Schließen erst fragen, wenn jemand online ist, der nicht auf der Whitelist steht.
  if (value && unlistedOnline.value.length > 0) {
    askClose.value = true;
    return;
  }
  void setAccess({ closed: value });
}

function chooseNewPlayers(value: "visitor" | "member") {
  if (value === newPlayers.value) return;
  void setAccess({ newPlayers: value });
}

const newName = ref("");
const adding = ref(false);
const setWhitelisted = useWhitelist();

async function add() {
  adding.value = true;
  if (await setWhitelisted(newName.value.trim(), true)) newName.value = "";
  adding.value = false;
}

/** Spieler, dessen Sheet offen ist, steht in der Adresse (`?spieler=<Name>`). So öffnet die Online-Liste auf Spielen es direkt. */
const route = useRoute();
const router = useRouter();
// Erst im Browser öffnen: Das Sheet braucht das Fenster.
const mounted = ref(false);
onMounted(() => (mounted.value = true));
const selected = computed(() =>
  mounted.value && typeof route.query.spieler === "string" ? route.query.spieler : null
);
const selectedPlayer = computed(() => {
  const key = selected.value?.toLowerCase();
  return data.value?.players.find((p) => p.name.toLowerCase() === key) ?? null;
});

function openSheet(name: string) {
  void router.replace({ query: { spieler: name } });
}

function closeSheet() {
  if (route.query.spieler !== undefined) void router.replace({ query: {} });
}

// Steht der Spieler nicht (mehr) in der Liste, z. B. nach dem Entfernen von der Whitelist, geht das Sheet zu.
watch([data, selected], () => {
  if (data.value && selected.value && !selectedPlayer.value) closeSheet();
});
</script>

<template>
  <UContainer class="flex flex-col gap-5 py-5 lg:max-w-3xl">
    <h1 class="font-pixel text-3xl font-bold text-highlighted">Spieler</h1>

    <UAlert
      v-if="data?.offlineMode"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Offline-Modus ist an"
      description="Whitelist und Sperren lassen sich umgehen."
      data-testid="players-offline"
    />

    <SystemCard title="Zugang" icon="i-lucide-door-closed" data-testid="players-access">
      <div class="grid grid-cols-2 gap-2">
        <UButton
          :color="!closed ? 'primary' : 'neutral'"
          :variant="!closed ? 'solid' : 'subtle'"
          :aria-pressed="!closed"
          :disabled="accessBusy"
          class="block-btn h-12 font-semibold"
          data-testid="access-open"
          @click="chooseClosed(false)"
        >
          Offen
        </UButton>
        <UButton
          :color="closed ? 'primary' : 'neutral'"
          :variant="closed ? 'solid' : 'subtle'"
          :aria-pressed="closed"
          :disabled="accessBusy"
          class="block-btn h-12 font-semibold"
          data-testid="access-closed"
          @click="chooseClosed(true)"
        >
          Geschlossen
        </UButton>
      </div>
      <p class="text-sm text-muted" data-testid="access-explanation">
        {{
          closed
            ? "Nur Spieler auf der Whitelist können beitreten."
            : "Jeder kann beitreten, außer gesperrten Spielern."
        }}
      </p>

      <p id="new-players-label" class="mt-1 font-semibold">Neue Spieler sind:</p>
      <div class="grid grid-cols-2 gap-2" aria-labelledby="new-players-label">
        <UButton
          :color="newPlayers === 'visitor' ? 'primary' : 'neutral'"
          :variant="newPlayers === 'visitor' ? 'solid' : 'subtle'"
          :aria-pressed="newPlayers === 'visitor'"
          :disabled="accessBusy"
          class="block-btn h-12 font-semibold"
          data-testid="access-new-visitor"
          @click="chooseNewPlayers('visitor')"
        >
          Besucher
        </UButton>
        <UButton
          :color="newPlayers === 'member' ? 'primary' : 'neutral'"
          :variant="newPlayers === 'member' ? 'solid' : 'subtle'"
          :aria-pressed="newPlayers === 'member'"
          :disabled="accessBusy"
          class="block-btn h-12 font-semibold"
          data-testid="access-new-member"
          @click="chooseNewPlayers('member')"
        >
          Mitglied
        </UButton>
      </div>
    </SystemCard>

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
          :loading="adding"
          :disabled="!GAMERTAG.test(newName.trim()) || adding"
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
        <PlayerRow
          v-for="player in online"
          :key="player.name"
          :player="player"
          @open="openSheet(player.name)"
        />
      </ul>
    </section>

    <section class="flex flex-col gap-2.5" data-testid="players-whitelist">
      <h2 class="font-pixel text-xl font-semibold text-highlighted">Whitelist</h2>
      <p v-if="whitelisted.length === 0" class="text-muted">Sonst steht niemand auf der Whitelist.</p>
      <ul v-else class="flex flex-col gap-2">
        <PlayerRow
          v-for="player in whitelisted"
          :key="player.name"
          :player="player"
          @open="openSheet(player.name)"
        />
      </ul>
    </section>

    <section v-if="banned.length > 0" class="flex flex-col gap-2.5" data-testid="players-banned">
      <h2 class="font-pixel text-xl font-semibold text-highlighted">Gesperrt</h2>
      <ul class="flex flex-col gap-2">
        <PlayerRow
          v-for="player in banned"
          :key="player.name"
          :player="player"
          @open="openSheet(player.name)"
        />
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
        <PlayerRow
          v-for="player in seen"
          :key="player.name"
          :player="player"
          @open="openSheet(player.name)"
        />
      </ul>
    </details>

    <PlayerSheet :player="selectedPlayer" @close="closeSheet" />

    <UDrawer
      v-model:open="askClose"
      handleOnly
      title="Zugang schließen"
      :ui="{
        content: 'bg-muted',
        container: 'mx-auto w-full max-w-lg pb-[calc(1rem+env(safe-area-inset-bottom))]'
      }"
    >
      <template #body>
        <div class="flex flex-col gap-3" data-testid="access-close-dialog">
          <p>
            Diese Spieler sind online und stehen nicht auf der Whitelist:
            <strong>{{ unlistedOnline.map((p) => p.name).join(", ") }}</strong>
          </p>
          <UButton
            icon="i-lucide-user-plus"
            size="lg"
            class="block-btn font-semibold"
            :loading="accessBusy"
            data-testid="access-close-whitelist"
            @click="setAccess({ closed: true, onlineNotListed: 'whitelist' })"
          >
            Mit auf die Whitelist
          </UButton>
          <UButton
            icon="i-lucide-log-out"
            color="error"
            size="lg"
            class="block-btn font-semibold"
            :loading="accessBusy"
            data-testid="access-close-kick"
            @click="setAccess({ closed: true, onlineNotListed: 'kick' })"
          >
            Kicken
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            size="lg"
            class="block-btn"
            data-testid="access-close-cancel"
            @click="askClose = false"
          >
            Abbrechen
          </UButton>
        </div>
      </template>
    </UDrawer>
  </UContainer>
</template>
