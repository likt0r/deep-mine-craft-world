export default defineEventHandler(async (): Promise<Status> => {
  const version = await readVersion();
  const [summary, properties] = await Promise.all([bsm.summary(), bsm.getProperties()]).catch((cause) => {
    // Deep Mine Control läuft, aber BSM antwortet nicht. Die Seite unterscheidet das von „keine Verbindung“.
    // Die Version steht trotzdem dabei: Nach einem Update wartet deep-mine-update auf sie.
    throw createError({
      statusCode: 503,
      message: "BSM antwortet nicht",
      data: { reason: "bsm", version },
      cause
    });
  });
  const [places, updating] = await Promise.all([getPlaces(properties), updatingNow()]);
  return {
    state: mapServerState(summary.status),
    // Anzeigename der aktiven Welt; liegt sie auf keinem Platz, der Ordnername.
    world: places.find((p) => p.active)?.world?.name ?? properties["level-name"] ?? "",
    players: summary.players.map((p) => p.name),
    // Während Deep Mine Control aktualisiert wird, startet es bald neu: nichts Neues anfangen.
    busy: isWorldOperationRunning() || updating === "control",
    switching: currentWorldSwitch(),
    updating,
    version
  };
});
