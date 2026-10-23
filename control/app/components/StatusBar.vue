<script setup lang="ts">
/** Schmale Leiste oben in allen Bereichen: verbunden, Welt wird geladen, Server aus, keine Verbindung. */
const route = useRoute();
const { status, connection } = useServerStatus();

interface View {
  state: string;
  text: string;
  /** Kleiner Zusatz rechts */
  extra?: string;
  icon?: string;
  /** Farbe von Punkt, Text und Hintergrund */
  tone: "success" | "warning" | "error" | "neutral";
  spin?: boolean;
  /** Weg zum Starten (außerhalb von Spielen, wo die Karte den Knopf hat) */
  startLink?: boolean;
}

const view = computed<View>(() => {
  if (connection.value === "offline")
    return {
      state: "offline",
      text: "Keine Verbindung",
      extra: "Versuche es weiter …",
      icon: "i-lucide-wifi-off",
      tone: "neutral"
    };
  if (connection.value === "bsm-down")
    return {
      state: "bsm-down",
      text: "Server-Verwaltung antwortet nicht",
      icon: "i-lucide-server-crash",
      tone: "error"
    };

  const s = status.value;
  if (!s)
    return {
      state: "loading",
      text: "Verbinde …",
      tone: "neutral",
      icon: "i-lucide-loader-circle",
      spin: true
    };
  if (s.switching)
    return {
      state: "switching",
      text: `Welt wird geladen: ${s.switching.world}`,
      extra: switchPhaseLabel(s.switching.phase),
      icon: "i-lucide-loader-circle",
      tone: "warning",
      spin: true
    };
  if (s.busy)
    return {
      state: "busy",
      text: "Welt wird geändert …",
      icon: "i-lucide-loader-circle",
      tone: "warning",
      spin: true
    };
  if (s.state === "starting")
    return {
      state: "starting",
      text: "Server startet …",
      icon: "i-lucide-loader-circle",
      tone: "warning",
      spin: true
    };
  if (s.state === "stopped")
    return {
      state: "stopped",
      text: "Server ist aus",
      icon: "i-lucide-power-off",
      tone: "error",
      startLink: route.path !== "/"
    };
  return {
    state: "running",
    text: "Verbunden · Server läuft",
    extra: `${s.players.length} online`,
    tone: "success"
  };
});

const TONES = {
  success: "bg-success/10 text-success border-success/25",
  warning: "bg-warning/10 text-warning border-warning/30",
  error: "bg-error/12 text-error border-error/30",
  neutral: "bg-elevated text-toned border-default"
};
</script>

<template>
  <div
    role="status"
    data-testid="status-bar"
    :data-state="view.state"
    class="sticky top-0 z-30 border-b backdrop-blur-sm"
    :class="TONES[view.tone]"
  >
    <UContainer class="flex min-h-10 items-center gap-2 text-sm font-semibold">
      <UIcon
        v-if="view.icon"
        :name="view.icon"
        class="size-4.5 shrink-0"
        :class="{ 'animate-spin': view.spin }"
      />
      <span v-else aria-hidden="true" class="size-2.5 shrink-0 rounded-[2px] bg-current" />
      <span class="min-w-0 truncate">{{ view.text }}</span>
      <span v-if="view.extra" class="ms-auto shrink-0 font-medium opacity-80">{{ view.extra }}</span>
      <UButton v-if="view.startLink" to="/" size="xs" color="error" class="ms-auto" icon="i-lucide-power">
        Starten
      </UButton>
    </UContainer>
    <span
      v-if="view.state === 'switching'"
      aria-hidden="true"
      class="switch-stripes absolute inset-x-0 bottom-0 h-1"
    />
  </div>
</template>
