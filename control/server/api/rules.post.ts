import { z } from "zod";

// Es gibt keine freien Konsolenbefehle: gesetzt wird nur eine der acht bekannten Regeln.
const bodySchema = z.object({
  name: z.enum(RULE_NAMES),
  value: z.boolean()
});

export default defineEventHandler(async (event) => {
  const body = bodySchema.safeParse(await readBody(event));
  if (!body.success) throw createError({ statusCode: 400, statusMessage: "Unbekannte Spielregel" });

  const { name, value } = body.data;
  await bsm.sendCommand(`gamerule ${name} ${value}`);
  return { ok: true };
});
