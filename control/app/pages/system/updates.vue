<script setup lang="ts">
useSeoMeta({ title: "Updates · Deep Mine Control" });

const { status, connection, refresh: refreshStatus } = useServerStatus();
const feedback = useFeedback();
const { info, refresh } = useUpdates();

// Die Werte laden alle 5 s neu, solange die Seite sichtbar ist. Geprüft wird dabei höchstens stündlich.
useWhileVisible(refresh, 5000, { immediate: false });
// Fängt ein Update an oder hört es auf, gleich neu lesen.
watch(
  () => status.value?.updating,
  () => refresh()
);

const UNKNOWN = "unbekannt";
const control = computed(() => info.value?.control ?? null);
/** Laufendes oder zuletzt gescheitertes Update von Deep Mine Control */
const controlRun = computed(() => (info.value?.running?.kind === "control" ? info.value.running : null));
const controlInProgress = computed(() => !!controlRun.value && controlRun.value.phase !== "failed");
/** Nicht, solange schon ein Update oder Weltvorgang läuft: Deep Mine Control startet dabei neu. */
const controlLocked = computed(
  () => connection.value !== "ok" || !!status.value?.busy || !!status.value?.updating
);

async function updateControl() {
  try {
    await $fetch("/api/updates/control", { method: "POST" });
    feedback.done("Deep Mine Control wird aktualisiert …");
    await Promise.all([refresh(), refreshStatus()]);
  } catch {
    feedback.failed();
  }
}

const minecraft = computed(() => info.value?.minecraft ?? null);
/** Laufendes oder zuletzt gescheitertes Minecraft-Update */
const run = computed(() => (info.value?.running?.kind === "minecraft" ? info.value.running : null));
const inProgress = computed(() => !!run.value && run.value.phase !== "failed");
const players = computed(() => status.value?.players.length ?? 0);
/** Ein Update ist auch ein Weltvorgang: nicht, solange schon einer läuft. Gestoppt geht es aber. */
const updateLocked = computed(() => connection.value !== "ok" || !!status.value?.busy);

const checking = ref(false);
async function checkNow() {
  checking.value = true;
  try {
    info.value = await $fetch<UpdatesInfo>("/api/updates/check", { method: "POST" });
  } catch {
    feedback.failed();
  } finally {
    checking.value = false;
  }
}

const AUTO_DONE: Record<UpdateKind, Record<"on" | "off", string>> = {
  control: {
    on: "Deep Mine Control wird automatisch aktualisiert.",
    off: "Deep Mine Control wird nicht mehr automatisch aktualisiert."
  },
  minecraft: {
    on: "Minecraft wird automatisch aktualisiert.",
    off: "Minecraft wird nicht mehr automatisch aktualisiert."
  }
};
/** Welcher Schalter gerade gespeichert wird */
const switchingAuto = ref<UpdateKind | null>(null);
async function setAuto(kind: UpdateKind, on: boolean) {
  switchingAuto.value = kind;
  try {
    await $fetch("/api/updates/auto", { method: "PUT", body: { [kind]: on } });
    feedback.done(AUTO_DONE[kind][on ? "on" : "off"]);
    await refresh();
  } catch {
    feedback.failed();
  } finally {
    switchingAuto.value = null;
  }
}
/** Bei Autoupdate gibt es statt des Knopfs einen Hinweis. Eine gescheiterte Version versucht nur der Knopf erneut. */
const showUpdateButton = computed(() => !info.value?.auto.minecraft || !!minecraft.value?.failed);
const showControlButton = computed(() => !info.value?.auto.control || !!control.value?.failed);

