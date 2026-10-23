/**
 * Lädt alle 3 s Status und Plätze neu, egal in welchem Bereich man ist, solange die Seite sichtbar ist.
 * Nur einmal in der App aufrufen (app.vue).
 */
export function useStatusPolling() {
  const { refresh, error } = useFetch<Status>("/api/status", { key: "status" });
  const connection = useConnection();

  // Antwortet Deep Mine Control mit Grund „bsm“, läuft es, aber BSM nicht. Sonst ist die Verbindung weg.
  watch(
    error,
    (current) => {
      if (!current) return (connection.value = "ok");
      // Nitro schickt den Fehler als { statusCode, message, data } zurück.
      const body = current.data as { data?: { reason?: string } } | undefined;
      connection.value = body?.data?.reason === "bsm" ? "bsm-down" : "offline";
    },
    { immediate: true }
  );

  // Den ersten Stand bringt schon das Rendern auf dem Server mit.
  useWhileVisible(() => Promise.all([refresh(), refreshNuxtData("places")]), 3000, { immediate: false });
}

/** Ob Deep Mine Control und BSM antworten. */
export type Connection = "ok" | "offline" | "bsm-down";

export function useConnection() {
  return useState<Connection>("connection", () => "ok");
}

/** Serverstatus für Bereiche und Komponenten. Abgefragt wird er von useStatusPolling. */
export function useServerStatus() {
  const { data } = useNuxtData<Status>("status");
  const connection = useConnection();
  const refresh = () => refreshNuxtData("status");

  /** Steuerung ist nur möglich mit Verbindung, wenn der Server läuft und kein Weltvorgang läuft. */
  const locked = computed(
    () => connection.value !== "ok" || data.value?.state !== "running" || data.value.busy
  );

  return { status: data, connection, refresh, locked };
}
