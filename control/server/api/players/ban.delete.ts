import { z } from "zod";

const unbanRequest = z.object({ xuid: z.string().regex(/^\d{1,20}$/) });

/** Entsperren setzt den Spieler nicht wieder auf die Whitelist. */
export default defineEventHandler(async (event) => {
  const body = unbanRequest.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Ungültige XUID" });

  await bsm.unban(body.data.xuid);
  return { ok: true };
});
