import { z } from "zod";

const gamemodeRequest = z.object({
  mode: z.enum(["survival", "creative", "adventure"])
});

export default defineEventHandler(async (event) => {
  const body = gamemodeRequest.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Ungültiger Spielmodus" });
  const { mode } = body.data;

  await bsm.sendCommand(`gamemode ${mode} @a`);
  await bsm.setProperties({ gamemode: mode });
  await updateActiveWorld({ mode });

  return { ok: true };
});
