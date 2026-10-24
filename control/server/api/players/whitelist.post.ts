import { z } from "zod";

const whitelistRequest = z.object({ name: gamertag });

export default defineEventHandler(async (event) => {
  const body = whitelistRequest.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Ungültiger Gamertag" });

  await bsm.allowlistAdd(body.data.name);
  await reloadIfRunning("allowlist reload");
  return { ok: true };
});
