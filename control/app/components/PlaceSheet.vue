<script setup lang="ts">
/** Aktionsmenü von unten für einen Platz: Laden, Umbenennen, Löschen oder eine neue Welt anlegen. */
const props = defineProps<{ place: Place | null }>();
const emit = defineEmits<{ close: [] }>();

const { status, locked, refresh: refreshStatus } = useServerStatus();
const { refresh: refreshPlaces } = usePlaces();
const feedback = useFeedback();

const players = computed(() => status.value?.players ?? []);
const world = computed(() => props.place?.world ?? null);

/** Was im Menü gerade zu sehen ist. */
const view = ref<"menu" | "confirm" | "rename">("menu");
const name = ref("");
const saving = ref(false);
const renameFailed = ref(false);

const open = computed({
  get: () => props.place !== null,
  set: (value: boolean) => {
    if (!value) emit("close");
  }
});

// Jeder Platz beginnt im Menü.
watch(
  () => props.place?.place,
  () => {
    view.value = "menu";
    renameFailed.value = false;
  }
);

// Startet ein Weltvorgang oder geht der Server aus, schließt das Menü.
watch(locked, (isLocked) => {
  if (isLocked) emit("close");
});

/** Spielt gerade jemand, kommt erst die Warnung, sonst wird sofort geladen. */
function requestLoad() {
  if (players.value.length) view.value = "confirm";
  else void load();
}

async function load() {
  if (!props.place || !world.value) return;
  const label = world.value.name;
  try {
    await $fetch(`/api/places/${props.place.place}/load`, { method: "POST" });
    emit("close");
    feedback.done(`${label} wird geladen …`);
    // Der Status zeigt sofort „Welt wird gewechselt …“ und sperrt die Knöpfe.
    await refreshStatus();
  } catch {
    feedback.failed();
  }
}

function startRename() {
  name.value = world.value?.name ?? "";
  renameFailed.value = false;
  view.value = "rename";
}

async function saveRename() {
  if (!props.place) return;
  saving.value = true;
  renameFailed.value = false;
  try {
    await $fetch(`/api/places/${props.place.place}`, { method: "PATCH", body: { name: name.value } });
    // Der neue Name steht sofort in der Liste.
    await refreshPlaces();
    view.value = "menu";
    feedback.done(`Umbenannt in ${name.value.trim()}.`);
  } catch {
    renameFailed.value = true;
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!props.place || !world.value) return;
  const label = world.value.name;
  try {
    await $fetch(`/api/places/${props.place.place}`, { method: "DELETE" });
    emit("close");
    // Der Platz ist wieder frei.
    await refreshPlaces();
    feedback.done(`${label} wurde gelöscht.`);
  } catch {
    feedback.failed();
  }
}

/** Die neue Welt wird gleich geladen: Status und Plätze sofort neu holen. */
async function onCreated(created: string) {
  emit("close");
  feedback.done(`${created} wird angelegt und geladen …`);
  await Promise.all([refreshPlaces(), refreshStatus()]);
}
</script>

