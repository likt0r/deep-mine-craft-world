import { z } from "zod";

const permissionRequest = z.object({
  xuid: z.string().regex(/^\d{1,20}$/),
  permission: z.enum(["visitor", "member", "operator"])
});

export default defineEventHandler(async (event) => {
  const body = permissionRequest.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Ungültige Angabe" });

  const { xuid, permission } = body.data;
  const { players } = await readPlayers();
  const player = players.find((p) => p.xuid === xuid);
  if (!player) throw createError({ statusCode: 404, message: "Spieler unbekannt" });

  await bsm.setPermission(xuid, player.name, permission);
  await reloadIfRunning("permission reload");
  return { ok: true };
});
