/** Serverstatus für die ganze Seite. Lädt alle 3 s Status und Plätze neu. Nur einmal pro Seite aufrufen. */
export function useServerStatus() {
  const { data, refresh, error } = useFetch<Status>("/api/status", { key: "status" });

  onMounted(() => {
    const timer = setInterval(() => {
      refresh();
      refreshNuxtData("places");
    }, 3000);
    onBeforeUnmount(() => clearInterval(timer));
  });

  /** Steuerung ist nur möglich, wenn der Server läuft und kein Weltvorgang läuft. */
  const locked = computed(() => data.value?.state !== "running" || data.value.busy);

  return { status: data, refresh, error, locked };
}
