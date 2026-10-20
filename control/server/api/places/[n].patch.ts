import { z } from "zod";

const renameRequest = z.object({
  /** Nur der Anzeigename ändert sich, nicht der Weltordner. */
  name: z.string().trim().refine(isValidWorldName)
});

export default defineEventHandler(async (event) => {
  const place = getRouterParam(event, "n") ?? "";
  if (!/^[1-9]$|^10$/.test(place)) throw createError({ statusCode: 400, message: "Ungültiger Platz" });

  const body = renameRequest.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Ungültiger Name" });

  // Nur die Plätze-Datei: kein Aufruf an BSM und kein Neustart.
  if (!renamePlace(Number(place), body.data.name))
    throw createError({ statusCode: 404, message: "Platz ist leer" });

  return { ok: true };
});
