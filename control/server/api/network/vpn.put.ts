import { z } from "zod";

const uploadSchema = z.object({
  config: z.string().max(16_384),
  autoconnect: z.boolean().default(true),
  /** Gesamten Internetverkehr durchs VPN; Standard aus */
  routeAll: z.boolean().default(false)
});

/** Lädt eine WireGuard-Konfiguration hoch (ersetzt die alte) und verbindet. */
export default defineEventHandler(async (event) => {
  const body = uploadSchema.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Keine gültige Datei" });
  try {
    parseWireguard(body.data.config);
  } catch (error) {
    throw createError({ statusCode: 400, message: (error as Error).message });
  }
  return withWifi(async () => {
    await importVpn(body.data.config, body.data.autoconnect, body.data.routeAll);
    return { ok: true };
  });
});
