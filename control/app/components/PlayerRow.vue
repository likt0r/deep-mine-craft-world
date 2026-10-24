<script setup lang="ts">
defineProps<{ player: PlayerInfo }>();
const emit = defineEmits<{ open: [] }>();
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
        <span v-if="player.online && player.whitelisted" class="text-sm text-muted">Auf der Whitelist</span>
      </span>
      <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-dimmed" />
    </button>
  </li>
</template>
