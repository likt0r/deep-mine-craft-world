<script setup lang="ts">
/** Ethernet-Anschluss: Status, DHCP oder feste IP. Eine Änderung muss innerhalb von 2 Minuten bestätigt werden. */
const feedback = useFeedback();
const { data: eth, refresh } = useFetch<EthernetInfo>("/api/network/ethernet", { key: "ethernet" });
useWhileVisible(refresh, 3000, { immediate: false });

// Sekundengenauer Countdown bis zur Rücknahme.
const now = ref(Math.floor(Date.now() / 1000));
useWhileVisible(() => (now.value = Math.floor(Date.now() / 1000)), 1000, { immediate: false });

const change = computed(() => eth.value?.change ?? null);
const secondsLeft = computed(() => Math.max(0, (change.value?.deadline ?? 0) - now.value));
const open = computed(() => change.value?.phase === "requested" || change.value?.phase === "pending");
/** Ist die Seite schon unter der neuen Adresse offen? Sonst dorthin verlinken. */
const elsewhere = computed(() => {
  const target = change.value?.newAddress;
  return target && import.meta.client && window.location.hostname !== target ? target : null;
});

const editing = ref(false);
const mode = ref<"dhcp" | "static">("dhcp");
const address = ref("");
const prefix = ref(24);
const gateway = ref("");
const dns = ref("");
const saving = ref(false);

const dnsList = computed(() =>
  dns.value
    .split(/[\s,]+/)
    .map((d) => d.trim())
    .filter(Boolean)
);
const valid = computed(
  () =>
    mode.value === "dhcp" ||
    (isValidStaticIPv4(address.value, Number(prefix.value), gateway.value) &&
      dnsList.value.length <= 3 &&
      dnsList.value.every(isIPv4))
);

function startEdit() {
  const e = eth.value;
  mode.value = e?.mode ?? "dhcp";
  address.value = e?.address ?? "";
  prefix.value = e?.prefix ?? 24;
  gateway.value = e?.gateway ?? "";
  dns.value = (e?.dns ?? []).join(", ");
  editing.value = true;
}

async function save() {
  saving.value = true;
  const body =
    mode.value === "dhcp"
      ? { mode: "dhcp" }
      : {
          mode: "static",
          address: address.value,
          prefix: Number(prefix.value),
          gateway: gateway.value,
          dns: dnsList.value
        };
  try {
    await $fetch("/api/network/ethernet", { method: "PUT", body });
    editing.value = false;
    feedback.done("Wird übernommen …");
    await refresh();
  } catch {
    feedback.failed();
  } finally {
    saving.value = false;
  }
}

async function confirmChange() {
  try {
    await $fetch("/api/network/ethernet/confirm", { method: "POST" });
    feedback.done("Netzwerk-Einstellung bestätigt.");
    await refresh();
  } catch {
    feedback.failed();
  }
}
</script>

