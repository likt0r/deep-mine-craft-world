import { z } from "zod";

const apSchema = z.object({
  ssid: z.string().refine(isValidSsid),
  password: z.string().refine(isValidWifiPassword)
});

export default defineEventHandler(async (event) => {
  const body = apSchema.safeParse(await readBody(event).catch(() => null));
  if (!body.success)
    throw createError({ statusCode: 400, message: "Ungültiger WLAN-Name oder ungültiges Passwort" });

  return withWifi(async () => {
    await updateAccessPoint(body.data.ssid, body.data.password);
    return { ok: true };
  });
});
