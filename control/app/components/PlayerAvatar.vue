<script setup lang="ts">
/** `large`: für den Kopf des Spieler-Sheets. */
const props = defineProps<{ name: string; large?: boolean }>();

/** Farbe des Avatar-Blocks, fest pro Name. */
const COLORS = ["bg-sky-400", "bg-orange-400", "bg-lime-400", "bg-violet-300", "bg-amber-400", "bg-pink-300"];
const color = computed(() => {
  let sum = 0;
  for (const char of props.name) sum += char.codePointAt(0) ?? 0;
  return COLORS[sum % COLORS.length];
});
</script>

<template>
  <span
    aria-hidden="true"
    class="flex shrink-0 items-center justify-center rounded-lg font-pixel font-bold text-neutral-950"
    :class="[
      color,
      large
        ? 'size-12 text-xl shadow-[inset_0_-5px_0_rgb(0_0_0/0.25)]'
        : 'size-10 text-lg shadow-[inset_0_-4px_0_rgb(0_0_0/0.25)]'
    ]"
  >
    {{ name.charAt(0).toUpperCase() }}
  </span>
</template>
