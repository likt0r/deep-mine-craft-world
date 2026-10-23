<script setup lang="ts">
useHead({
  meta: [{ name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" }],
  htmlAttrs: { lang: "de" }
});

useSeoMeta({ title: "Deep Mine Control" });

useStatusPolling();
</script>

<template>
  <UApp>
    <AppNav />
    <!-- Platz für die Tab-Leiste unten (Handy) bzw. die Seitenleiste links (ab Tablet). -->
    <UMain class="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-28">
      <StatusBanner />
      <NuxtPage />
    </UMain>
  </UApp>
</template>
