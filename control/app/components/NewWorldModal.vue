<script setup lang="ts">
const props = defineProps<{ place: number }>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ created: [] }>();
const { data: status } = useNuxtData<Status>("status");

const name = ref("");
const type = ref<"normal" | "flach">("normal");
const mode = ref<"creative" | "survival" | "adventure">("creative");
const sending = ref(false);
const failed = ref(false);

const types = [
  { label: "Normal", value: "normal" },
  { label: "Flach", value: "flach" }
];

const modes = [
  { label: "Kreativ", value: "creative" },
  { label: "Überleben", value: "survival" },
  { label: "Abenteuer", value: "adventure" }
];

watch(open, (isOpen) => {
  if (!isOpen) return;
  name.value = "";
  type.value = "normal";
  mode.value = "creative";
  failed.value = false;
});

async function create() {
  sending.value = true;
  failed.value = false;
  try {
    await $fetch(`/api/places/${props.place}`, {
      method: "POST",
      body: { name: name.value, type: type.value, mode: mode.value }
    });
    open.value = false;
    emit("created");
  } catch {
    failed.value = true;
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Neue Welt">
    <template #body>
      <form class="flex flex-col gap-4" data-testid="new-world-modal" @submit.prevent="create">
        <UFormField label="Name">
          <UInput
            v-model="name"
            data-testid="new-world-name"
            :maxlength="WORLD_NAME_MAX"
            placeholder="z. B. Bauwelt"
          />
        </UFormField>

        <UFormField label="Welttyp">
          <URadioGroup v-model="type" :items="types" orientation="horizontal" data-testid="new-world-type" />
        </UFormField>

        <UFormField label="Startmodus">
          <URadioGroup v-model="mode" :items="modes" orientation="horizontal" data-testid="new-world-mode" />
        </UFormField>

        <UAlert
          v-if="status?.players.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-users"
          :title="`Gerade spielen: ${status.players.join(', ')}`"
          description="Die neue Welt wird gleich geladen. Der Server startet neu, alle werden kurz getrennt."
          data-testid="new-world-players-warning"
        />

        <UAlert
          v-if="failed"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          description="Das hat nicht geklappt. Versuch es nochmal."
          data-testid="new-world-error"
        />

        <div class="flex justify-end gap-2">
          <UButton type="button" color="neutral" variant="soft" :disabled="sending" @click="open = false">
            Abbrechen
          </UButton>
          <UButton
            type="submit"
            data-testid="new-world-submit"
            :loading="sending"
            :disabled="sending || name.trim() === ''"
          >
            Anlegen
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
