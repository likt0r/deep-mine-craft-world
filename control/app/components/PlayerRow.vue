<script setup lang="ts">
const props = defineProps<{ player: PlayerInfo }>();
const emit = defineEmits<{ open: [] }>();

/** „Hat alles angezündet · seit 24.10.2026“ */
function banLine(banned: NonNullable<PlayerInfo["banned"]>) {
  const parts = [banned.reason ?? "Gesperrt"];
  if (banned.since) parts.push(`seit ${formatDate(banned.since)}`);
  return parts.join(" · ");
}

/** Zweite Zeile: Whitelist nur bei Online-Spielern (sonst steht er im Abschnitt Whitelist), Mitglied ist normal. */
const details = computed(() =>
  [
    props.player.online && props.player.whitelisted && "Auf der Whitelist",
    props.player.permission === "operator" && "Operator",
    props.player.permission === "visitor" && "Besucher"
  ]
    .filter(Boolean)
    .join(" · ")
);
</script>

<template>
  <li data-testid="player-row" :data-player="player.name">
    <button
      type="button"
      class="flex min-h-15 w-full items-center gap-3 rounded-xl border border-default bg-muted py-2 ps-2 pe-3 text-left transition-transform active:translate-y-px"
      data-testid="player-open"
      @click="emit('open')"
    >
      <PlayerAvatar :name="player.name" />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate font-semibold">{{ player.name }}</span>
        <span v-if="player.banned" class="truncate text-sm text-error" data-testid="player-row-ban">
          {{ banLine(player.banned) }}
        </span>
        <span v-else-if="details" class="text-sm text-muted">{{ details }}</span>
      </span>
      <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-dimmed" />
    </button>
  </li>
</template>
