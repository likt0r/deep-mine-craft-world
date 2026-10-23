import { z } from "zod";

const schema = z.object({ enabled: z.boolean() });

export default defineEventHandler(async (event) => {
  const body = schema.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Ungültige Angabe" });
  return withWifi(async () => {
    if (!(await vpnConfigured())) throw createError({ statusCode: 404, message: "Kein VPN eingerichtet" });
    await setVpnAutoconnect(body.data.enabled);
    return { ok: true };
  });
});
