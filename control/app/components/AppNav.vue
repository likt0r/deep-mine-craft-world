<script setup lang="ts">
// Markiert wird der ganze Bereich (router-link-active), damit System auch unter /system/netzwerk leuchtet.
const { available } = useUpdates();

const AREAS = [
  { to: "/", label: "Spielen", icon: "i-lucide-gamepad-2" },
  { to: "/welten", label: "Welten", icon: "i-lucide-layers" },
  { to: "/regeln", label: "Regeln", icon: "i-lucide-toggle-right" },
  { to: "/spieler", label: "Spieler", icon: "i-lucide-users" },
  { to: "/system", label: "System", icon: "i-lucide-activity" }
];
</script>

<template>
  <!-- Handy: Tab-Leiste unten. Ab Tablet: Seitenleiste links. -->
  <nav
    aria-label="Bereiche"
    data-testid="app-nav"
    class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-default bg-muted pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:right-auto md:flex md:w-28 md:flex-col md:gap-2 md:border-t-0 md:border-r md:px-3 md:py-5"
  >
    <div aria-hidden="true" class="grass-block mx-auto mb-4 hidden size-13 md:block" />
    <NuxtLink
      v-for="area in AREAS"
      :key="area.to"
      :to="area.to"
      :data-testid="`nav-${area.label.toLowerCase()}`"
      class="relative flex h-19 flex-col items-center justify-center gap-1 border-t-3 border-transparent font-pixel text-sm font-semibold text-muted transition-colors hover:text-default md:h-auto md:rounded-lg md:border-t-0 md:py-3 md:text-base [&.router-link-active]:border-primary [&.router-link-active]:text-primary md:[&.router-link-active]:bg-primary/15"
    >
      <span class="relative">
        <UIcon :name="area.icon" class="size-6" />
        <span
          v-if="area.label === 'System' && available.length > 0"
          class="absolute -right-1.5 -top-1.5 size-2 rounded-full bg-warning ring-2 ring-default"
          data-testid="nav-update-dot"
        />
      </span>
      {{ area.label }}
    </NuxtLink>
  </nav>
</template>