<template>
  <UDrawer
    v-model:open="open"
    handleOnly
    :title="world ? world.name : `Neue Welt auf Platz ${place?.place}`"
    :description="world ? `Platz ${place?.place}` : 'Name, Welttyp und Startmodus'"
    :ui="{
      content: 'bg-muted',
      container: 'mx-auto w-full max-w-lg pb-[calc(1rem+env(safe-area-inset-bottom))]'
    }"
  >
    <template #header>
      <div v-if="world && place" class="flex items-center gap-3">
        <span
          aria-hidden="true"
          class="flex size-12 shrink-0 items-center justify-center rounded-lg font-pixel text-xl font-bold text-neutral-950 shadow-[inset_0_-5px_0_rgb(0_0_0/0.3)]"
          :class="world.type === 'flach' ? 'bg-amber-400' : 'bg-green-400'"
        >
          {{ place.place }}
        </span>
        <div class="flex min-w-0 flex-col">
          <h2 class="truncate font-pixel text-2xl font-bold text-highlighted">{{ world.name }}</h2>
          <span class="text-sm text-muted">
            {{ worldTypeLabel(world.type) }} · {{ gameModeLabel(world.mode) }} ·
            {{ difficultyLabel(world.difficulty) }}
          </span>
        </div>
      </div>
      <h2 v-else class="font-pixel text-2xl font-bold text-highlighted">
        Neue Welt auf Platz {{ place?.place }}
      </h2>
    </template>

    <template #body>
      <div class="flex flex-col gap-3" data-testid="place-sheet">
        <NewWorldForm
          v-if="place && !world"
          :key="place.place"
          :place="place.place"
          :players="players"
          @created="onCreated"
          @cancel="emit('close')"
        />

        <template v-else-if="view === 'menu' && place">
          <UButton
            v-if="!place.active"
            data-testid="place-load"
            icon="i-lucide-play"
            size="xl"
            block
            :disabled="locked"
            class="block-btn h-15 font-pixel text-lg"
            @click="requestLoad"
          >
            Diese Welt laden
          </UButton>
          <p v-else class="rounded-lg bg-primary/10 px-3.5 py-3 text-primary">
            Auf dieser Welt wird gerade gespielt.
          </p>

          <UButton
            data-testid="place-rename"
            icon="i-lucide-pencil"
            color="neutral"
            variant="subtle"
            size="xl"
            block
            class="block-btn"
            @click="startRename"
          >
            Umbenennen
          </UButton>

          <template v-if="!place.active">
            <HoldButton
              label="Welt löschen"
              icon="i-lucide-trash-2"
              data-testid="place-delete"
              :disabled="locked"
              @confirm="remove"
            />
            <p class="text-center text-sm text-muted">
              Zum Löschen 3 Sekunden gedrückt halten. Das kann man nicht rückgängig machen.
            </p>
          </template>
        </template>

        <div v-else-if="view === 'confirm'" class="flex flex-col gap-3" data-testid="switch-warning">
          <UAlert color="warning" variant="subtle" icon="i-lucide-users">
            <template #title>
              Gerade spielen: <strong data-testid="switch-warning-players">{{ players.join(", ") }}</strong>
            </template>
            <template #description>
              Der Server startet neu. Alle werden etwa eine halbe Minute getrennt und müssen danach wieder
              beitreten.
            </template>
          </UAlert>
          <UButton
            data-testid="switch-confirm"
            icon="i-lucide-refresh-cw"
            size="xl"
            block
            :disabled="locked"
            class="block-btn h-15 font-pixel text-lg"
            @click="load"
          >
            Trotzdem laden
          </UButton>
          <UButton color="neutral" variant="subtle" size="xl" block class="block-btn" @click="view = 'menu'">
            Abbrechen
          </UButton>
        </div>

        <form v-else-if="view === 'rename'" class="flex flex-col gap-3" @submit.prevent="saveRename">
          <UFormField label="Neuer Name" size="xl">
            <UInput
              v-model="name"
              data-testid="place-rename-input"
              :maxlength="WORLD_NAME_MAX"
              autofocus
              placeholder="Neuer Name"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UAlert
            v-if="renameFailed"
            color="error"
            variant="subtle"
            icon="i-lucide-x"
            description="Das hat nicht geklappt. Versuch es nochmal."
            data-testid="place-rename-error"
          />
          <div class="grid grid-cols-2 gap-2">
            <UButton
              data-testid="place-rename-cancel"
              color="neutral"
              variant="subtle"
              size="xl"
              block
              class="block-btn"
              :disabled="saving"
              @click="view = 'menu'"
            >
              Abbrechen
            </UButton>
            <UButton
              type="submit"
              data-testid="place-rename-save"
              size="xl"
              block
              class="block-btn font-pixel"
              :loading="saving"
              :disabled="saving"
            >
              Speichern
            </UButton>
          </div>
        </form>
      </div>
    </template>
  </UDrawer>
</template>
