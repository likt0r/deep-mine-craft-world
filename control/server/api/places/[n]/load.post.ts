export default defineEventHandler(async (event) => {
  const place = getRouterParam(event, "n") ?? "";
  if (!/^[1-9]$|^10$/.test(place)) throw createError({ statusCode: 400, message: "Ungültiger Platz" });
  const placeNum = Number(place);

  const stored = getStoredWorld(placeNum);
  if (!stored) throw createError({ statusCode: 404, message: "Platz ist leer" });

  const properties = await bsm.getProperties();
  const levelName = properties["level-name"] ?? "";
  if (stored.folder === levelName) throw createError({ statusCode: 409, message: "Welt ist bereits aktiv" });

  startWorldOperation({ place: placeNum, world: stored.name }, async () => {
    await switchWorld(stored.name, {
      "level-name": stored.folder,
      gamemode: stored.mode,
      difficulty: stored.difficulty
    });
  });

  return { ok: true };
});
