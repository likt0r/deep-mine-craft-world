import { z } from "zod";

const teleportRequest = z.object({
  /** Ziel, zu dem alle Spieler geholt werden: Gamertag eines online Spielers. */
  player: z.string().min(1)
});

export default defineEventHandler(async (event) => {
  const body = teleportRequest.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Spieler fehlt" });
  const { player } = body.data;

  // Der Name kommt in Anführungszeichen in den Befehl, deshalb darf er keine enthalten.
  if (/["']/.test(player)) throw createError({ statusCode: 400, message: "Ungültiger Spielername" });

  const summary = await bsm.summary();
  if (!summary.players.some((p) => p.name === player))
    throw createError({ statusCode: 400, message: "Spieler ist nicht online" });

  await bsm.sendCommand(`tp @a "${player}"`);
  return { ok: true };
});
