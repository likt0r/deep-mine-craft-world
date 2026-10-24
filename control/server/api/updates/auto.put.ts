import { z } from "zod";

const schema = z
  .object({ control: z.boolean().optional(), minecraft: z.boolean().optional() })
  .strict()
  .refine((body) => body.control !== undefined || body.minecraft !== undefined);

/** Autoupdate für Deep Mine Control und/oder Minecraft an oder aus. Gibt die Schalter danach zurück. */
export default defineEventHandler(async (event): Promise<AutoUpdateSettings> => {
  const body = schema.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Ungültige Angabe" });
  return writeAutoUpdateSettings(body.data);
});
