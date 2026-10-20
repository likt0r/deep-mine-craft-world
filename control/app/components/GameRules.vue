<script setup lang="ts">
type Rule = (typeof RULES)[number];

const rules = ref<Rules | null>(null);
const busy = ref<RuleName | null>(null);

/** Kommen alle Regeln unbekannt zurück, startet der Server vielleicht gerade noch: später nachfragen. */
const RETRIES = 3;
const RETRY_MS = 5000;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

async function load(attempt = 0) {
  rules.value = await $fetch<Rules>("/api/rules");
  const allUnknown = Object.values(rules.value).every((value) => value === null);
  if (allUnknown && attempt < RETRIES) retryTimer = setTimeout(() => load(attempt + 1), RETRY_MS);
}

onMounted(() => load());
onBeforeUnmount(() => clearTimeout(retryTimer));

/** Anzeige: invertierte Regeln zeigen den Schalterzustand, nicht den Regelwert. */
function isOn(rule: Rule): boolean {
  const value = rules.value?.[rule.name];
  if (value === null || value === undefined) return false;
  return rule.inverted ? !value : value;
}

async function toggle(rule: Rule, on: boolean) {
  if (!rules.value) return;
  const previous = rules.value[rule.name];
  const value = rule.inverted ? !on : on;
  rules.value[rule.name] = value;
  busy.value = rule.name;
  try {
    await $fetch("/api/rules", { method: "POST", body: { name: rule.name, value } });
  } catch {
    // Ohne Rückmeldung besser zurück als etwas Falsches anzeigen.
    rules.value[rule.name] = previous;
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <section class="flex flex-col gap-3" data-testid="rules">
    <h2 class="text-xl font-semibold">Spielregeln</h2>
    <USkeleton v-if="!rules" class="h-64" data-testid="rules-loading" />
    <div v-else class="flex flex-col gap-2">
      <div
        v-for="rule in RULES"
        :key="rule.name"
        class="flex items-center justify-between gap-4 rounded-lg bg-elevated/50 px-4 py-3"
        :data-testid="`rule-row-${rule.name}`"
      >
        <div class="flex flex-col gap-1">
          <span class="font-medium">{{ rule.label }}</span>
          <UBadge
            v-if="rules[rule.name] === null"
            color="warning"
            variant="subtle"
            size="sm"
            class="self-start"
            :data-testid="`rule-${rule.name}-unknown`"
          >
            unbekannt
          </UBadge>
        </div>
        <USwitch
          size="xl"
          :modelValue="isOn(rule)"
          :loading="busy === rule.name"
          :data-testid="`rule-${rule.name}`"
          @update:modelValue="(value: boolean) => toggle(rule, value)"
        />
      </div>
    </div>
  </section>
</template>
