<script setup lang="ts">
const { places, refresh } = usePlaces();

/** Platz, der gerade umbenannt wird, sonst null. */
const renaming = ref<number | null>(null);
const name = ref("");
const saving = ref(false);
const failed = ref(false);

/** So lange muss der Löschknopf gehalten werden, damit die Welt wirklich gelöscht wird. */
const HOLD_MS = 3000;
/** Platz, auf dem gerade der Löschknopf gehalten wird. */
const holding = ref<number | null>(null);
/** Platz, dessen Löschen gerade läuft. */
const deleting = ref<number | null>(null);
/** Platz, bei dem das Löschen fehlgeschlagen ist. */
const deleteFailed = ref<number | null>(null);
let holdTimer: ReturnType<typeof setTimeout> | undefined;

function startRename(entry: Place) {
  renaming.value = entry.place;
  name.value = entry.world?.name ?? "";
  failed.value = false;
}

function cancel() {
  renaming.value = null;
  failed.value = false;
}

async function save() {
  if (renaming.value === null) return;
  saving.value = true;
  failed.value = false;
  try {
    await $fetch(`/api/places/${renaming.value}`, { method: "PATCH", body: { name: name.value } });
    renaming.value = null;
    // Der neue Name steht sofort auf der Kachel.
    await refresh();
  } catch {
    failed.value = true;
  } finally {
    saving.value = false;
  }
}

/** Löschen beginnt erst nach 3 Sekunden Halten. Loslassen bricht ab. */
function startHold(entry: Place) {
  if (entry.active || deleting.value !== null) return;
  deleteFailed.value = null;
  holding.value = entry.place;
  holdTimer = setTimeout(() => {
    holding.value = null;
    void deleteWorld(entry.place);
  }, HOLD_MS);
}

function cancelHold() {
  clearTimeout(holdTimer);
  holding.value = null;
}

async function deleteWorld(place: number) {
  deleting.value = place;
  try {
    await $fetch(`/api/places/${place}`, { method: "DELETE" });
    // Der Platz ist wieder frei.
    await refresh();
  } catch {
    deleteFailed.value = place;
  } finally {
    deleting.value = null;
  }
}
</script>

<template>
  <section class="flex flex-col gap-3" data-testid="places">
    <h2 class="text-xl font-semibold">Welten</h2>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <div
        v-for="entry in places?.places"
        :key="entry.place"
        class="flex flex-col gap-2 rounded-xl border p-3"
        :class="entry.active ? 'border-primary bg-primary/10' : 'border-default bg-default/40'"
        :data-testid="`place-${entry.place}`"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs text-muted">Platz {{ entry.place }}</span>
          <div class="flex items-center gap-1">
            <UBadge v-if="entry.active" color="success" data-testid="place-active">Aktiv</UBadge>
            <UButton
              v-if="entry.world"
              data-testid="place-rename"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="md"
              aria-label="Welt umbenennen"
              @click="startRename(entry)"
            />
            <UButton
              v-if="entry.world"
              data-testid="place-delete"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="md"
              title="Welt löschen: 3 Sekunden gedrückt halten"
              aria-label="Welt löschen"
              :disabled="entry.active || deleting === entry.place"
              class="hold-button"
              @contextmenu.prevent
              @pointerdown="startHold(entry)"
              @pointerup="cancelHold"
              @pointerleave="cancelHold"
              @pointercancel="cancelHold"
            />
          </div>
        </div>
        <div
          v-if="holding === entry.place"
          class="h-1.5 overflow-hidden rounded-full bg-error/20"
          data-testid="place-delete-progress"
        >
          <div class="hold-fill h-full rounded-full bg-error" />
        </div>
        <template v-if="entry.world">
          <template v-if="renaming !== entry.place">
            <p class="font-semibold break-words">{{ entry.world.name }}</p>
            <div class="flex flex-wrap gap-1">
              <UBadge color="neutral" variant="subtle">{{ worldTypeLabel(entry.world.type) }}</UBadge>
              <UBadge color="neutral" variant="subtle">{{ gameModeLabel(entry.world.mode) }}</UBadge>
            </div>
          </template>
          <form v-else class="flex flex-col gap-2" @submit.prevent="save">
            <UInput
              v-model="name"
              data-testid="place-rename-input"
              :maxlength="WORLD_NAME_MAX"
              :autofocus="true"
              placeholder="Neuer Name"
            />
            <div class="flex gap-2">
              <UButton
                type="submit"
                data-testid="place-rename-save"
                size="sm"
                :loading="saving"
                :disabled="saving"
              >
                Speichern
              </UButton>
              <UButton
                data-testid="place-rename-cancel"
                color="neutral"
                variant="soft"
                size="sm"
                :disabled="saving"
                @click="cancel"
              >
                Abbrechen
              </UButton>
            </div>
            <UAlert
              v-if="failed"
              color="error"
              variant="subtle"
              icon="i-lucide-x"
              description="Das hat nicht geklappt. Versuch es nochmal."
              data-testid="place-rename-error"
            />
          </form>
          <UAlert
            v-if="deleteFailed === entry.place"
            color="error"
            variant="subtle"
            icon="i-lucide-x"
            description="Das hat nicht geklappt. Versuch es nochmal."
            data-testid="place-delete-error"
          />
        </template>
        <p v-else class="text-muted">Frei</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
@keyframes delete-hold {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}

/* Langes Drücken auf Tablets soll kein Kontextmenü und keine Textauswahl auslösen. */
.hold-button {
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

/* Füllt sich in HOLD_MS und zeigt an, wie lange der Knopf schon gehalten wird. */
.hold-fill {
  animation: delete-hold 3s linear forwards;
}
</style>
