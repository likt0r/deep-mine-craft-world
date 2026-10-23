import { z } from "zod";

// Offene WLANs haben kein Passwort, sonst gelten die Grenzen von WPA2.
const networkSchema = z.object({
  ssid: z.string().refine(isValidSsid),
  password: z.string().refine((p) => p === "" || isValidWifiPassword(p))
});

export default defineEventHandler(async (event) => {
  const body = networkSchema.safeParse(await readBody(event).catch(() => null));
  if (!body.success)
    throw createError({ statusCode: 400, message: "Ungültiger WLAN-Name oder ungültiges Passwort" });

  return withWifi(async () => {
    const wifi = await readWifi();
    if (wifi.saved.some((s) => s.ssid === body.data.ssid))
      throw createError({ statusCode: 409, message: "Dieses WLAN ist schon hinterlegt" });
    const id = await addSavedNetwork(body.data.ssid, body.data.password);
    return { id };
  });
});
