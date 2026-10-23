/**
 * Lädt alle 3 s Status und Plätze neu, egal in welchem Bereich man ist, solange die Seite sichtbar ist.
 * Nur einmal in der App aufrufen (app.vue).
 */
export function useStatusPolling() {
  const { refresh } = useFetch<Status>("/api/status", { key: "status" });

  // Den ersten Stand bringt schon das Rendern auf dem Server mit.
  useWhileVisible(() => Promise.all([refresh(), refreshNuxtData("places")]), 3000, { immediate: false });
}

/** Serverstatus für Bereiche und Komponenten. Abgefragt wird er von useStatusPolling. */
export function useServerStatus() {
  const { data } = useNuxtData<Status>("status");
  const refresh = () => refreshNuxtData("status");

  /** Steuerung ist nur möglich, wenn der Server läuft und kein Weltvorgang läuft. */
  const locked = computed(() => data.value?.state !== "running" || data.value.busy);

  return { status: data, refresh, locked };
}
