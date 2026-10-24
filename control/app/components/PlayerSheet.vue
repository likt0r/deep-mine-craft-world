<script setup lang="ts">
/**
 * Aktionsmenü von unten für einen Spieler: Whitelist, Kicken, Sperren und Entsperren. Weitere Aktionen (Recht, Sperren) kommen als
 * eigene Abschnitte im Menü und, wenn sie eine Eingabe brauchen, als eigene Ansicht dazu.
 */
const props = defineProps<{ player: PlayerInfo | null }>();
const emit = defineEmits<{ close: [] }>();

const feedback = useFeedback();
const setWhitelisted = useWhitelist();

/** Was im Sheet gerade zu sehen ist. */
const view = ref<"menu" | "kick" | "ban">("menu");
const busy = ref(false);
const reason = ref("");
const reasonValid = computed(() => isValidPlayerMessage(reason.value));

const open = computed({
  get: () => props.player !== null,
  set: (value: boolean) => {
    if (!value) emit("close");
  }
});

// Jeder Spieler beginnt im Menü.
watch(
  () => props.player?.name,
  () => {
    view.value = "menu";
    reason.value = "";
  }
);

// Geht der Spieler von selbst, gibt es nichts mehr zu kicken.
watch(
  () => props.player?.online,
  (online) => {
    if (!online && view.value === "kick") view.value = "menu";
  }
);

async function toggleWhitelist(on: boolean) {
  if (!props.player) return;
  busy.value = true;
  await setWhitelisted(props.player.name, on);
  busy.value = false;
}

function startKick() {
  reason.value = "";
  view.value = "kick";
}

async function kick() {
  if (!props.player || !reasonValid.value) return;
  const name = props.player.name;
  busy.value = true;
  try {
    await $fetch("/api/players/kick", { method: "POST", body: { name, reason: reason.value } });
    emit("close");
    feedback.done(`${name} wurde gekickt.`);
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 409) feedback.failed("Der Server läuft gerade nicht.");
    else if (status === 404) feedback.failed(`${name} ist nicht mehr online.`);
    else feedback.failed();
  } finally {
    busy.value = false;
  }
  await refreshNuxtData("players");
}

// --- Sperren und Entsperren ---

/** „Grund: Hat alles angezündet · seit 24.10.2026“ */
function banDescription(banned: NonNullable<PlayerInfo["banned"]>) {
  const reasonText = banned.reason ? `Grund: ${banned.reason}` : "Ohne Grund";
  return banned.since ? `${reasonText} · seit ${formatDate(banned.since)}` : reasonText;
}

function startBan() {
  reason.value = "";
  view.value = "ban";
}

async function ban() {
  if (!props.player?.xuid || !reasonValid.value) return;
  const { name, xuid } = props.player;
  busy.value = true;
  try {
    await $fetch("/api/players/ban", { method: "POST", body: { xuid, reason: reason.value } });
    emit("close");
    feedback.done(`${name} ist gesperrt.`);
  } catch {
    feedback.failed();
  } finally {
    busy.value = false;
  }
  await refreshNuxtData("players");
}

async function unban() {
  if (!props.player?.xuid) return;
  const { name, xuid } = props.player;
  busy.value = true;
  try {
    await $fetch("/api/players/ban", { method: "DELETE", body: { xuid } });
    feedback.done(`${name} ist entsperrt.`);
  } catch {
    feedback.failed();
  } finally {
    busy.value = false;
  }
  await refreshNuxtData("players");
}
</script>

