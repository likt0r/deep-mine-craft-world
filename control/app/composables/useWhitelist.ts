/** Setzt einen Spieler auf die Whitelist oder nimmt ihn herunter, meldet es und holt die Spielerliste neu. */
export function useWhitelist() {
  const feedback = useFeedback();

  return async function setWhitelisted(name: string, on: boolean): Promise<boolean> {
    try {
      await $fetch("/api/players/whitelist", { method: on ? "POST" : "DELETE", body: { name } });
      feedback.done(
        on ? `${name} steht jetzt auf der Whitelist.` : `${name} steht nicht mehr auf der Whitelist.`
      );
      await refreshNuxtData("players");
      return true;
    } catch {
      feedback.failed();
      return false;
    }
  };
}
