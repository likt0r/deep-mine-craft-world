import { z } from "zod";

const enabledSchema = z.object({ enabled: z.boolean() });

export default defineEventHandler(async (event) => {
  const body = enabledSchema.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Ungültige Angabe" });

  return withWifi(async () => {
    await setWifiEnabled(body.data.enabled);
    return { ok: true };
  });
});
