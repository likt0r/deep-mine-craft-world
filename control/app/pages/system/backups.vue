<script setup lang="ts">
useSeoMeta({ title: "Backups · Deep Mine Control" });

const { locked, status } = useServerStatus();
const feedback = useFeedback();
const { data: info, refresh } = useFetch<BackupsInfo>("/api/backups", { key: "backups" });
useWhileVisible(refresh, 10_000, { immediate: false });

const activeWorld = computed(() => info.value?.worlds.find((w) => w.active) ?? null);

const backingUp = ref(false);
async function backupNow() {
  backingUp.value = true;
  try {
    await $fetch("/api/backups", { method: "POST" });
    feedback.done(`${activeWorld.value?.name ?? "Welt"} gesichert.`);
    await refresh();
  } catch {
    feedback.failed();
  } finally {
    backingUp.value = false;
  }
}

const switchingWorldEnd = ref(false);
async function setWorldEnd(enabled: boolean) {
  switchingWorldEnd.value = true;
  try {
    await $fetch("/api/backups/on-world-end", { method: "PUT", body: { enabled } });
    feedback.done(
      enabled
        ? "Beim Beenden einer Welt wird gesichert."
        : "Beim Beenden einer Welt wird nicht mehr gesichert."
    );
    await refresh();
  } catch {
    feedback.failed();
  } finally {
    switchingWorldEnd.value = false;
  }
}

const switchingAuto = ref(false);
async function setAuto(enabled: boolean) {
  switchingAuto.value = true;
  try {
    await $fetch("/api/backups/auto", { method: "PUT", body: { enabled } });
    feedback.done(enabled ? "Vor jedem Start wird gesichert." : "Kein Backup mehr vor jedem Start.");
    await refresh();
  } catch {
    feedback.failed();
  } finally {
    switchingAuto.value = false;
  }
}

/** Backup, das gerade zurückgespielt werden soll (Menü von unten). */
const selected = ref<{ world: WorldBackups; backup: BackupFile } | null>(null);
const sheetOpen = computed({
  get: () => selected.value !== null,
  set: (value: boolean) => {
    if (!value) selected.value = null;
  }
});

async function restore() {
  const current = selected.value;
  if (!current) return;
  selected.value = null;
  try {
    const res = await $fetch<{ restart: boolean }>("/api/backups/restore", {
      method: "POST",
      body: { file: current.backup.file }
    });
    feedback.done(
      res.restart
        ? `${current.world.name} wird zurückgespielt, Minecraft startet neu …`
        : `${current.world.name} zurückgespielt.`
    );
    await refresh();
  } catch {
    feedback.failed();
  }
}

