export default defineEventHandler(async (): Promise<Status> => {
  const [summary, properties] = await Promise.all([bsm.summary(), bsm.getProperties()]).catch((cause) => {
    // Deep Mine Control läuft, aber BSM antwortet nicht. Die Seite unterscheidet das von „keine Verbindung“.
    throw createError({ statusCode: 503, message: "BSM antwortet nicht", data: { reason: "bsm" }, cause });
  });
  const places = await getPlaces(properties);
  return {
    state: mapServerState(summary.status),
    // Anzeigename der aktiven Welt; liegt sie auf keinem Platz, der Ordnername.
    world: places.find((p) => p.active)?.world?.name ?? properties["level-name"] ?? "",
    players: summary.players.map((p) => p.name),
    busy: isWorldOperationRunning(),
    switching: currentWorldSwitch()
  };
});
