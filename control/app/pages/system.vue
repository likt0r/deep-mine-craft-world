<script setup lang="ts">
useSeoMeta({ title: "System · Deep Mine Control" });

const { available } = useUpdates();

const TABS = [
  { to: "/system", label: "Übersicht", icon: "i-lucide-activity", testid: "system-tab-overview" },
  { to: "/system/netzwerk", label: "Netzwerk", icon: "i-lucide-network", testid: "system-tab-netzwerk" },
  { to: "/system/backups", label: "Backups", icon: "i-lucide-archive", testid: "system-tab-backups" },
  { to: "/system/updates", label: "Updates", icon: "i-lucide-download", testid: "system-tab-updates" }
];
</script>

<template>
  <UContainer class="flex flex-col gap-3.5 py-5 lg:max-w-4xl">
    <h1 class="font-pixel text-3xl font-bold text-highlighted">System</h1>
    <!-- Unterbereiche von System, im Stil der Segment-Knöpfe. Auf dem Handy 2×2. -->
    <nav
      aria-label="System"
      class="grid grid-cols-2 gap-2 sm:max-w-2xl sm:grid-cols-4"
      data-testid="system-tabs"
    >
      <NuxtLink
        v-for="tab in TABS"
        :key="tab.to"
        :to="tab.to"
        :data-testid="tab.testid"
        class="block-btn relative flex h-12 items-center justify-center gap-1.5 rounded-lg px-1 text-sm sm:gap-2 sm:text-base border-2 border-accented bg-elevated font-semibold text-default aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-inverted"
      >
        <UIcon :name="tab.icon" class="size-5" />
        {{ tab.label }}
        <span
          v-if="tab.to === '/system/updates' && available.length > 0"
          class="absolute -right-1 -top-1 size-2 rounded-full bg-warning ring-2 ring-default"
          data-testid="system-tab-updates-dot"
        />
      </NuxtLink>
    </nav>
    <NuxtPage />
  </UContainer>
</template>
