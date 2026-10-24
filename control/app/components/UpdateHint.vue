<script setup lang="ts">
/**
 * Hinweis auf eine neue Version. Autoupdate aus: Knopf „Aktualisieren“ mit Menü von unten (Halten zum Bestätigen).
 * Autoupdate an: nur der Hinweis, dass es von selbst kommt. „Später“ blendet diese Version auf diesem Gerät aus.
 */
const props = defineProps<{ update: AvailableUpdate }>();

const { status } = useServerStatus();
const { info, refresh } = useUpdates();
const feedback = useFeedback();

const auto = computed(() => info.value?.auto[props.update.kind] ?? false);
const players = computed(() => status.value?.players.length ?? 0);

// Ausgeblendet wird pro Version: Kommt eine neuere, erscheint der Hinweis wieder.
const storageKey = computed(() => `update-later:${props.update.kind}:${props.update.version}`);
const later = ref(false);
onMounted(() => {
  try {
    later.value = localStorage.getItem(storageKey.value) === "1";
  } catch {
    // Ohne Speicher (z. B. privates Fenster) einfach immer zeigen.
  }
});

function dismiss() {
  later.value = true;
  try {
    localStorage.setItem(storageKey.value, "1");
  } catch {
    // Dann nur bis zum Neuladen ausgeblendet.
  }
}

const open = ref(false);

async function confirm() {
  try {
    if (props.update.kind === "minecraft") await $fetch("/api/updates/minecraft", { method: "POST" });
    else await $fetch("/api/updates/control", { method: "POST" });
    open.value = false;
    feedback.done(`${props.update.label} wird installiert …`);
    await refresh();
  } catch {
    feedback.failed();
  }
}
</script>

<template>
  <div
    v-if="!later"
    class="flex flex-col gap-3 rounded-xl border-2 border-primary/50 bg-primary/10 p-3.5 sm:flex-row sm:items-center"
    data-testid="update-hint"
    :data-kind="update.kind"
  >
    <div class="flex min-w-0 flex-1 items-start gap-2.5">
      <UIcon name="i-lucide-sparkles" class="mt-0.5 size-5 shrink-0 text-primary" />
      <div class="min-w-0">
        <p class="font-pixel text-lg font-bold text-highlighted">Neue Version: {{ update.label }}</p>
        <p v-if="auto" class="text-sm text-muted">Wird automatisch installiert, sobald niemand spielt.</p>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <UButton
        v-if="!auto"
        icon="i-lucide-download"
        class="block-btn font-pixel"
        data-testid="update-hint-update"
        @click="open = true"
      >
        Aktualisieren
      </UButton>
      <UButton
        color="neutral"
        variant="ghost"
        class="block-btn"
        data-testid="update-hint-later"
        @click="dismiss"
      >
        Später
      </UButton>
      <UButton to="/system/updates" color="neutral" variant="link" trailingIcon="i-lucide-chevron-right">
        Details
      </UButton>
    </div>

    <UDrawer
      v-model:open="open"
      handleOnly
      :title="`${update.label} installieren`"
      :ui="{
        content: 'bg-muted',
        container: 'mx-auto w-full max-w-lg pb-[calc(1rem+env(safe-area-inset-bottom))]'
      }"
    >
      <template #body>
        <div class="flex flex-col gap-3" data-testid="update-hint-sheet">
          <template v-if="update.kind === 'minecraft'">
            <UAlert
              v-if="players > 0"
              color="warning"
              variant="subtle"
              icon="i-lucide-users"
              :title="players === 1 ? '1 Spieler ist online' : `${players} Spieler sind online`"
              description="Nach 10 Sekunden Countdown im Chat werden alle kurz getrennt."
            />
            <p class="text-muted">
              Der Server stoppt, BSM sichert die Welt, installiert die neue Version und startet wieder.
            </p>
          </template>
          <p v-else class="text-muted">
            Deep Mine Control startet dabei neu, die Seite lädt danach von selbst. Im Spiel merkt niemand
            etwas.
          </p>
          <HoldButton
            label="Aktualisieren"
            icon="i-lucide-download"
            data-testid="update-hint-confirm"
            @confirm="confirm"
          />
          <p class="text-center text-sm text-muted">Zum Bestätigen 3 Sekunden gedrückt halten.</p>
        </div>
      </template>
    </UDrawer>
  </div>
</template>
