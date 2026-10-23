<script setup lang="ts">
type Rule = (typeof RULES)[number];

/** Anzeige: Gruppen und Symbol je Regel. Die Regeln selbst stehen in RULES. */
const GROUPS: { title: string; rules: { name: RuleName; icon: string; tint: string }[] }[] = [
  {
    title: "Welt",
    rules: [
      { name: "dodaylightcycle", icon: "i-lucide-clock", tint: "bg-amber-400/15 text-amber-400" },
      { name: "doweathercycle", icon: "i-lucide-cloud", tint: "bg-sky-400/15 text-sky-400" },
      { name: "showcoordinates", icon: "i-lucide-map-pin", tint: "bg-emerald-400/15 text-emerald-400" }
    ]
  },
  {
    title: "Gefahren",
    rules: [
      { name: "domobspawning", icon: "i-lucide-skull", tint: "bg-lime-400/15 text-lime-400" },
      { name: "dofiretick", icon: "i-lucide-flame", tint: "bg-orange-400/15 text-orange-400" },
      { name: "tntexplodes", icon: "i-lucide-bomb", tint: "bg-red-400/15 text-red-400" },
      { name: "pvp", icon: "i-lucide-swords", tint: "bg-violet-300/15 text-violet-300" }
    ]
  },
  {
    title: "Sterben",
    rules: [{ name: "keepinventory", icon: "i-lucide-backpack", tint: "bg-amber-500/15 text-amber-500" }]
  }
];

const groups = GROUPS.map((group) => ({
  title: group.title,
  rules: group.rules.map((entry) => ({ ...entry, rule: RULES.find((r) => r.name === entry.name)! }))
}));

const feedback = useFeedback();

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
    feedback.done(`${rule.label}: ${on ? "an" : "aus"}`);
  } catch {
    // Ohne Rückmeldung besser zurück als etwas Falsches anzeigen.
    rules.value[rule.name] = previous;
    feedback.failed();
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <section class="flex flex-col gap-5" data-testid="rules">
    <USkeleton v-if="!rules" class="h-64" data-testid="rules-loading" />
    <template v-else>
      <section
        v-for="group in groups"
        :key="group.title"
        class="flex flex-col gap-2"
        :aria-labelledby="`rules-${group.title}`"
        :data-testid="`rules-group-${group.title.toLowerCase()}`"
      >
        <h2 :id="`rules-${group.title}`" class="font-pixel text-lg font-semibold text-toned">
          {{ group.title }}
        </h2>
        <ul class="divide-y divide-default overflow-hidden rounded-xl border border-default bg-muted">
          <li
            v-for="{ rule, icon, tint } in group.rules"
            :key="rule.name"
            class="flex min-h-16 items-center gap-3 px-3.5 py-2"
            :data-testid="`rule-row-${rule.name}`"
          >
            <span
              aria-hidden="true"
              class="flex size-9 shrink-0 items-center justify-center rounded-lg"
              :class="tint"
            >
              <UIcon :name="icon" class="size-5" />
            </span>
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <span :id="`rule-label-${rule.name}`" class="font-semibold">{{ rule.label }}</span>
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
              :aria-labelledby="`rule-label-${rule.name}`"
              :modelValue="isOn(rule)"
              :loading="busy === rule.name"
              :data-testid="`rule-${rule.name}`"
              @update:modelValue="(value: boolean) => toggle(rule, value)"
            />
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>
