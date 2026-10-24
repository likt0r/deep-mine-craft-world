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

const switchingAuto = ref(false);
async function setAutoMinecraft(minecraft: boolean) {
  switchingAuto.value = true;
  try {
    await $fetch("/api/updates/auto", { method: "PUT", body: { minecraft } });
    feedback.done(
      minecraft
        ? "Minecraft wird automatisch aktualisiert."
        : "Minecraft wird nicht mehr automatisch aktualisiert."
    );
    await refresh();
  } catch {
    feedback.failed();
  } finally {
    switchingAuto.value = false;
  }
}
/** Bei Autoupdate gibt es statt des Knopfs einen Hinweis. Eine gescheiterte Version versucht nur der Knopf erneut. */
const showUpdateButton = computed(() => !info.value?.auto.minecraft || !!minecraft.value?.failed);

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
        <dt class="text-muted">Zuletzt geprüft</dt>
        <dd class="text-right font-semibold" data-testid="updates-checked-at">
          {{ info?.checkedAt ? formatWhen(info.checkedAt) : "noch nie" }}
        </dd>
      </dl>

      <UAlert
        v-if="info?.error"
        color="warning"
        variant="subtle"
        icon="i-lucide-cloud-off"
        title="Prüfen hat nicht geklappt"
        :description="`${info.error} Ohne Internet (nur eigenes WLAN) lässt sich nicht prüfen, ob es eine neue Version gibt.`"
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
          :loading="switchingAuto"
          :disabled="switchingAuto || !info"
          data-testid="update-auto-minecraft"
          @update:modelValue="setAutoMinecraft"
        />
      </div>
      <p class="text-sm text-muted">
        Jede Stunde wird geprüft. Ein neues Minecraft wird nur installiert, wenn gerade niemand spielt.
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
    </SystemCard>
  </div>
</template>
