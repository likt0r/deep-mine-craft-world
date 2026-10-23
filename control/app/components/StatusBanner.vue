<script setup lang="ts">
/** Zeigt außerhalb von Spielen, dass der Server gerade nicht bereit ist. Auf Spielen steht das in der Karte. */
const route = useRoute();
const { status } = useServerStatus();

const notice = computed(() => {
  if (route.path === "/" || !status.value) return null;
  if (status.value.busy)
    return { text: "Welt wird gewechselt …", color: "warning" as const, icon: "i-lucide-loader" };
  if (status.value.state === "starting")
    return { text: "Der Server startet …", color: "warning" as const, icon: "i-lucide-loader" };
  if (status.value.state === "stopped")
    return { text: "Der Server ist aus", color: "error" as const, icon: "i-lucide-power-off" };
  return null;
});
</script>

<template>
  <UContainer v-if="notice" class="pt-4">
    <UAlert
      :color="notice.color"
      variant="subtle"
      :icon="notice.icon"
      :title="notice.text"
      data-testid="status-banner"
      :actions="
        status?.state === 'stopped'
          ? [{ label: 'Zum Starten', to: '/', color: 'error', variant: 'solid', size: 'lg' }]
          : undefined
      "
    />
  </UContainer>
</template>