<template>
  <UDrawer
    v-model:open="open"
    handleOnly
    :title="player?.name ?? 'Spieler'"
    :description="player?.online ? 'Online' : 'Nicht online'"
    :ui="{
      content: 'bg-muted',
      container: 'mx-auto w-full max-w-lg pb-[calc(1rem+env(safe-area-inset-bottom))]'
    }"
  >
    <template #header>
      <div v-if="player" class="flex items-center gap-3">
        <PlayerAvatar :name="player.name" large />
        <div class="flex min-w-0 flex-col">
          <h2 class="truncate font-pixel text-2xl font-bold text-highlighted">{{ player.name }}</h2>
          <span
            class="flex items-center gap-1.5 text-sm"
            :class="player.online ? 'font-semibold text-primary' : 'text-muted'"
            data-testid="player-sheet-online"
          >
            <span
              aria-hidden="true"
              class="size-2 rounded-full"
              :class="player.online ? 'bg-primary' : 'bg-(--ui-text-dimmed)'"
            />
            {{ player.online ? "Online" : "Nicht online" }}
          </span>
        </div>
      </div>
    </template>

    <template #body>
      <div v-if="player" class="flex flex-col gap-3" data-testid="player-sheet" :data-player="player.name">
        <template v-if="view === 'menu'">
          <div
            v-if="!player.banned"
            class="flex min-h-16 items-center gap-3 rounded-xl border border-default bg-default px-3.5 py-2"
          >
            <span
              aria-hidden="true"
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
            >
              <UIcon name="i-lucide-list-checks" class="size-5" />
            </span>
            <span id="player-whitelist-label" class="flex min-w-0 flex-1 flex-col">
              <span class="font-semibold">Auf der Whitelist</span>
              <span class="text-sm text-muted">Darf beitreten, wenn der Zugang geschlossen ist.</span>
            </span>
            <USwitch
              size="xl"
              aria-labelledby="player-whitelist-label"
              :modelValue="player.whitelisted"
              :loading="busy"
              :disabled="busy"
              data-testid="player-whitelist"
              @update:modelValue="toggleWhitelist"
            />
          </div>

          <UButton
            v-if="player.online && !player.banned"
            data-testid="player-kick"
            icon="i-lucide-log-out"
            color="warning"
            variant="subtle"
            size="xl"
            block
            class="block-btn"
            @click="startKick"
          >
            Kicken
          </UButton>

          <template v-if="player.banned">
            <UAlert
              color="error"
              variant="subtle"
              icon="i-lucide-ban"
              title="Gesperrt"
              :description="banDescription(player.banned)"
              data-testid="player-banned"
            />
            <UButton
              data-testid="player-unban"
              icon="i-lucide-undo-2"
              color="neutral"
              variant="subtle"
              size="xl"
              block
              class="block-btn"
              :loading="busy"
              :disabled="busy"
              @click="unban"
            >
              Entsperren
            </UButton>
            <p class="text-center text-sm text-muted">
              Danach steht {{ player.name }} nicht auf der Whitelist.
            </p>
          </template>
          <template v-else>
            <UButton
              data-testid="player-ban"
              icon="i-lucide-ban"
              color="error"
              variant="subtle"
              size="xl"
              block
              class="block-btn"
              :disabled="!player.xuid"
              @click="startBan"
            >
              Sperren
            </UButton>
            <p v-if="!player.xuid" class="text-center text-sm text-muted" data-testid="player-ban-hint">
              Erst möglich, wenn der Spieler einmal da war.
            </p>
          </template>
        </template>

        <form v-else-if="view === 'kick'" class="flex flex-col gap-3" @submit.prevent="kick">
          <p class="text-muted">{{ player.name }} fliegt aus dem Spiel und kann gleich wieder beitreten.</p>
          <UFormField
            label="Nachricht"
            hint="freiwillig"
            size="xl"
            :error="reasonValid ? false : `Höchstens ${PLAYER_MESSAGE_MAX} Zeichen, ohne Anführungszeichen.`"
          >
            <UInput
              v-model="reason"
              data-testid="player-kick-reason"
              :maxlength="PLAYER_MESSAGE_MAX"
              placeholder="z. B. Zeit fürs Abendessen!"
              size="xl"
              class="w-full"
              autocomplete="off"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-2">
            <UButton
              color="neutral"
              variant="subtle"
              size="xl"
              block
              class="block-btn"
              :disabled="busy"
              @click="view = 'menu'"
            >
              Abbrechen
            </UButton>
            <UButton
              type="submit"
              data-testid="player-kick-confirm"
              icon="i-lucide-log-out"
              color="warning"
              size="xl"
              block
              class="block-btn font-pixel"
              :loading="busy"
              :disabled="busy || !reasonValid"
            >
              Kicken
            </UButton>
          </div>
        </form>

        <div v-else-if="view === 'ban'" class="flex flex-col gap-3">
          <p class="text-muted">
            {{ player.name }} fliegt sofort raus und kann nicht mehr beitreten, auch nicht über die Whitelist.
          </p>
          <UFormField
            label="Grund"
            hint="freiwillig"
            size="xl"
            :error="reasonValid ? false : `Höchstens ${PLAYER_MESSAGE_MAX} Zeichen, ohne Anführungszeichen.`"
          >
            <UInput
              v-model="reason"
              data-testid="player-ban-reason"
              :maxlength="PLAYER_MESSAGE_MAX"
              placeholder="z. B. Hat alles angezündet"
              size="xl"
              class="w-full"
              autocomplete="off"
            />
          </UFormField>
          <HoldButton
            label="Halten: Sperren"
            icon="i-lucide-ban"
            data-testid="player-ban-confirm"
            :disabled="busy || !reasonValid"
            @confirm="ban"
          />
          <UButton
            color="neutral"
            variant="subtle"
            size="xl"
            block
            class="block-btn"
            :disabled="busy"
            @click="view = 'menu'"
          >
            Abbrechen
          </UButton>
        </div>
      </div>
    </template>
  </UDrawer>
</template>
