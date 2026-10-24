import { z } from "zod";

const kickRequest = z.object({ name: gamertag, reason: playerMessage.optional() });

export default defineEventHandler(async (event) => {
  const body = kickRequest.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Ungültiger Gamertag oder Nachricht" });
  const { name, reason } = body.data;

  const summary = await bsm.summary();
  if (mapServerState(summary.status) !== "running")
    throw createError({ statusCode: 409, message: "Der Server läuft nicht" });
  // Im Befehl die Schreibweise aus dem Spiel.
  const online = summary.players.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (!online) throw createError({ statusCode: 404, message: "Spieler ist nicht online" });

  await bsm.sendCommand(reason ? `kick "${online.name}" ${reason}` : `kick "${online.name}"`);
  return { ok: true };
});
