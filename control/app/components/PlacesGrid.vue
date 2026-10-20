<script setup lang="ts">
const { places, refresh } = usePlaces();

/** Platz, der gerade umbenannt wird, sonst null. */
const renaming = ref<number | null>(null);
const name = ref("");
const saving = ref(false);
const failed = ref(false);

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
              size="xs"
              aria-label="Welt umbenennen"
              @click="startRename(entry)"
            />
          </div>
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
        </template>
        <p v-else class="text-muted">Frei</p>
      </div>
    </div>
  </section>
</template>
