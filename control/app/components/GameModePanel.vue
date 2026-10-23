<script setup lang="ts">
const MODES = [
  { value: "creative", label: "Kreativ", icon: "i-lucide-box" },
  { value: "survival", label: "Überleben", icon: "i-lucide-heart" },
  { value: "adventure", label: "Abenteuer", icon: "i-lucide-compass" }
] as const;

const { places } = usePlaces();
const feedback = useFeedback();
const sending = ref(false);

const currentMode = computed(() => {
  const active = places.value?.places.find((p) => p.active);
  return active?.world?.mode ?? "";
});

async function setMode(mode: (typeof MODES)[number]) {
  if (sending.value) return;
  sending.value = true;
  try {
    await $fetch("/api/gamemode", { method: "POST", body: { mode: mode.value } });
    await refreshNuxtData("places");
    await refreshNuxtData("status");
    feedback.done(`Spielmodus: ${mode.label}.`);
  } catch {
    feedback.failed();
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <section class="flex flex-col gap-2.5" data-testid="gamemode" aria-labelledby="gamemode-heading">
    <h2 id="gamemode-heading" class="font-pixel text-xl font-semibold text-highlighted">Spielmodus</h2>
    <div class="grid grid-cols-3 gap-2">
      <UButton
        v-for="mode in MODES"
        :key="mode.value"
        :data-testid="`gamemode-${mode.value}`"
        :color="currentMode === mode.value ? 'primary' : 'neutral'"
        :variant="currentMode === mode.value ? 'solid' : 'subtle'"
        :aria-pressed="currentMode === mode.value"
        :disabled="sending"
        class="block-btn h-19 flex-col justify-center gap-1.5 text-base font-semibold"
        @click="setMode(mode)"
      >
        <UIcon :name="mode.icon" class="size-6" />
        {{ mode.label }}
      </UButton>
    </div>
  </section>
</template>
