<script setup lang="ts">
useSeoMeta({ title: "System · Deep Mine Control" });

const TABS = [
  { to: "/system", label: "Übersicht", icon: "i-lucide-activity", testid: "system-tab-overview" },
  { to: "/system/wlan", label: "WLAN", icon: "i-lucide-wifi", testid: "system-tab-wlan" }
];
</script>

<template>
  <UContainer class="flex flex-col gap-3.5 py-5 lg:max-w-4xl">
    <h1 class="font-pixel text-3xl font-bold text-highlighted">System</h1>
    <!-- Unterbereiche von System, im Stil der Segment-Knöpfe -->
    <nav aria-label="System" class="grid grid-cols-2 gap-2 sm:max-w-sm" data-testid="system-tabs">
      <NuxtLink
        v-for="tab in TABS"
        :key="tab.to"
        :to="tab.to"
        :data-testid="tab.testid"
        class="block-btn flex h-12 items-center justify-center gap-2 rounded-lg border-2 border-accented bg-elevated font-semibold text-default aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-inverted"
      >
        <UIcon :name="tab.icon" class="size-5" />
        {{ tab.label }}
      </NuxtLink>
    </nav>
    <NuxtPage />
  </UContainer>
</template>
