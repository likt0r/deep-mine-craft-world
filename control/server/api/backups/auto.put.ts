import { z } from "zod";
import { FetchError } from "ofetch";

const autoSchema = z.object({ enabled: z.boolean() });

/** „Vor jedem Start sichern“: das BSM-Plugin backup_on_start. Braucht ein BSM-Konto mit Admin-Rechten. */
export default defineEventHandler(async (event) => {
  const body = autoSchema.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Ungültige Angabe" });
  try {
    await bsm.setPlugin("backup_on_start", body.data.enabled);
  } catch (error) {
    if (error instanceof FetchError && error.statusCode === 403)
      throw createError({ statusCode: 503, message: "Das BSM-Konto deep-mine-control braucht Admin-Rechte" });
    throw error;
  }
  return { ok: true };
});
