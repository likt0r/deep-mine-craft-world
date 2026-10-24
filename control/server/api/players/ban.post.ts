import { z } from "zod";

const banRequest = z.object({ xuid: z.string().regex(/^\d{1,20}$/), reason: playerMessage.optional() });

export default defineEventHandler(async (event) => {
  const body = banRequest.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Ungültige XUID oder ungültiger Grund" });
  const { xuid } = body.data;
  const reason = body.data.reason || null;

  const { players } = await readPlayers();
  const player = players.find((p) => p.xuid === xuid);
  if (!player) throw createError({ statusCode: 404, message: "Spieler ist nicht bekannt" });

  await bsm.ban(player.name, xuid, reason);
  // Sonst widersprechen sich Whitelist und Sperre.
  if (player.whitelisted) {
    await bsm.allowlistRemove(player.name);
    await reloadIfRunning("allowlist reload");
  }
  // BSM kickt erst beim nächsten Spielerscan, die Sperre soll aber sofort wirken.
  if (player.online) await bsm.sendCommand(`kick "${player.name}" ${reason ?? "Du bist gesperrt."}`);
  return { ok: true };
});
