export default defineEventHandler(async (): Promise<Status> => {
  const [summary, properties] = await Promise.all([bsm.summary(), bsm.getProperties()]);
  return {
    state: mapServerState(summary.status),
    world: properties["level-name"] ?? "",
    players: summary.players.map((p) => p.name),
    busy: false
  };
});
