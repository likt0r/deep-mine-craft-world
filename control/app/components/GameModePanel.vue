<script setup lang="ts">
const MODES = [
  { value: "creative", label: "Kreativ" },
  { value: "survival", label: "Überleben" },
  { value: "adventure", label: "Abenteuer" }
] as const;

const { places } = usePlaces();

const sending = ref(false);
const toast = useToast();

const currentMode = computed(() => {
  const active = places.value?.places.find((p) => p.active);
  return active?.world?.mode ?? "";
});

async function setMode(mode: string) {
  if (sending.value) return;
  sending.value = true;
  try {
    await $fetch("/api/gamemode", { method: "POST", body: { mode } });
    await refreshNuxtData("places");
    await refreshNuxtData("status");
  } catch {
    toast.add({ title: "Das hat nicht geklappt. Versuch es nochmal.", color: "error", icon: "i-lucide-x" });
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <section class="flex flex-col gap-3" data-testid="gamemode">
    <h2 class="text-xl font-semibold">Spielmodus</h2>
    <div class="flex flex-wrap gap-2">
      <UButton
        v-for="mode in MODES"
        :key="mode.value"
        :data-testid="`gamemode-${mode.value}`"
        :variant="currentMode === mode.value ? 'solid' : 'outline'"
        :aria-pressed="currentMode === mode.value"
        size="xl"
        :disabled="sending"
        @click="setMode(mode.value)"
      >
        {{ mode.label }}
      </UButton>
    </div>
  </section>
</template>
