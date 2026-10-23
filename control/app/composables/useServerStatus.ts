/** Lädt alle 3 s Status und Plätze neu, egal in welchem Bereich man ist. Nur einmal in der App aufrufen (app.vue). */
export function useStatusPolling() {
  const { refresh } = useFetch<Status>("/api/status", { key: "status" });

  onMounted(() => {
    const timer = setInterval(() => {
      refresh();
      refreshNuxtData("places");
    }, 3000);
    onBeforeUnmount(() => clearInterval(timer));
  });
}

/** Serverstatus für Bereiche und Komponenten. Abgefragt wird er von useStatusPolling. */
export function useServerStatus() {
  const { data } = useNuxtData<Status>("status");
  const refresh = () => refreshNuxtData("status");

  /** Steuerung ist nur möglich, wenn der Server läuft und kein Weltvorgang läuft. */
  const locked = computed(() => data.value?.state !== "running" || data.value.busy);

  return { status: data, refresh, locked };
}