<template>
  <SystemCard title="Ethernet (Kabel)" icon="i-lucide-ethernet-port" data-testid="ethernet">
    <dl
      v-if="eth"
      class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px]"
      data-testid="ethernet-status"
    >
      <dt class="text-muted">Kabel</dt>
      <dd class="font-semibold" :class="eth.carrier ? 'text-success' : 'text-error'">
        {{ eth.carrier ? `steckt${eth.speed ? ` · ${eth.speed} Mbit/s` : ""}` : "kein Kabel" }}
      </dd>
      <dt class="text-muted">Adresse</dt>
      <dd class="font-mono font-semibold">
        {{ eth.address ? `${eth.address}/${eth.prefix}` : "keine" }}
        <UBadge color="neutral" variant="soft" class="ms-1 font-sans">{{
          eth.mode === "dhcp" ? "DHCP" : "fest"
        }}</UBadge>
      </dd>
      <dt class="text-muted">Gateway</dt>
      <dd class="font-mono">{{ eth.gateway ?? "–" }}</dd>
      <dt class="text-muted">DNS</dt>
      <dd class="font-mono">{{ eth.dns.length ? eth.dns.join(", ") : "–" }}</dd>
      <dt class="text-muted">MAC</dt>
      <dd class="font-mono text-muted">{{ eth.mac ?? "–" }}</dd>
    </dl>

    <UAlert
      v-if="change?.phase === 'requested'"
      color="info"
      variant="subtle"
      icon="i-lucide-loader-circle"
      title="Wird übernommen …"
      data-testid="ethernet-change"
    />
    <div
      v-else-if="change?.phase === 'pending'"
      class="flex flex-col gap-2.5 rounded-lg border border-warning/45 bg-warning/10 p-3.5"
      data-testid="ethernet-change"
    >
      <p class="font-semibold text-warning">
        Neue Einstellung aktiv – noch {{ secondsLeft }} s zum Bestätigen
      </p>
      <p class="text-sm text-toned">
        Ohne Bestätigung kommt danach von selbst die alte Einstellung zurück.
        <template v-if="elsewhere">
          Die Adresse hat sich geändert: Bestätige unter
          <a :href="`http://${elsewhere}/system/netzwerk`" class="font-semibold underline"
            >http://{{ elsewhere }}</a
          >.
        </template>
      </p>
      <UButton
        icon="i-lucide-check"
        size="xl"
        block
        class="block-btn font-pixel"
        data-testid="ethernet-confirm"
        @click="confirmChange"
      >
        Bestätigen
      </UButton>
    </div>
    <UAlert
      v-else-if="change?.phase === 'rolled-back'"
      color="warning"
      variant="subtle"
      icon="i-lucide-undo-2"
      description="Die letzte Änderung wurde nicht bestätigt, deshalb gilt wieder die alte Einstellung."
      data-testid="ethernet-change"
    />
    <UAlert
      v-else-if="change?.phase === 'failed'"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Die Einstellung wurde nicht übernommen"
      :description="change.error ?? undefined"
      data-testid="ethernet-change"
    />

    <UButton
      icon="i-lucide-pencil"
      color="neutral"
      variant="subtle"
      size="lg"
      class="block-btn self-start"
      :disabled="open"
      data-testid="ethernet-edit"
      @click="startEdit"
    >
      Ändern
    </UButton>

    <UDrawer
      v-model:open="editing"
      handleOnly
      title="Ethernet einstellen"
      :ui="{
        content: 'bg-muted',
        container: 'mx-auto w-full max-w-lg pb-[calc(1rem+env(safe-area-inset-bottom))]'
      }"
    >
      <template #body>
        <form class="flex flex-col gap-3" data-testid="ethernet-form" @submit.prevent="save">
          <div class="grid grid-cols-2 gap-2" role="group" aria-label="Adresse beziehen">
            <UButton
              v-for="option in [
                { value: 'dhcp', label: 'DHCP (vom Router)' },
                { value: 'static', label: 'Feste IP' }
              ] as const"
              :key="option.value"
              :color="mode === option.value ? 'primary' : 'neutral'"
              :variant="mode === option.value ? 'solid' : 'subtle'"
              :aria-pressed="mode === option.value"
              size="xl"
              block
              class="block-btn px-1"
              :data-testid="`ethernet-mode-${option.value}`"
              @click="mode = option.value"
            >
              {{ option.label }}
            </UButton>
          </div>
          <template v-if="mode === 'static'">
            <div class="grid grid-cols-[1fr_6rem] gap-2">
              <UFormField label="IP-Adresse" size="xl">
                <UInput
                  v-model="address"
                  size="xl"
                  class="w-full"
                  inputmode="decimal"
                  data-testid="ethernet-address"
                />
              </UFormField>
              <UFormField label="Präfix" size="xl">
                <UInput
                  v-model.number="prefix"
                  type="number"
                  min="8"
                  max="30"
                  size="xl"
                  class="w-full"
                  data-testid="ethernet-prefix"
                />
              </UFormField>
            </div>
            <UFormField label="Gateway (Router)" size="xl">
              <UInput
                v-model="gateway"
                size="xl"
                class="w-full"
                inputmode="decimal"
                data-testid="ethernet-gateway"
              />
            </UFormField>
            <UFormField label="DNS (bis zu 3, mit Komma getrennt)" size="xl">
              <UInput v-model="dns" size="xl" class="w-full" data-testid="ethernet-dns" />
            </UFormField>
          </template>
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-timer"
            description="Nach dem Speichern hast du 2 Minuten, um die neue Einstellung zu bestätigen – bei einer neuen Adresse unter dieser. Sonst kommt die alte von selbst zurück."
          />
          <UButton
            type="submit"
            size="xl"
            block
            class="block-btn font-pixel"
            :loading="saving"
            :disabled="!valid || saving"
            data-testid="ethernet-save"
          >
            Speichern
          </UButton>
        </form>
      </template>
    </UDrawer>
  </SystemCard>
</template>
