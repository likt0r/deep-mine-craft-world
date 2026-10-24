<script setup lang="ts">
defineProps<{ player: PlayerInfo }>();
</script>

<template>
  <li
    class="flex items-center gap-3 rounded-xl border border-default bg-muted py-2 ps-2 pe-2"
    data-testid="player-row"
    :data-player="player.name"
  >
    <PlayerAvatar :name="player.name" />
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="truncate font-semibold">{{ player.name }}</span>
      <span v-if="player.online && player.whitelisted" class="text-sm text-muted">Auf der Whitelist</span>
    </span>
    <slot />
  </li>
</template>
