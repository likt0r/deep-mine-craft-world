import { z } from "zod";

const schema = z.object({ enabled: z.boolean() });

/** „Sichern, wenn eine Welt beendet wird“ an oder aus. */
export default defineEventHandler(async (event) => {
  const body = schema.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Ungültige Angabe" });
  await writeBackupSettings({ onWorldEnd: body.data.enabled });
  return { ok: true };
});
