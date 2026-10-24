/**
 * Lädt den Stand der Updates jede Minute neu, solange die Seite sichtbar ist. Nur einmal in der App aufrufen
 * (app.vue). Erst im Browser: Die Prüfung bei Mojang soll das erste Rendern nicht aufhalten.
 */
export function useUpdatesPolling() {
  const { refresh } = useFetch<UpdatesInfo>("/api/updates", { key: "updates", server: false });
  useWhileVisible(refresh, 60_000, { immediate: false });
}

/** Ein Update, das bereitliegt. */
export interface AvailableUpdate {
  kind: UpdateKind;
  /** z. B. „Minecraft 1.26.60.1“ */
  label: string;
  version: string;
}

const NAMES: Record<UpdateKind, string> = { minecraft: "Minecraft", control: "Deep Mine Control" };

/** Stand der Updates für Hinweise und die Seite Updates. Abgefragt wird er von useUpdatesPolling. */
export function useUpdates() {
  const { data: info } = useNuxtData<UpdatesInfo>("updates");
  const refresh = () => refreshNuxtData("updates");

  const available = computed<AvailableUpdate[]>(() => {
    const current = info.value;
    if (!current) return [];
    return (Object.keys(NAMES) as UpdateKind[]).flatMap((kind) => {
      const version = kind in current ? (current as unknown as Record<UpdateKind, VersionInfo>)[kind] : null;
      return version?.available && version.latest
        ? [{ kind, label: `${NAMES[kind]} ${version.latest}`, version: version.latest }]
        : [];
    });
  });
  /** Läuft gerade ein Update (ein gescheitertes zählt nicht) */
  const updating = computed(() => !!info.value?.running && info.value.running.phase !== "failed");

  return { info, refresh, available, updating };
}
