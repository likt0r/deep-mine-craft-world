/** Lädt die Welt eines Platzes und meldet es. Gibt zurück, ob das Laden begonnen hat. */
export function useWorldLoad() {
  const feedback = useFeedback();
  const { refresh } = useServerStatus();

  return async function loadWorld(place: number, name: string): Promise<boolean> {
    try {
      await $fetch(`/api/places/${place}/load`, { method: "POST" });
      feedback.done(`${name} wird geladen …`);
      // Der Status zeigt sofort den Wechsel und sperrt die Knöpfe.
      await refresh();
      return true;
    } catch {
      feedback.failed();
      return false;
    }
  };
}
