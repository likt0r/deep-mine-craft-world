<script setup lang="ts">
interface Choice {
  label: string;
  value: string;
  icon: string;
  /** Farbe des Symbols */
  tint: string;
  message: string;
}

const times: Choice[] = [
  {
    label: "Morgen",
    value: "morgen",
    icon: "i-lucide-sunrise",
    tint: "text-amber-400",
    message: "Morgen eingestellt."
  },
  {
    label: "Mittag",
    value: "mittag",
    icon: "i-lucide-sun",
    tint: "text-amber-400",
    message: "Mittag eingestellt."
  },
  {
    label: "Abend",
    value: "abend",
    icon: "i-lucide-sunset",
    tint: "text-orange-400",
    message: "Abend eingestellt."
  },
  {
    label: "Nacht",
    value: "nacht",
    icon: "i-lucide-moon",
    tint: "text-violet-300",
    message: "Nacht eingestellt."
  }
];

const weathers: Choice[] = [
  {
    label: "Sonne",
    value: "sonne",
    icon: "i-lucide-cloud-sun",
    tint: "text-amber-400",
    message: "Wetter auf Sonne gestellt."
  },
  {
    label: "Regen",
    value: "regen",
    icon: "i-lucide-cloud-rain",
    tint: "text-sky-400",
    message: "Wetter auf Regen gestellt."
  },
  {
    label: "Gewitter",
    value: "gewitter",
    icon: "i-lucide-cloud-lightning",
    tint: "text-indigo-300",
    message: "Wetter auf Gewitter gestellt."
  }
];

const feedback = useFeedback();
/** Wert des Knopfes, der gerade sendet. `null`, solange nichts unterwegs ist. */
const pending = ref<string | null>(null);

async function send(pfad: string, body: Record<string, string>, choice: Choice) {
  pending.value = choice.value;
  try {
    await $fetch(pfad, { method: "POST", body });
    feedback.done(choice.message);
  } catch {
    feedback.failed("Hat nicht geklappt. Bitte nochmal tippen.");
  } finally {
    pending.value = null;
  }
}

const sections = [
  { id: "time", title: "Zeit", choices: times, path: "/api/time", key: "time", cols: "grid-cols-4" },
  {
    id: "weather",
    title: "Wetter",
    choices: weathers,
    path: "/api/weather",
    key: "weather",
    cols: "grid-cols-3"
  }
];
</script>

<template>
  <div class="flex flex-col gap-6 lg:flex-row lg:gap-5" data-testid="time-weather">
    <section
      v-for="section in sections"
      :key="section.id"
      class="flex min-w-0 flex-col gap-2.5"
      :class="section.id === 'time' ? 'lg:flex-4' : 'lg:flex-3'"
      :aria-labelledby="`${section.id}-heading`"
    >
      <h2 :id="`${section.id}-heading`" class="font-pixel text-xl font-semibold text-highlighted">
        {{ section.title }}
      </h2>
      <div class="grid gap-2" :class="section.cols">
        <UButton
          v-for="choice in section.choices"
          :key="choice.value"
          color="neutral"
          variant="subtle"
          :loading="pending === choice.value"
          :disabled="pending !== null"
          :data-testid="`${section.id}-${choice.value}`"
          class="block-btn h-18 flex-col justify-center gap-1.5 px-1 text-sm font-semibold sm:text-base"
          @click="send(section.path, { [section.key]: choice.value }, choice)"
        >
          <UIcon :name="choice.icon" class="size-6" :class="choice.tint" />
          {{ choice.label }}
        </UButton>
      </div>
    </section>
  </div>
</template>