const downloadUrl = (file: string) => `/api/backups/download/${encodeURIComponent(file)}`;
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <SystemCard title="Wo die Backups liegen" icon="i-lucide-folder-archive" data-testid="backups-where">
      <p class="font-mono text-sm break-all text-highlighted" data-testid="backups-dir">{{ info?.dir }}</p>
      <ul class="flex list-disc flex-col gap-1.5 ps-5 text-sm text-toned">
        <li>Für jede Welt bleiben die letzten 3 Backups, ältere löscht BSM.</li>
        <li>
          Die Dateien sind <strong>.mcworld</strong>: Heruntergeladen lassen sie sich auf einem Tablet oder PC
          mit Minecraft öffnen und als eigene Welt importieren.
        </li>
        <li>
          Zurückspielen geht hier mit 3 Sekunden Halten. Von Hand: in BSM unter Backups → Wiederherstellen.
          Achtung, BSM spielt immer in die gerade <strong>aktive</strong> Welt zurück.
        </li>
      </ul>
    </SystemCard>

    <SystemCard title="Automatisch sichern" icon="i-lucide-clock" data-testid="backups-auto">
      <div class="flex items-center gap-3">
        <span id="world-end-label" class="flex-1 font-semibold">Sichern, wenn eine Welt beendet wird</span>
        <USwitch
          size="xl"
          aria-labelledby="world-end-label"
          :modelValue="info?.onWorldEnd ?? true"
          :loading="switchingWorldEnd"
          :disabled="switchingWorldEnd || !info"
          data-testid="backups-world-end-switch"
          @update:modelValue="setWorldEnd"
        />
      </div>
      <p class="text-sm text-muted">
        Beim Wechsel zu einer anderen Welt, beim Stoppen von Minecraft und bevor der Rechner herunterfährt
        oder neu startet – auch über den Einschaltknopf. Gesichert wird die Welt, die gerade endet. Bei einem
        Stromausfall geht das natürlich nicht.
      </p>
      <div class="flex items-center gap-3 border-t border-default pt-3">
        <span id="auto-label" class="flex-1 font-semibold">Vor jedem Start sichern</span>
        <USwitch
          size="xl"
          aria-labelledby="auto-label"
          :modelValue="info?.autoBackup ?? false"
          :loading="switchingAuto"
          :disabled="switchingAuto || info?.autoBackup === null"
          data-testid="backups-auto-switch"
          @update:modelValue="setAuto"
        />
      </div>
      <p class="text-sm text-muted">
        Jedes Mal, bevor Minecraft startet (auch beim Laden einer Welt), sichert BSM die Welt, die gleich
        startet.
      </p>
      <p v-if="info?.autoBackup === null" class="text-sm text-warning" data-testid="backups-auto-unknown">
        Dafür braucht das BSM-Konto deep-mine-control Admin-Rechte (richtet das Paket ein).
      </p>
      <UButton
        icon="i-lucide-save"
        size="xl"
        class="block-btn self-start font-pixel"
        :loading="backingUp"
        :disabled="locked || backingUp || status?.state !== 'running'"
        data-testid="backup-now"
        @click="backupNow"
      >
        {{ activeWorld ? `${activeWorld.name} jetzt sichern` : "Jetzt sichern" }}
      </UButton>
    </SystemCard>

    <SystemCard
      v-for="world in info?.worlds"
      :key="world.folder"
      :title="world.place ? `Platz ${world.place} · ${world.name}` : `${world.name} (auf keinem Platz mehr)`"
      icon="i-lucide-box"
      :data-testid="`backups-world-${world.folder}`"
    >
      <UBadge v-if="world.active" class="self-start rounded-full font-bold">Aktiv</UBadge>
      <p v-if="world.backups.length === 0" class="text-muted">Noch kein Backup.</p>
      <ul v-else class="flex flex-col divide-y divide-default">
        <li
          v-for="backup in world.backups"
          :key="backup.file"
          class="flex items-center gap-2 py-2"
          data-testid="backup-row"
          :data-file="backup.file"
        >
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="font-semibold">{{ formatWhen(backup.createdAt) }}</span>
            <span class="text-sm text-muted">{{ formatSize(backup.sizeBytes) }}</span>
          </span>
          <UButton
            :href="downloadUrl(backup.file)"
            download
            icon="i-lucide-download"
            color="neutral"
            variant="ghost"
            size="lg"
            :aria-label="`Backup vom ${formatWhen(backup.createdAt)} herunterladen`"
            data-testid="backup-download"
          />
          <UButton
            v-if="world.place"
            icon="i-lucide-history"
            color="neutral"
            variant="subtle"
            size="lg"
            class="block-btn"
            :disabled="locked"
            data-testid="backup-restore"
            @click="selected = { world, backup }"
          >
            Zurückspielen
          </UButton>
        </li>
      </ul>
    </SystemCard>

    <UDrawer
      v-model:open="sheetOpen"
      handleOnly
      title="Backup zurückspielen"
      :ui="{
        content: 'bg-muted',
        container: 'mx-auto w-full max-w-lg pb-[calc(1rem+env(safe-area-inset-bottom))]'
      }"
    >
      <template #body>
        <div v-if="selected" class="flex flex-col gap-3" data-testid="backup-sheet">
          <p>
            <strong>{{ selected.world.name }}</strong> auf den Stand vom
            <strong>{{ formatWhen(selected.backup.createdAt) }}</strong> zurücksetzen?
          </p>
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :description="
              selected.world.active
                ? `Minecraft startet neu, alle werden kurz getrennt. Was seitdem in ${selected.world.name} gebaut wurde, geht verloren.`
                : `Was seitdem in ${selected.world.name} gebaut wurde, geht verloren.`
            "
          />
          <HoldButton
            label="Zurückspielen"
            icon="i-lucide-history"
            color="warning"
            data-testid="backup-restore-confirm"
            @confirm="restore"
          />
          <p class="text-center text-sm text-muted">3 Sekunden gedrückt halten.</p>
        </div>
      </template>
    </UDrawer>
  </div>
</template>
