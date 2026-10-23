<script setup lang="ts">
/** Knopf, der erst nach `ms` Gedrückthalten auslöst. Ein Balken füllt sich, solange gehalten wird. */
const props = withDefaults(
  defineProps<{
    label: string;
    icon: string;
    color?: "error" | "warning";
    ms?: number;
    disabled?: boolean;
  }>(),
  { color: "error", ms: 3000, disabled: false }
);
const emit = defineEmits<{ confirm: [] }>();

const { holding, handlers } = useHoldToConfirm(props.ms, () => emit("confirm"));
</script>

<template>
  <UButton
    :color="color"
    variant="subtle"
    size="xl"
    block
    :icon="icon"
    :disabled="disabled"
    class="hold-button block-btn relative overflow-hidden font-semibold"
    v-bind="disabled ? {} : handlers"
  >
    <span
      v-if="holding"
      aria-hidden="true"
      class="hold-fill absolute inset-y-0 left-0"
      :class="color === 'error' ? 'bg-error/40' : 'bg-warning/40'"
      :style="{ animationDuration: `${ms}ms` }"
      data-testid="hold-progress"
    />
    <span class="relative">{{ holding ? "Weiter halten …" : label }}</span>
  </UButton>
</template>

<style scoped>
@keyframes hold {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}

/* Langes Drücken auf Tablets soll keine Textauswahl auslösen. */
.hold-button {
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.hold-fill {
  animation-name: hold;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}
</style>
