<script setup lang="ts">
useSeoMeta({ title: "System · Deep Mine Control" });

const { status, connection, locked, refresh: refreshStatus } = useServerStatus();
const feedback = useFeedback();

const { data: system, refresh } = useFetch<SystemInfo>("/api/system", { key: "system" });

// Die Werte laden alle 5 s neu, solange der Bereich offen und sichtbar ist.
useWhileVisible(refresh, 5000, { immediate: false });

const UNKNOWN = "unbekannt";

/** Einstufung der CPU-Temperatur: bis 69 °C gut, bis 79 °C warm, ab 80 °C heiß. */
const temp = computed(() => {
  const value = system.value?.cpu.tempC;
  if (value == null) return null;
  if (value >= 80) return { value, word: "Heiß", color: "error" as const };
  if (value >= 70) return { value, word: "Warm", color: "warning" as const };
  return { value, word: "Gut", color: "success" as const };
});

const memory = computed(() => {
  const m = system.value?.memory;
  if (!m) return null;
  const used = m.totalBytes - m.availableBytes;
  return { used, total: m.totalBytes, percent: Math.round((used / m.totalBytes) * 100) };
});

const disk = computed(() => {
  const d = system.value?.disk;
  if (!d) return null;
  const percent = Math.round(((d.totalBytes - d.availableBytes) / d.totalBytes) * 100);
  return { free: d.availableBytes, total: d.totalBytes, percent };
});

/** Gründe für „Achtung“. Leer heißt: alles in Ordnung. */
const problems = computed(() => {
  const list: string[] = [];
  if (temp.value && temp.value.value >= 80) list.push("Der Prozessor ist sehr warm.");
  if (disk.value && disk.value.percent > 90) list.push("Die Platte ist fast voll.");
  if (system.value?.ssd && !system.value.ssd.healthy) list.push("Die SSD meldet Probleme.");
  if (status.value && status.value.state !== "running") list.push("Minecraft läuft gerade nicht.");
  return list;
});

/** Rechner neu starten oder ausschalten geht auch, wenn Minecraft aus ist, nur nicht ohne Verbindung oder mitten im Weltwechsel. */
const powerLocked = computed(() => connection.value !== "ok" || !!status.value?.busy);

