<script setup lang="ts">
const emit = defineEmits<{ started: [] }>();
const starting = ref(false);

async function start() {
  starting.value = true;
  try {
    await $fetch("/api/start", { method: "POST" });
    emit("started");
  } finally {
    starting.value = false;
  }
}
</script>

<template>
  <UAlert
    color="error"
    variant="solid"
    icon="i-lucide-power-off"
    title="Der Server ist aus"
    description="Niemand kann gerade spielen. Starte ihn hier wieder."
    data-testid="server-off"
    :actions="[
      {
        label: 'Starten',
        icon: 'i-lucide-power',
        size: 'xl',
        color: 'neutral',
        loading: starting,
        onClick: start
      }
    ]"
  />
</template>
