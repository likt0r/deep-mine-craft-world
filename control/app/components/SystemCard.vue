<script setup lang="ts">
/** Eine Karte im Bereich System: Symbol und Titel oben, darunter der Inhalt. */
defineProps<{ title: string; icon: string; aside?: string }>();
</script>

<template>
  <section class="flex flex-col gap-2.5 rounded-xl border border-default bg-muted p-3.5">
    <div class="flex items-center gap-2 text-muted">
      <UIcon :name="icon" class="size-4.5" />
      <h2 class="text-sm font-semibold">{{ title }}</h2>
      <span v-if="aside" class="ms-auto text-sm">{{ aside }}</span>
    </div>
    <slot />
  </section>
</template>
