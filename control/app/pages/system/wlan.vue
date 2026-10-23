<script setup lang="ts">
useSeoMeta({ title: "WLAN · Deep Mine Control" });

const { locked, refresh: refreshStatus } = useServerStatus();
const feedback = useFeedback();

const { data: wifi, error, refresh } = useFetch<WifiInfo>("/api/wifi", { key: "wifi" });
const { data: offline, refresh: refreshOffline } = useFetch<{ offline: boolean }>("/api/offline", {
  key: "offline"
});

// Die WLAN-Werte laden alle 5 s neu, solange die Seite offen und sichtbar ist.
useWhileVisible(refresh, 5000, { immediate: false });

/** Nach einer Änderung kurz warten, dann neu lesen: NetworkManager braucht einen Moment. */
function changed() {
  void refresh();
  setTimeout(refresh, 3000);
}

const switchingOffline = ref(false);

async function setOffline(value: boolean) {
  switchingOffline.value = true;
  try {
    await $fetch("/api/offline", { method: "PUT", body: { offline: value } });
    feedback.done(
      value ? "Offline-Modus an. Minecraft startet neu …" : "Offline-Modus aus. Minecraft startet neu …"
    );
    await Promise.all([refreshOffline(), refreshStatus()]);
  } catch {
    feedback.failed();
  } finally {
    switchingOffline.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <UAlert
      v-if="error && !wifi"
      color="error"
      variant="subtle"
      icon="i-lucide-wifi-off"
      title="WLAN-Verwaltung antwortet nicht"
      description="NetworkManager läuft auf dem Server nicht oder ist nicht eingerichtet (install.sh)."
      data-testid="wifi-error"
    />

    <template v-if="wifi">
      <section
        aria-label="WLAN-Status"
        data-testid="wifi-status"
        class="flex items-center gap-3.5 rounded-xl border p-3.5"
        :class="wifi.mode === 'off' ? 'border-default bg-muted' : 'border-success/45 bg-success/10'"
      >
        <span
          aria-hidden="true"
          class="flex size-12 shrink-0 items-center justify-center rounded-lg shadow-[inset_0_-4px_0_rgb(0_0_0/0.3)]"
          :class="wifi.mode === 'off' ? 'bg-elevated text-muted' : 'bg-success text-inverted'"
        >
          <UIcon
            :name="
              wifi.mode === 'ap'
                ? 'i-lucide-router'
                : wifi.mode === 'client'
                  ? signalIcon(wifi.client?.signal ?? null)
                  : 'i-lucide-wifi-off'
            "
            class="size-6.5"
          />
        </span>
        <div class="flex min-w-0 flex-col gap-0.5">
          <strong class="font-pixel text-xl" :class="wifi.mode === 'off' ? 'text-toned' : 'text-success'">
            <template v-if="wifi.mode === 'client'">Verbunden mit {{ wifi.client?.ssid }}</template>
            <template v-else-if="wifi.mode === 'ap'">Eigenes WLAN „{{ wifi.ap.ssid }}“ ist an</template>
            <template v-else>WLAN ist aus</template>
          </strong>
          <span class="text-sm text-toned">
            <template v-if="wifi.mode === 'client'">
              Signal {{ wifi.client?.signal ?? "?" }} %<template v-if="wifi.client?.ip">
                · {{ wifi.client.ip }}</template
              >
            </template>
            <template v-else-if="wifi.mode === 'ap'">
              {{ wifi.ap.devices ?? "?" }} {{ wifi.ap.devices === 1 ? "Gerät" : "Geräte" }} verbunden<template
                v-if="wifi.ap.ip"
              >
                · Server unter {{ wifi.ap.ip }}</template
              >
            </template>
            <template v-else>Weder mit einem WLAN verbunden noch eigenes WLAN an.</template>
          </span>
        </div>
      </section>

      <WifiApCard :ap="wifi.ap" :mode="wifi.mode" @changed="changed" />
      <WifiNetworks :wifi="wifi" @changed="changed" />
    </template>

    <SystemCard title="Ohne Internet spielen" icon="i-lucide-plane" data-testid="wifi-offline">
      <div class="flex items-center gap-3">
        <span id="offline-label" class="flex-1 font-semibold">Offline-Modus</span>
        <USwitch
          size="xl"
          aria-labelledby="offline-label"
          :modelValue="offline?.offline ?? false"
          :loading="switchingOffline"
          :disabled="locked || switchingOffline || !offline"
          data-testid="wifi-offline-switch"
          @update:modelValue="(value: boolean) => setOffline(value)"
        />
      </div>
      <p class="text-sm text-muted">
        Normal muss sich jeder Spieler bei Xbox Live anmelden, dafür braucht es Internet. Im Offline-Modus
        fällt das weg. Ob Konsolen ganz ohne Internet beitreten können, hängt vom Gerät ab. Umschalten startet
        Minecraft neu, alle werden kurz getrennt.
      </p>
    </SystemCard>
  </div>
</template>
