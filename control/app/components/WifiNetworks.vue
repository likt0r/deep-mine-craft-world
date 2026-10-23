<script setup lang="ts">
/** Hinterlegte und sichtbare WLANs. Ein Tipp öffnet das Menü von unten (Verbinden, Entfernen, Hinzufügen). */
const props = defineProps<{ wifi: WifiInfo }>();
const emit = defineEmits<{ changed: [] }>();

const feedback = useFeedback();

type Sheet =
  | { kind: "saved"; id: number }
  /** `manual`: Name selbst eintippen (WLAN gerade nicht sichtbar oder versteckt) */
  | { kind: "add"; ssid: string; secured: boolean; manual: boolean };
const sheet = ref<Sheet | null>(null);
const open = computed({
  get: () => sheet.value !== null,
  set: (value: boolean) => {
    if (!value) sheet.value = null;
  }
});

const savedEntry = computed(() => {
  const current = sheet.value;
  return current?.kind === "saved" ? (props.wifi.saved.find((s) => s.id === current.id) ?? null) : null;
});

const ssid = ref("");
const password = ref("");
const sending = ref(false);

function openAdd(network: { ssid: string; secured: boolean } | null) {
  ssid.value = network?.ssid ?? "";
  password.value = "";
  sheet.value = { kind: "add", ssid: ssid.value, secured: network?.secured ?? true, manual: !network };
}

const addValid = computed(() => {
  if (sheet.value?.kind !== "add") return false;
  const needsPassword = sheet.value.secured;
  return (
    isValidSsid(ssid.value) && (needsPassword ? isValidWifiPassword(password.value) : password.value === "")
  );
});

async function add() {
  sending.value = true;
  try {
    await $fetch("/api/wifi/networks", {
      method: "POST",
      body: { ssid: ssid.value, password: password.value }
    });
    sheet.value = null;
    feedback.done(`${ssid.value} hinterlegt. Der Server verbindet sich …`);
    emit("changed");
  } catch {
    feedback.failed();
  } finally {
    sending.value = false;
  }
}

async function connect(id: number, name: string) {
  try {
    await $fetch(`/api/wifi/networks/${id}/connect`, { method: "POST" });
    sheet.value = null;
    feedback.done(`Verbinde mit ${name} …`);
    emit("changed");
  } catch {
    feedback.failed();
  }
}

async function remove(id: number, name: string) {
  try {
    await $fetch(`/api/wifi/networks/${id}`, { method: "DELETE" });
    sheet.value = null;
    feedback.done(`${name} entfernt.`);
    emit("changed");
  } catch {
    feedback.failed();
  }
}
</script>

