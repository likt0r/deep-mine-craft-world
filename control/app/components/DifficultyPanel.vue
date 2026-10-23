<script setup lang="ts">
/** `level`: wie viele der vier Balken gefüllt sind. */
const DIFFICULTIES = [
  { value: "peaceful", label: "Friedlich", level: 1 },
  { value: "easy", label: "Leicht", level: 2 },
  { value: "normal", label: "Normal", level: 3 },
  { value: "hard", label: "Schwer", level: 4 }
] as const;

const { places } = usePlaces();
const feedback = useFeedback();
const sending = ref(false);

const currentDifficulty = computed(() => {
  const active = places.value?.places.find((p) => p.active);
  return active?.world?.difficulty ?? "";
});

async function setDifficulty(difficulty: (typeof DIFFICULTIES)[number]) {
  if (sending.value) return;
  sending.value = true;
  try {
    await $fetch("/api/difficulty", { method: "POST", body: { difficulty: difficulty.value } });
    await refreshNuxtData("places");
    await refreshNuxtData("status");
    feedback.done(`Schwierigkeit: ${difficulty.label}.`);
  } catch {
    feedback.failed();
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <section class="flex flex-col gap-2.5" data-testid="difficulty" aria-labelledby="difficulty-heading">
    <h2 id="difficulty-heading" class="font-pixel text-xl font-semibold text-highlighted">Schwierigkeit</h2>
    <div class="grid grid-cols-4 gap-2">
      <UButton
        v-for="difficulty in DIFFICULTIES"
        :key="difficulty.value"
        :data-testid="`difficulty-${difficulty.value}`"
        :color="currentDifficulty === difficulty.value ? 'primary' : 'neutral'"
        :variant="currentDifficulty === difficulty.value ? 'solid' : 'subtle'"
        :aria-pressed="currentDifficulty === difficulty.value"
        :disabled="sending"
        class="block-btn h-17 flex-col justify-center gap-2 px-1 text-sm font-semibold sm:text-base"
        @click="setDifficulty(difficulty)"
      >
        <span aria-hidden="true" class="flex gap-0.75">
          <span
            v-for="bar in 4"
            :key="bar"
            class="size-2.25 rounded-[1px]"
            :class="
              bar <= difficulty.level
                ? currentDifficulty === difficulty.value
                  ? 'bg-inverted'
                  : 'bg-red-400'
                : currentDifficulty === difficulty.value
                  ? 'bg-inverted/25'
                  : 'bg-accented'
            "
          />
        </span>
        {{ difficulty.label }}
      </UButton>
    </div>
  </section>
</template>
