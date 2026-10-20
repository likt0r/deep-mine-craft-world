<script setup lang="ts">
const props = defineProps<{ status: Status | null | undefined }>();

const badge = computed(() => {
  if (props.status?.busy) return { label: "Welt wird gewechselt …", color: "warning" as const };
  switch (props.status?.state) {
    case "running":
      return { label: "Läuft", color: "success" as const };
    case "starting":
      return { label: "Startet …", color: "warning" as const };
    case "stopped":
      return { label: "Aus", color: "error" as const };
    default:
      return { label: "Unbekannt", color: "neutral" as const };
  }
});
</script>

<template>
  <header class="flex flex-col gap-2" data-testid="status-header">
    <p class="text-sm text-muted">Deep Mine Control</p>
    <h1 class="text-3xl font-bold break-words" data-testid="active-world">{{ status?.world || "…" }}</h1>
    <div class="flex flex-wrap items-center gap-2">
      <UBadge :color="badge.color" size="lg" data-testid="server-state">{{ badge.label }}</UBadge>
      <UBadge color="neutral" variant="subtle" size="lg" icon="i-lucide-users" data-testid="player-count">
        {{ status?.players.length ?? 0 }} online
      </UBadge>
    </div>
  </header>
</template>