<template>
  <SystemCard title="Hinterlegte WLANs" icon="i-lucide-bookmark" data-testid="wifi-saved">
    <p v-if="wifi.saved.length === 0" class="text-muted">
      Noch keine. Mit hinterlegten WLANs verbindet sich der Server von selbst, sobald sie in Reichweite sind.
    </p>
    <ul v-else class="flex flex-col gap-2">
      <li v-for="entry in wifi.saved" :key="entry.id" :data-testid="`wifi-saved-${entry.id}`">
        <button
          type="button"
          class="flex min-h-14 w-full items-center gap-3 rounded-lg border-2 px-3 py-2 text-left"
          :class="entry.active ? 'border-primary bg-primary/10' : 'border-default bg-elevated/50'"
          @click="sheet = { kind: 'saved', id: entry.id }"
        >
          <UIcon
            name="i-lucide-wifi"
            class="size-5 shrink-0"
            :class="entry.active ? 'text-primary' : 'text-muted'"
          />
          <span class="min-w-0 flex-1 truncate font-semibold">{{ entry.ssid }}</span>
          <UBadge v-if="entry.active" class="rounded-full font-bold">Verbunden</UBadge>
          <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-dimmed" />
        </button>
      </li>
    </ul>
  </SystemCard>

  <SystemCard title="WLANs in der Nähe" icon="i-lucide-radar" data-testid="wifi-available">
    <p v-if="wifi.availableStale" class="text-sm text-muted">
      Solange das eigene WLAN an ist, kann der Server nicht suchen. Das ist der zuletzt gesehene Stand.
    </p>
    <p v-if="wifi.available.length === 0" class="text-muted">Keine WLANs gefunden.</p>
    <ul v-else class="flex flex-col gap-1">
      <li
        v-for="network in wifi.available"
        :key="network.ssid"
        data-testid="wifi-available-network"
        :data-ssid="network.ssid"
      >
        <button
          type="button"
          class="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-elevated disabled:cursor-default disabled:hover:bg-transparent"
          :disabled="network.saved"
          @click="openAdd(network)"
        >
          <UIcon :name="signalIcon(network.signal)" class="size-5 shrink-0 text-muted" />
          <span class="min-w-0 flex-1 truncate">{{ network.ssid }}</span>
          <UIcon
            v-if="network.secured"
            name="i-lucide-lock"
            class="size-4 shrink-0 text-dimmed"
            aria-label="mit Passwort"
          />
          <UBadge v-if="network.saved" color="neutral" variant="soft">hinterlegt</UBadge>
          <UIcon v-else name="i-lucide-plus" class="size-5 shrink-0 text-primary" />
        </button>
      </li>
    </ul>
    <UButton
      icon="i-lucide-plus"
      color="neutral"
      variant="subtle"
      size="lg"
      class="block-btn self-start"
      data-testid="wifi-add-manual"
      @click="openAdd(null)"
    >
      WLAN von Hand hinzufügen
    </UButton>
  </SystemCard>

  <UDrawer
    v-model:open="open"
    handleOnly
    :title="sheet?.kind === 'saved' ? (savedEntry?.ssid ?? '') : 'WLAN hinzufügen'"
    :ui="{
      content: 'bg-muted',
      container: 'mx-auto w-full max-w-lg pb-[calc(1rem+env(safe-area-inset-bottom))]'
    }"
  >
    <template #body>
      <div class="flex flex-col gap-3" data-testid="wifi-sheet">
        <UAlert
          v-if="wifi.mode === 'ap'"
          color="warning"
          variant="subtle"
          icon="i-lucide-wifi-off"
          description="Bist du gerade über das eigene WLAN des Servers verbunden, bist du gleich kurz getrennt."
        />

        <template v-if="sheet?.kind === 'saved' && savedEntry">
          <UButton
            v-if="!savedEntry.active"
            icon="i-lucide-wifi"
            size="xl"
            block
            class="block-btn h-15 font-pixel text-lg"
            data-testid="wifi-connect"
            @click="connect(savedEntry.id, savedEntry.ssid)"
          >
            Verbinden
          </UButton>
          <p v-else class="rounded-lg bg-primary/10 px-3.5 py-3 text-primary">
            Der Server ist gerade mit diesem WLAN verbunden.
          </p>
          <HoldButton
            label="Entfernen"
            icon="i-lucide-trash-2"
            data-testid="wifi-remove"
            @confirm="remove(savedEntry.id, savedEntry.ssid)"
          />
          <p class="text-center text-sm text-muted">Zum Entfernen 3 Sekunden gedrückt halten.</p>
        </template>

        <form
          v-else-if="sheet?.kind === 'add'"
          class="flex flex-col gap-3"
          data-testid="wifi-add-form"
          @submit.prevent="add"
        >
          <UFormField v-if="sheet.manual" label="Name (SSID)" size="xl">
            <UInput v-model="ssid" size="xl" class="w-full" data-testid="wifi-add-ssid" />
          </UFormField>
          <p v-else class="font-pixel text-xl font-bold text-highlighted">{{ ssid }}</p>
          <UFormField v-if="sheet.manual" label="Mit Passwort" size="xl">
            <USwitch v-model="sheet.secured" size="lg" />
          </UFormField>
          <UFormField v-if="sheet.secured" label="Passwort" size="xl">
            <UInput
              v-model="password"
              type="password"
              size="xl"
              class="w-full"
              data-testid="wifi-add-password"
            />
          </UFormField>
          <UButton
            type="submit"
            icon="i-lucide-plus"
            size="xl"
            block
            class="block-btn font-pixel"
            :loading="sending"
            :disabled="!addValid || sending"
            data-testid="wifi-add-save"
          >
            Hinzufügen und verbinden
          </UButton>
        </form>
      </div>
    </template>
  </UDrawer>
</template>