async function updateMinecraft() {
  try {
    await $fetch("/api/updates/minecraft", { method: "POST" });
    feedback.done("Minecraft wird aktualisiert …");
    await Promise.all([refresh(), refreshStatus()]);
  } catch {
    feedback.failed();
  }
}
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <SystemCard title="Deep Mine Control" icon="i-lucide-tablet-smartphone" data-testid="updates-control">
      <dl
        class="grid grid-cols-[1fr_auto] text-[15px] [&>*]:border-b [&>*]:border-default [&>*]:py-2.5 [&>*:nth-last-child(-n+2)]:border-b-0"
      >
        <dt class="text-muted">Installiert</dt>
        <dd class="text-right font-semibold" data-testid="updates-control-current">
          {{ control?.current ?? UNKNOWN }}
        </dd>
        <dt class="text-muted">Neueste</dt>
        <dd class="text-right font-semibold" data-testid="updates-control-latest">
          {{ control?.latest ?? UNKNOWN }}
        </dd>
      </dl>

      <UAlert
        v-if="info?.errors.control"
        color="warning"
        variant="subtle"
        icon="i-lucide-cloud-off"
        title="Prüfen hat nicht geklappt"
        :description="info.errors.control"
        data-testid="updates-control-error"
      />

      <template v-if="controlInProgress">
        <div
          class="flex items-center gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-warning"
          data-testid="updates-control-running"
        >
          <UIcon name="i-lucide-loader-circle" class="size-5 shrink-0 animate-spin" />
          <span class="flex min-w-0 flex-col">
            <span class="font-semibold">Deep Mine Control wird aktualisiert …</span>
            <span class="text-sm text-toned">{{ updatePhaseLabel(controlRun!.phase) }}</span>
          </span>
        </div>
        <p class="text-sm text-muted">
          Deep Mine Control startet dabei neu, die Seite lädt danach von selbst.
        </p>
      </template>

      <template v-else-if="control?.available">
        <UAlert
          v-if="control.failed"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="`Update auf ${control.failed} ist fehlgeschlagen`"
          :description="
            info?.auto.control
              ? `${controlRun?.error ? controlRun.error + ' ' : ''}Automatisch wird es nicht noch einmal versucht.`
              : (controlRun?.error ?? undefined)
          "
          data-testid="updates-control-failed"
        />
        <p class="text-toned" data-testid="updates-control-available">
          <strong class="text-highlighted">Version {{ control.latest }}</strong> ist da.
        </p>
        <p
          v-if="!showControlButton"
          class="flex items-center gap-2 font-semibold text-highlighted"
          data-testid="updates-control-auto-hint"
        >
          <UIcon name="i-lucide-clock" class="size-5 shrink-0" />
          Wird automatisch installiert, sobald niemand spielt.
        </p>
        <template v-else>
          <p class="text-sm text-muted">
            Deep Mine Control startet dabei neu, die Seite lädt danach von selbst. Minecraft läuft weiter,
            niemand wird getrennt.
          </p>
          <HoldButton
            :label="control.failed ? 'Erneut versuchen' : 'Jetzt aktualisieren'"
            icon="i-lucide-download"
            color="warning"
            :disabled="controlLocked"
            data-testid="updates-control-update"
            @confirm="updateControl"
          />
          <p class="text-center text-sm text-muted">3 Sekunden gedrückt halten.</p>
        </template>
      </template>

      <p v-else-if="control?.latest && control.current === 'dev'" class="text-sm text-muted">
        Entwicklungsstand ohne Paket: Aktualisieren geht nur mit installiertem Paket.
      </p>
      <p
        v-else-if="control?.latest"
        class="flex items-center gap-2 font-semibold text-success"
        data-testid="updates-control-uptodate"
      >
        <UIcon name="i-lucide-circle-check" class="size-5" />
        Deep Mine Control ist aktuell.
      </p>

      <!-- Nur Text: Die Änderungsliste kommt aus GitHub, deshalb kein v-html. -->
      <details
        v-if="control?.notes"
        class="group border-t border-default pt-3"
        data-testid="updates-control-notes"
      >
        <summary class="flex cursor-pointer list-none items-center gap-2 font-semibold">
          <UIcon
            name="i-lucide-chevron-right"
            class="size-5 shrink-0 transition-transform group-open:rotate-90"
          />
          Änderungen in {{ control.latest }}
          <span v-if="control.publishedAt" class="ms-auto text-sm font-normal text-muted">
            {{ formatWhen(control.publishedAt) }}
          </span>
        </summary>
        <p
          class="mt-2 text-sm break-words whitespace-pre-wrap text-toned"
          data-testid="updates-control-notes-text"
        >
          {{ control.notes }}
        </p>
      </details>

      <div class="flex items-center gap-3 border-t border-default pt-3">
        <span id="auto-control-label" class="flex-1 font-semibold">Automatisch aktualisieren</span>
        <USwitch
          size="xl"
          aria-labelledby="auto-control-label"
          :modelValue="info?.auto.control ?? false"
          :loading="switchingAuto === 'control'"
          :disabled="!!switchingAuto || !info"
          data-testid="update-auto-control"
          @update:modelValue="(on: boolean) => setAuto('control', on)"
        />
      </div>
      <p class="text-sm text-muted">
        Jede Stunde wird geprüft. Eine neue Version wird nur installiert, wenn gerade niemand spielt, und erst
        nach einem neuen Minecraft.
      </p>
    </SystemCard>

    <SystemCard title="Minecraft-Server" icon="i-lucide-pickaxe" data-testid="updates-minecraft">
      <dl
        class="grid grid-cols-[1fr_auto] text-[15px] [&>*]:border-b [&>*]:border-default [&>*]:py-2.5 [&>*:nth-last-child(-n+2)]:border-b-0"
      >
        <dt class="text-muted">Installiert</dt>
        <dd class="text-right font-semibold" data-testid="updates-minecraft-current">
          {{ minecraft?.current ?? UNKNOWN }}
        </dd>
        <dt class="text-muted">Neueste</dt>
        <dd class="text-right font-semibold" data-testid="updates-minecraft-latest">
          {{ minecraft?.latest ?? UNKNOWN }}
        </dd>
      </dl>

      <UAlert
        v-if="info?.errors.minecraft"
        color="warning"
        variant="subtle"
        icon="i-lucide-cloud-off"
        title="Prüfen hat nicht geklappt"
        :description="info.errors.minecraft"
        data-testid="updates-error"
      />

      <div
        v-if="inProgress"
        class="flex items-center gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-warning"
        data-testid="updates-minecraft-running"
      >
        <UIcon name="i-lucide-loader-circle" class="size-5 shrink-0 animate-spin" />
        <span class="flex min-w-0 flex-col">
          <span class="font-semibold">Minecraft wird aktualisiert …</span>
          <span class="text-sm text-toned">{{ updatePhaseLabel(run!.phase) }}</span>
        </span>
      </div>

      <template v-else-if="minecraft?.available">
        <UAlert
          v-if="minecraft.failed"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="`Update auf ${minecraft.failed} ist fehlgeschlagen`"
          :description="
            info?.auto.minecraft
              ? `${run?.error ? run.error + ' ' : ''}Automatisch wird es nicht noch einmal versucht.`
              : (run?.error ?? undefined)
          "
          data-testid="updates-minecraft-failed"
        />
        <p class="text-toned" data-testid="updates-minecraft-available">
          <strong class="text-highlighted">Version {{ minecraft.latest }}</strong> ist da. Tablets und
          Konsolen mit neuem Minecraft können sonst bald nicht mehr beitreten.
        </p>
        <p
          v-if="!showUpdateButton"
          class="flex items-center gap-2 font-semibold text-highlighted"
          data-testid="updates-minecraft-auto-hint"
        >
          <UIcon name="i-lucide-clock" class="size-5 shrink-0" />
          Wird automatisch installiert, sobald niemand spielt.
        </p>
        <template v-else>
          <p class="text-sm text-muted">
            Minecraft stoppt dafür, BSM sichert alles und startet den Server neu.
            <template v-if="players > 0">
              {{
                players === 1
                  ? "1 Spieler ist online und bekommt"
                  : `${players} Spieler sind online und bekommen`
              }}
              10 Sekunden Countdown im Chat.
            </template>
            Alle werden kurz getrennt.
          </p>
          <HoldButton
            :label="minecraft.failed ? 'Erneut versuchen' : 'Jetzt aktualisieren'"
            icon="i-lucide-download"
            color="warning"
            :disabled="updateLocked"
            data-testid="updates-minecraft-update"
            @confirm="updateMinecraft"
          />
          <p class="text-center text-sm text-muted">3 Sekunden gedrückt halten.</p>
        </template>
      </template>

      <p
        v-else-if="minecraft?.latest"
        class="flex items-center gap-2 font-semibold text-success"
        data-testid="updates-minecraft-uptodate"
      >
        <UIcon name="i-lucide-circle-check" class="size-5" />
        Minecraft ist aktuell.
      </p>

      <div class="flex items-center gap-3 border-t border-default pt-3">
        <span id="auto-minecraft-label" class="flex-1 font-semibold">Automatisch aktualisieren</span>
        <USwitch
          size="xl"
          aria-labelledby="auto-minecraft-label"
          :modelValue="info?.auto.minecraft ?? false"
          :loading="switchingAuto === 'minecraft'"
          :disabled="!!switchingAuto || !info"
          data-testid="update-auto-minecraft"
          @update:modelValue="(on: boolean) => setAuto('minecraft', on)"
        />
      </div>
      <p class="text-sm text-muted">
        Jede Stunde wird geprüft. Ein neues Minecraft wird nur installiert, wenn gerade niemand spielt.
      </p>
    </SystemCard>

    <!-- Geprüft wird beides zusammen. -->
    <div class="flex flex-col gap-2.5">
      <p class="text-sm text-muted">
        Zuletzt geprüft:
        <span class="font-semibold text-toned" data-testid="updates-checked-at">
          {{ info?.checkedAt ? formatWhen(info.checkedAt) : "noch nie" }}
        </span>
        <template v-if="info?.error">
          · Ohne Internet (nur eigenes WLAN) lässt sich nicht prüfen, ob es neue Versionen gibt.
        </template>
      </p>
      <UButton
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="subtle"
        size="lg"
        class="block-btn self-start"
        :loading="checking"
        :disabled="checking"
        data-testid="updates-check"
        @click="checkNow"
      >
        Jetzt prüfen
      </UButton>
    </div>
  </div>
</template>
