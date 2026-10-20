<script setup lang="ts">
/** Warnung vor einem Weltwechsel, wenn gerade jemand spielt. Alle werden beim Neustart kurz getrennt. */
defineProps<{ worldName: string; players: string[] }>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ confirm: [] }>();
</script>

<template>
  <UModal v-model:open="open" :title="`Nach „${worldName}“ wechseln?`">
    <template #body>
      <div class="flex flex-col gap-3" data-testid="switch-warning">
        <p>
          Gerade spielen:
          <strong data-testid="switch-warning-players">{{ players.join(", ") }}</strong>
        </p>
        <p class="text-muted">
          Der Server startet neu. Alle werden für etwa eine halbe Minute getrennt und müssen danach wieder
          beitreten.
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="soft" size="lg" @click="open = false">Abbrechen</UButton>
        <UButton size="lg" icon="i-lucide-refresh-cw" data-testid="switch-confirm" @click="emit('confirm')">
          Wechseln
        </UButton>
      </div>
    </template>
  </UModal>
</template>
