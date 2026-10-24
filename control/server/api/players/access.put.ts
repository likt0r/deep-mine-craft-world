import { z } from "zod";

const accessRequest = z
  .object({
    closed: z.boolean().optional(),
    newPlayers: z.enum(["visitor", "member"]).optional(),
    onlineNotListed: z.enum(["whitelist", "kick"]).optional()
  })
  .refine((body) => body.closed !== undefined || body.newPlayers !== undefined, {
    message: "Mindestens Zugang oder Recht für neue Spieler angeben"
  });

export default defineEventHandler(async (event) => {
  const body = accessRequest.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Ungültige Angabe" });

  const { closed, newPlayers, onlineNotListed } = body.data;
  const running = mapServerState((await bsm.summary()).status) === "running";
  // Öffnen startet neu (siehe unten). Ein Weltvorgang startet ohnehin neu, ein zweiter Neustart käme dazwischen.
  if (closed === false && running && isWorldOperationRunning())
    throw createError({ statusCode: 409, message: "Gerade läuft ein Weltvorgang" });

  if (closed === true) {
    const { players } = await readPlayers();
    // Gesperrte kickt BSM ohnehin, sie kommen nie auf die Whitelist.
    const unlisted = players.filter((player) => player.online && !player.whitelisted && !player.banned);
    if (unlisted.length > 0) {
      if (!onlineNotListed)
        throw createError({
          statusCode: 409,
          message: `Nicht auf der Whitelist: ${unlisted.map((player) => player.name).join(", ")}`
        });
      if (onlineNotListed === "whitelist") {
        for (const player of unlisted) await bsm.allowlistAdd(player.name);
        await reloadIfRunning("allowlist reload");
      } else {
        for (const player of unlisted)
          await bsm.sendCommand(`kick "${player.name}" Der Server ist jetzt geschlossen.`);
      }
    }
  }

  const properties: Record<string, string> = {};
  if (closed !== undefined) properties["allow-list"] = String(closed);
  if (newPlayers !== undefined) properties["default-player-permission-level"] = newPlayers;
  if (Object.keys(properties).length > 0) await bsm.setProperties(properties);

  // Die Eigenschaft gilt ab dem nächsten Start. Schließen geht sofort mit `allowlist on`. `allowlist off` sperrt
  // BSM für send_command, deshalb startet Öffnen neu. BSM antwortet erst, wenn der Server wieder läuft.
  if (running && closed === true) await bsm.sendCommand("allowlist on");
  const restarting = running && closed === false;
  if (restarting) bsm.restart().catch((error) => console.error("Neustart fehlgeschlagen:", error));

  return { ok: true, restarting };
});