/** Schickt eine der Aktionen und meldet sie als Toast. */
async function act(path: string, message: string) {
  try {
    await $fetch(path, { method: "POST" });
    feedback.done(message);
    await refreshStatus();
  } catch {
    feedback.failed();
  }
}
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <UpdateHints />
    <p class="text-muted">Wie es dem Rechner geht. Die Werte aktualisieren sich von selbst.</p>

    <section
      aria-label="Gesamtzustand"
      data-testid="system-overall"
      class="flex items-center gap-3.5 rounded-xl border p-3.5"
      :class="problems.length ? 'border-warning/45 bg-warning/10' : 'border-success/45 bg-success/10'"
    >
      <span
        aria-hidden="true"
        class="flex size-12 shrink-0 items-center justify-center rounded-lg text-inverted shadow-[inset_0_-4px_0_rgb(0_0_0/0.3)]"
        :class="problems.length ? 'bg-warning' : 'bg-success'"
      >
        <UIcon
          :name="problems.length ? 'i-lucide-triangle-alert' : 'i-lucide-shield-check'"
          class="size-6.5"
        />
      </span>
      <div class="flex flex-col gap-0.5">
        <strong class="font-pixel text-xl" :class="problems.length ? 'text-warning' : 'text-success'">
          {{ problems.length ? "Achtung" : "Alles in Ordnung" }}
        </strong>
        <span v-if="!problems.length" class="text-sm text-toned"
          >Rechner und Minecraft-Server laufen normal.</span
        >
        <span v-for="problem in problems" :key="problem" class="text-sm text-toned">{{ problem }}</span>
      </div>
    </section>

    <div class="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
      <SystemCard title="Prozessor" icon="i-lucide-cpu">
        <div class="flex items-baseline justify-between gap-1.5">
          <span class="font-pixel text-3xl font-bold text-highlighted" data-testid="system-cpu-temp">
            {{ temp ? `${temp.value} °C` : UNKNOWN }}
          </span>
          <UBadge v-if="temp" :color="temp.color" variant="subtle" class="font-bold">{{ temp.word }}</UBadge>
        </div>
        <UProgress v-if="temp" :modelValue="Math.min(temp.value, 100)" :color="temp.color" size="lg" />
        <span class="text-sm text-muted" data-testid="system-cpu-load">
          Auslastung {{ system?.cpu.loadPercent != null ? `${system.cpu.loadPercent} %` : UNKNOWN }}
        </span>
      </SystemCard>

      <SystemCard title="Arbeitsspeicher" icon="i-lucide-memory-stick">
        <template v-if="memory">
          <div class="flex flex-wrap items-baseline gap-1.5" data-testid="system-memory">
            <span class="font-pixel text-3xl font-bold text-highlighted">{{ formatGb(memory.used) }}</span>
            <span class="text-sm text-muted">von {{ formatGb(memory.total) }}</span>
          </div>
          <UProgress
            :modelValue="memory.percent"
            :color="memory.percent > 90 ? 'warning' : 'success'"
            size="lg"
          />
          <span class="text-sm text-muted">{{ memory.percent }} % belegt</span>
        </template>
        <span v-else class="font-pixel text-3xl font-bold text-highlighted" data-testid="system-memory">
          {{ UNKNOWN }}
        </span>
      </SystemCard>

      <SystemCard title="Festplatte" icon="i-lucide-hard-drive" class="col-span-2 lg:col-span-1">
        <template v-if="disk">
          <div class="flex flex-wrap items-baseline gap-1.5" data-testid="system-disk">
            <span class="font-pixel text-3xl font-bold text-highlighted">{{ formatGb(disk.free) }}</span>
            <span class="text-sm text-muted">frei von {{ formatGb(disk.total) }}</span>
          </div>
          <UProgress :modelValue="disk.percent" :color="disk.percent > 90 ? 'error' : 'success'" size="lg" />
        </template>
        <span v-else class="font-pixel text-3xl font-bold text-highlighted" data-testid="system-disk">
          {{ UNKNOWN }}
        </span>
        <div
          class="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-default pt-2"
          data-testid="system-ssd"
        >
          <span class="flex-1 font-semibold whitespace-nowrap">SSD-Zustand</span>
          <template v-if="system?.ssd">
            <UBadge :color="system.ssd.healthy ? 'success' : 'error'" variant="subtle" class="font-bold">
              {{ system.ssd.healthy ? "Gesund" : "Probleme" }}
            </UBadge>
            <span v-if="system.ssd.wearPercent != null" class="text-sm text-muted">
              Verschleiß {{ system.ssd.wearPercent }} %
            </span>
          </template>
          <span v-else class="text-sm text-muted">{{ UNKNOWN }}</span>
        </div>
      </SystemCard>
    </div>

    <section aria-label="Laufzeit und Minecraft" class="rounded-xl border border-default bg-muted px-3.5">
      <dl
        class="grid grid-cols-[1fr_auto] text-[15px] [&>*]:border-b [&>*]:border-default [&>*]:py-2.5 [&>*:nth-last-child(-n+2)]:border-b-0"
      >
        <dt class="text-muted">Rechner läuft seit</dt>
        <dd class="text-right font-semibold" data-testid="system-uptime">
          {{ system?.uptime.systemSeconds != null ? formatDuration(system.uptime.systemSeconds) : UNKNOWN }}
        </dd>
        <dt class="text-muted">Minecraft läuft seit</dt>
        <dd class="text-right font-semibold" data-testid="system-minecraft-uptime">
          {{
            system?.uptime.minecraftSeconds != null
              ? formatDuration(system.uptime.minecraftSeconds)
              : status?.state === "running"
                ? UNKNOWN
                : "läuft nicht"
          }}
        </dd>
        <dt class="text-muted">Bedrock-Version</dt>
        <dd class="text-right font-semibold" data-testid="system-version">
          {{ system?.minecraft.version ?? UNKNOWN }}
        </dd>
        <dt class="text-muted">Letzte Sicherung</dt>
        <dd class="text-right font-semibold" data-testid="system-backup">
          {{ system?.lastBackup ? formatWhen(system.lastBackup) : "keine" }}
        </dd>
      </dl>
    </section>

    <div class="grid gap-2.5 sm:grid-cols-2">
      <SystemCard title="Minecraft" icon="i-lucide-box">
        <HoldButton
          label="Minecraft neu starten"
          icon="i-lucide-rotate-ccw"
          color="warning"
          data-testid="system-restart"
          :disabled="locked"
          @confirm="act('/api/restart', 'Minecraft startet neu …')"
        />
        <HoldButton
          label="Minecraft stoppen"
          icon="i-lucide-square"
          color="error"
          data-testid="system-stop"
          :disabled="locked"
          @confirm="act('/api/stop', 'Minecraft wird gestoppt …')"
        />
        <span class="text-sm text-muted">
          3 Sekunden gedrückt halten. Alle Spieler werden getrennt. Gestoppt kommt Minecraft mit „Server
          starten“ wieder.
        </span>
      </SystemCard>

      <SystemCard title="Rechner" icon="i-lucide-monitor">
        <HoldButton
          label="Rechner neu starten"
          icon="i-lucide-refresh-cw"
          color="warning"
          data-testid="system-reboot"
          :disabled="powerLocked"
          @confirm="
            act('/api/system/reboot', 'Rechner startet neu. In etwa einer Minute ist alles wieder da.')
          "
        />
        <HoldButton
          label="Rechner ausschalten"
          icon="i-lucide-power"
          color="error"
          data-testid="system-poweroff"
          :disabled="powerLocked"
          @confirm="act('/api/system/poweroff', 'Rechner wird ausgeschaltet. Einschalten nur am Gerät.')"
        />
        <span class="text-sm text-muted">
          3 Sekunden gedrückt halten. Ausgeschaltet geht der Rechner nur am Einschaltknopf wieder an.
        </span>
      </SystemCard>
    </div>
  </div>
</template>
