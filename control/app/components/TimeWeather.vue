<script setup lang="ts">
interface Choice {
  label: string;
  value: string;
  icon: string;
  message: string;
}

const times: Choice[] = [
  { label: "Morgen", value: "morgen", icon: "i-lucide-sunrise", message: "Morgen eingestellt." },
  { label: "Mittag", value: "mittag", icon: "i-lucide-sun", message: "Mittag eingestellt." },
  { label: "Abend", value: "abend", icon: "i-lucide-sunset", message: "Abend eingestellt." },
  { label: "Nacht", value: "nacht", icon: "i-lucide-moon", message: "Nacht eingestellt." }
];

const weathers: Choice[] = [
  { label: "Sonne", value: "sonne", icon: "i-lucide-cloud-sun", message: "Wetter auf Sonne gestellt." },
  { label: "Regen", value: "regen", icon: "i-lucide-cloud-rain", message: "Wetter auf Regen gestellt." },
  {
    label: "Gewitter",
    value: "gewitter",
    icon: "i-lucide-cloud-lightning",
    message: "Wetter auf Gewitter gestellt."
  }
];

const message = ref("");
const failed = ref(false);
/** Wert des Knopfes, der gerade sendet. `null`, solange nichts unterwegs ist. */
const pending = ref<string | null>(null);

async function send(pfad: string, body: Record<string, string>, choice: Choice) {
  pending.value = choice.value;
  try {
    await $fetch(pfad, { method: "POST", body });
    message.value = choice.message;
    failed.value = false;
  } catch {
    message.value = "Hat nicht geklappt. Bitte nochmal tippen.";
    failed.value = true;
  } finally {
    pending.value = null;
  }
}
</script>

<template>
  <section class="flex flex-col gap-3" data-testid="time-weather">
    <h2 class="text-xl font-semibold">Zeit &amp; Wetter</h2>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <UButton
        v-for="choice in times"
        :key="choice.value"
        block
        size="xl"
        :icon="choice.icon"
        :loading="pending === choice.value"
        :disabled="pending !== null"
        :data-testid="`time-${choice.value}`"
        @click="send('/api/time', { time: choice.value }, choice)"
      >
        {{ choice.label }}
      </UButton>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <UButton
        v-for="choice in weathers"
        :key="choice.value"
        block
        size="xl"
        color="neutral"
        :icon="choice.icon"
        :loading="pending === choice.value"
        :disabled="pending !== null"
        :data-testid="`weather-${choice.value}`"
        @click="send('/api/weather', { weather: choice.value }, choice)"
      >
        {{ choice.label }}
      </UButton>
    </div>

    <UAlert
      v-if="message"
      :color="failed ? 'error' : 'success'"
      variant="subtle"
      :icon="failed ? 'i-lucide-circle-alert' : 'i-lucide-circle-check'"
      :description="message"
      data-testid="time-weather-feedback"
    />
  </section>
</template>
