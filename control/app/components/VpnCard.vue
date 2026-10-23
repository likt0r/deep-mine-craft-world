<script setup lang="ts">
/** VPN (WireGuard): Konfiguration hochladen, verbinden, beim Start verbinden, entfernen. */
const feedback = useFeedback();
const { data: vpn, error, refresh } = useFetch<VpnInfo>("/api/network/vpn", { key: "vpn" });
useWhileVisible(refresh, 5000, { immediate: false });

/** Nach Verbinden/Trennen braucht NetworkManager einen Moment. */
function changed() {
  void refresh();
  setTimeout(refresh, 2500);
}

const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

async function upload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    await $fetch("/api/network/vpn", {
      method: "PUT",
      body: { config: await file.text(), autoconnect: vpn.value?.configured ? vpn.value.autoconnect : true }
    });
    feedback.done("VPN eingerichtet, verbinde …");
    changed();
  } catch (failure) {
    // Die API sagt, was an der Datei nicht stimmt.
    const message = (failure as { data?: { message?: string } }).data?.message;
    feedback.failed(message ? `Datei nicht übernommen: ${message}` : undefined);
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = "";
  }
}

async function connect(active: boolean) {
  try {
    await $fetch("/api/network/vpn/connect", { method: "POST", body: { active } });
    feedback.done(active ? "VPN verbindet …" : "VPN getrennt.");
    changed();
  } catch {
    feedback.failed();
  }
}

async function setAutoconnect(enabled: boolean) {
  try {
    await $fetch("/api/network/vpn/autoconnect", { method: "PUT", body: { enabled } });
    await refresh();
  } catch {
    feedback.failed();
  }
}

async function remove() {
  try {
    await $fetch("/api/network/vpn", { method: "DELETE" });
    feedback.done("VPN entfernt.");
    await refresh();
  } catch {
    feedback.failed();
  }
}
</script>

<template>
  <SystemCard title="VPN (WireGuard)" icon="i-lucide-shield" data-testid="vpn">
    <p v-if="error && !vpn" class="text-sm text-error">NetworkManager antwortet nicht.</p>

    <template v-else-if="vpn?.configured">
      <div class="flex items-center gap-3">
        <span id="vpn-active-label" class="flex-1 font-semibold">
          Verbunden
          <UBadge
            :color="vpn.active ? 'success' : 'neutral'"
            variant="subtle"
            class="ms-1"
            data-testid="vpn-state"
          >
            {{ vpn.active ? "an" : "aus" }}
          </UBadge>
        </span>
        <USwitch
          size="xl"
          aria-labelledby="vpn-active-label"
          :modelValue="vpn.active"
          data-testid="vpn-active-switch"
          @update:modelValue="connect"
        />
      </div>
      <div class="flex items-center gap-3">
        <span id="vpn-auto-label" class="flex-1 font-semibold">Beim Start verbinden</span>
        <USwitch
          size="xl"
          aria-labelledby="vpn-auto-label"
          :modelValue="vpn.autoconnect"
          data-testid="vpn-autoconnect-switch"
          @update:modelValue="setAutoconnect"
        />
      </div>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px]" data-testid="vpn-details">
        <dt class="text-muted">VPN-Adresse</dt>
        <dd class="font-mono">{{ vpn.address.join(", ") || "–" }}</dd>
        <dt class="text-muted">Gegenstelle</dt>
        <dd class="font-mono break-all">{{ vpn.endpoints.join(", ") || "–" }}</dd>
        <dt class="text-muted">DNS</dt>
        <dd class="font-mono">{{ vpn.dns.join(", ") || "–" }}</dd>
      </dl>
      <UAlert
        v-if="vpn.fullTunnel"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Aller Verkehr läuft durchs VPN"
        description="Fällt das VPN aus, hat der Server kein Internet, und die Xbox-Anmeldung der Spieler scheitert. Das Heimnetz (Tablets, Konsolen) bleibt erreichbar."
        data-testid="vpn-full-tunnel"
      />
    </template>

    <p v-else class="text-muted" data-testid="vpn-empty">
      Noch kein VPN. Lade die WireGuard-Konfiguration (.conf) von deinem VPN-Anbieter oder Router hoch.
    </p>

    <input
      ref="fileInput"
      type="file"
      accept=".conf,text/plain"
      class="hidden"
      data-testid="vpn-file"
      @change="upload"
    />
    <UButton
      icon="i-lucide-upload"
      color="neutral"
      variant="subtle"
      size="lg"
      class="block-btn self-start"
      :loading="uploading"
      data-testid="vpn-upload"
      @click="fileInput?.click()"
    >
      {{ vpn?.configured ? "Andere Konfiguration hochladen" : "Konfiguration hochladen" }}
    </UButton>
    <p class="text-sm text-muted">
      Der private Schlüssel bleibt auf dem Server bei NetworkManager und wird hier nie wieder angezeigt.
    </p>

    <template v-if="vpn?.configured">
      <HoldButton label="VPN entfernen" icon="i-lucide-trash-2" data-testid="vpn-remove" @confirm="remove" />
      <p class="text-center text-sm text-muted">Zum Entfernen 3 Sekunden gedrückt halten.</p>
    </template>
  </SystemCard>
</template>
