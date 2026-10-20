import { z } from "zod";

// Nur diese festen Befehle sind möglich, es gibt keinen Endpunkt für freie Konsolenbefehle.
const timeSchema = z.object({
  time: z.enum(["morgen", "mittag", "abend", "nacht"])
});

const TIME_COMMANDS: Record<z.infer<typeof timeSchema>["time"], string> = {
  morgen: "time set sunrise",
  mittag: "time set noon",
  abend: "time set sunset",
  nacht: "time set midnight"
};

export default defineEventHandler(async (event) => {
  const parsed = timeSchema.safeParse(await readBody(event).catch(() => null));
  if (!parsed.success)
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Unbekannte Zeitangabe" });

  await bsm.sendCommand(TIME_COMMANDS[parsed.data.time]);
  return { ok: true };
});
