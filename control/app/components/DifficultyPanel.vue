<script setup lang="ts">
const DIFFICULTIES = [
  { value: "peaceful", label: "Friedlich" },
  { value: "easy", label: "Leicht" },
  { value: "normal", label: "Normal" },
  { value: "hard", label: "Schwer" }
] as const;

const { places } = usePlaces();

const sending = ref(false);
const toast = useToast();

const currentDifficulty = computed(() => {
  const active = places.value?.places.find((p) => p.active);
  return active?.world?.difficulty ?? "";
});

async function setDifficulty(difficulty: string) {
  if (sending.value) return;
  sending.value = true;
  try {
    await $fetch("/api/difficulty", { method: "POST", body: { difficulty } });
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
  <section class="flex flex-col gap-3" data-testid="difficulty">
    <h2 class="text-xl font-semibold">Schwierigkeit</h2>
    <div class="flex flex-wrap gap-2">
      <UButton
        v-for="difficulty in DIFFICULTIES"
        :key="difficulty.value"
        :data-testid="`difficulty-${difficulty.value}`"
        :variant="currentDifficulty === difficulty.value ? 'solid' : 'outline'"
        :aria-pressed="currentDifficulty === difficulty.value"
        size="xl"
        :disabled="sending"
        @click="setDifficulty(difficulty.value)"
      >
        {{ difficulty.label }}
      </UButton>
    </div>
  </section>
</template>
