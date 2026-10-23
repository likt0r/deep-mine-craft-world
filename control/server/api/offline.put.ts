import { z } from "zod";

const offlineSchema = z.object({ offline: z.boolean() });

export default defineEventHandler(async (event) => {
  const body = offlineSchema.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Ungültige Angabe" });
  // Ein Weltvorgang startet ohnehin neu, ein zweiter Neustart käme dazwischen.
  if (isWorldOperationRunning())
    throw createError({ statusCode: 409, message: "Gerade läuft ein Weltvorgang" });

  await bsm.setProperties({ "online-mode": body.data.offline ? "false" : "true" });
  // Wirksam erst nach dem Neustart. BSM antwortet erst, wenn der Server wieder läuft.
  bsm.restart().catch((error) => console.error("Neustart fehlgeschlagen:", error));
  return { ok: true };
});
