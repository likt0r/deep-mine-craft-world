<script setup lang="ts">
const props = defineProps<{ place: number; players: string[] }>();
const emit = defineEmits<{ created: [name: string]; cancel: [] }>();

const name = ref("");
const type = ref<"normal" | "flach">("normal");
const mode = ref<"creative" | "survival" | "adventure">("creative");
const sending = ref(false);
const failed = ref(false);

const TYPES = [
  { label: "Normal", value: "normal" },
  { label: "Flach", value: "flach" }
] as const;

const MODES = [
  { label: "Kreativ", value: "creative" },
  { label: "Überleben", value: "survival" },
  { label: "Abenteuer", value: "adventure" }
] as const;

async function create() {
  sending.value = true;
  failed.value = false;
  try {
    await $fetch(`/api/places/${props.place}`, {
      method: "POST",
      body: { name: name.value, type: type.value, mode: mode.value }
    });
    emit("created", name.value.trim());
  } catch {
    failed.value = true;
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <form class="flex flex-col gap-4" data-testid="new-world-form" @submit.prevent="create">
    <UFormField label="Name" size="xl">
      <UInput
        v-model="name"
        data-testid="new-world-name"
        :maxlength="WORLD_NAME_MAX"
        placeholder="z. B. Bauwelt"
        size="xl"
        class="w-full"
      />
    </UFormField>

    <div class="flex flex-col gap-1.5">
      <span id="new-world-type-label" class="text-sm font-medium">Welttyp</span>
      <div
        class="grid grid-cols-2 gap-2"
        role="group"
        aria-labelledby="new-world-type-label"
        data-testid="new-world-type"
      >
        <UButton
          v-for="item in TYPES"
          :key="item.value"
          :color="type === item.value ? 'primary' : 'neutral'"
          :variant="type === item.value ? 'solid' : 'subtle'"
          :aria-pressed="type === item.value"
          size="xl"
          block
          class="block-btn"
          @click="type = item.value"
        >
          {{ item.label }}
        </UButton>
      </div>
    </div>

    <div class="flex flex-col gap-1.5">
      <span id="new-world-mode-label" class="text-sm font-medium">Startmodus</span>
      <div
        class="grid grid-cols-3 gap-2"
        role="group"
        aria-labelledby="new-world-mode-label"
        data-testid="new-world-mode"
      >
        <UButton
          v-for="item in MODES"
          :key="item.value"
          :color="mode === item.value ? 'primary' : 'neutral'"
          :variant="mode === item.value ? 'solid' : 'subtle'"
          :aria-pressed="mode === item.value"
          size="xl"
          block
          class="block-btn px-1"
          @click="mode = item.value"
        >
          {{ item.label }}
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="players.length"
      color="warning"
      variant="subtle"
      icon="i-lucide-users"
      :title="`Gerade spielen: ${players.join(', ')}`"
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

    <div class="grid grid-cols-2 gap-2">
      <UButton
        type="button"
        color="neutral"
        variant="subtle"
        size="xl"
        block
        class="block-btn"
        :disabled="sending"
        @click="emit('cancel')"
      >
        Abbrechen
      </UButton>
      <UButton
        type="submit"
        icon="i-lucide-plus"
        size="xl"
        block
        class="block-btn font-pixel"
        data-testid="new-world-submit"
        :loading="sending"
        :disabled="sending || name.trim() === ''"
      >
        Anlegen und laden
      </UButton>
    </div>
  </form>
</template>
