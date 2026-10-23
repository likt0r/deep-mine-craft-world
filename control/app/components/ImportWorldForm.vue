<script setup lang="ts">
/** Eine .mcworld auf einen freien Platz importieren. Lädt nichts: die Welt liegt danach auf dem Platz. */
const props = defineProps<{ place: number }>();
const emit = defineEmits<{ imported: [name: string]; cancel: [] }>();

const fileInput = ref<HTMLInputElement | null>(null);
const file = ref<File | null>(null);
const name = ref("");
const type = ref<"normal" | "flach">("normal");
const mode = ref<"creative" | "survival" | "adventure">("creative");
/** Hochgeladen in Prozent, `null` solange nichts läuft */
const progress = ref<number | null>(null);
const error = ref("");

const TYPES = [
  { label: "Normal", value: "normal" },
  { label: "Flach", value: "flach" }
] as const;
const MODES = [
  { label: "Kreativ", value: "creative" },
  { label: "Überleben", value: "survival" },
  { label: "Abenteuer", value: "adventure" }
] as const;

function pick(event: Event) {
  const chosen = (event.target as HTMLInputElement).files?.[0] ?? null;
  file.value = chosen;
  error.value = "";
  // Der Dateiname ist meist der Name der Welt.
  if (chosen && !name.value)
    name.value = chosen.name.replace(/\.(mcworld|zip)$/i, "").slice(0, WORLD_NAME_MAX);
}

const valid = computed(() => file.value !== null && isValidWorldName(name.value.trim()));

/** XMLHttpRequest statt fetch: nur so gibt es einen Fortschritt beim Hochladen. */
function upload() {
  if (!file.value) return;
  error.value = "";
  progress.value = 0;
  const query = new URLSearchParams({ name: name.value.trim(), type: type.value, mode: mode.value });
  const xhr = new XMLHttpRequest();
  xhr.open("PUT", `/api/places/${props.place}/import?${query}`);
  xhr.setRequestHeader("Content-Type", "application/octet-stream");
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) progress.value = Math.round((e.loaded / e.total) * 100);
  };
  xhr.onload = () => {
    progress.value = null;
    if (xhr.status === 200) emit("imported", name.value.trim());
    else {
      let message = "";
      try {
        message = JSON.parse(xhr.responseText).message ?? "";
      } catch {
        // keine JSON-Antwort
      }
      error.value = message || "Das hat nicht geklappt. Versuch es nochmal.";
    }
  };
  xhr.onerror = () => {
    progress.value = null;
    error.value = "Keine Verbindung zum Server.";
  };
  xhr.send(file.value);
}
</script>

<template>
  <form class="flex flex-col gap-4" data-testid="import-world-form" @submit.prevent="upload">
    <input
      ref="fileInput"
      type="file"
      accept=".mcworld,.zip"
      class="hidden"
      data-testid="import-file"
      @change="pick"
    />
    <UButton
      type="button"
      icon="i-lucide-file-up"
      color="neutral"
      variant="subtle"
      size="xl"
      block
      class="block-btn"
      data-testid="import-pick"
      @click="fileInput?.click()"
    >
      {{ file ? `${file.name} · ${formatSize(file.size)}` : "Welt-Datei wählen (.mcworld)" }}
    </UButton>

    <UFormField label="Name" size="xl">
      <UInput v-model="name" :maxlength="WORLD_NAME_MAX" size="xl" class="w-full" data-testid="import-name" />
    </UFormField>

    <div class="flex flex-col gap-1.5">
      <span id="import-type-label" class="text-sm font-medium">Welttyp</span>
      <div class="grid grid-cols-2 gap-2" role="group" aria-labelledby="import-type-label">
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
      <span id="import-mode-label" class="text-sm font-medium">Spielmodus</span>
      <div
        class="grid grid-cols-3 gap-2"
        role="group"
        aria-labelledby="import-mode-label"
        data-testid="import-mode"
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

    <UProgress v-if="progress !== null" :modelValue="progress" size="lg" data-testid="import-progress" />
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :description="error"
      data-testid="import-error"
    />

    <div class="grid grid-cols-2 gap-2">
      <UButton
        type="button"
        color="neutral"
        variant="subtle"
        size="xl"
        block
        class="block-btn"
        :disabled="progress !== null"
        @click="emit('cancel')"
      >
        Abbrechen
      </UButton>
      <UButton
        type="submit"
        icon="i-lucide-download"
        size="xl"
        block
        class="block-btn font-pixel"
        :loading="progress !== null"
        :disabled="!valid || progress !== null"
        data-testid="import-submit"
      >
        Importieren
      </UButton>
    </div>
  </form>
</template>
