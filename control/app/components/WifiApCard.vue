<script setup lang="ts">
import { renderSVG } from "uqr";

/** Das eigene WLAN des Servers: Name, Passwort und QR-Code zum Weitergeben, Ändern im Menü von unten. */
const props = defineProps<{ ap: WifiInfo["ap"]; mode: WifiInfo["mode"] }>();
const emit = defineEmits<{ changed: [] }>();

const feedback = useFeedback();

const revealed = ref(false);
const qr = computed(() => renderSVG(wifiQrText(props.ap.ssid, props.ap.password), { border: 2 }));

const editing = ref(false);
const ssid = ref("");
const password = ref("");
const saving = ref(false);
const valid = computed(() => isValidSsid(ssid.value) && isValidWifiPassword(password.value));

function startEdit() {
  ssid.value = props.ap.ssid;
  password.value = props.ap.password;
  editing.value = true;
}

async function save() {
  saving.value = true;
  try {
    await $fetch("/api/wifi/ap", { method: "PUT", body: { ssid: ssid.value, password: password.value } });
    editing.value = false;
    feedback.done("Eigenes WLAN geändert.");
    emit("changed");
  } catch {
    feedback.failed();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <SystemCard title="Eigenes WLAN" icon="i-lucide-router" data-testid="wifi-ap">
    <p class="text-sm text-muted">
      Ist kein hinterlegtes WLAN in Reichweite, macht der Server dieses WLAN auf. Hängt ein Kabel am Router,
      gibt er darüber das Internet weiter.
    </p>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
      <dl class="grid flex-1 grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
        <dt class="text-sm text-muted">Name</dt>
        <dd class="font-pixel text-xl font-bold text-highlighted" data-testid="wifi-ap-ssid">
          {{ ap.ssid }}
        </dd>
        <dt class="text-sm text-muted">Passwort</dt>
        <dd class="flex items-center gap-2">
          <span class="font-mono text-lg font-semibold" data-testid="wifi-ap-password">
            {{ revealed ? ap.password : "••••••••••" }}
          </span>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :icon="revealed ? 'i-lucide-eye-off' : 'i-lucide-eye'"
            :aria-label="revealed ? 'Passwort verbergen' : 'Passwort zeigen'"
            data-testid="wifi-ap-reveal"
            @click="revealed = !revealed"
          />
        </dd>
        <dt class="text-sm text-muted">Status</dt>
        <dd class="text-sm font-semibold" :class="ap.active ? 'text-success' : 'text-muted'">
          {{ ap.active ? `an · ${ap.devices ?? "?"} ${ap.devices === 1 ? "Gerät" : "Geräte"}` : "aus" }}
        </dd>
      </dl>
      <!-- Der QR-Code enthält das Passwort, deshalb nur aufgedeckt. -->
      <!-- eslint-disable vue/no-v-html -- das SVG erzeugt uqr hier aus dem eigenen WLAN-Namen -->
      <div
        v-if="revealed"
        class="size-40 shrink-0 self-center rounded-lg bg-white p-1.5 [&>svg]:size-full"
        role="img"
        :aria-label="`QR-Code zum Verbinden mit ${ap.ssid}`"
        data-testid="wifi-ap-qr"
        v-html="qr"
      />
      <!-- eslint-enable vue/no-v-html -->
    </div>
    <UButton
      icon="i-lucide-pencil"
      color="neutral"
      variant="subtle"
      size="lg"
      class="block-btn self-start"
      data-testid="wifi-ap-edit"
      @click="startEdit"
    >
      Ändern
    </UButton>

    <UDrawer
      v-model:open="editing"
      handleOnly
      title="Eigenes WLAN ändern"
      :ui="{
        content: 'bg-muted',
        container: 'mx-auto w-full max-w-lg pb-[calc(1rem+env(safe-area-inset-bottom))]'
      }"
    >
      <template #body>
        <form class="flex flex-col gap-3" data-testid="wifi-ap-form" @submit.prevent="save">
          <UFormField
            label="Name (SSID)"
            size="xl"
            :error="ssid && !isValidSsid(ssid) ? 'Höchstens 32 Zeichen' : false"
          >
            <UInput v-model="ssid" size="xl" class="w-full" data-testid="wifi-ap-ssid-input" />
          </UFormField>
          <UFormField
            label="Passwort"
            size="xl"
            :error="password && !isValidWifiPassword(password) ? '8 bis 63 Zeichen' : false"
          >
            <UInput v-model="password" size="xl" class="w-full" data-testid="wifi-ap-password-input" />
          </UFormField>
          <UAlert
            v-if="mode === 'ap'"
            color="warning"
            variant="subtle"
            icon="i-lucide-wifi-off"
            description="Das eigene WLAN startet neu. Wer verbunden ist, muss sich danach mit dem neuen Namen und Passwort verbinden."
          />
          <UButton
            type="submit"
            size="xl"
            block
            class="block-btn font-pixel"
            :loading="saving"
            :disabled="!valid || saving"
            data-testid="wifi-ap-save"
          >
            Speichern
          </UButton>
        </form>
      </template>
    </UDrawer>
  </SystemCard>
</template>
