import { z } from "zod";

// Nur diese festen Befehle sind möglich, es gibt keinen Endpunkt für freie Konsolenbefehle.
const weatherSchema = z.object({
  weather: z.enum(["sonne", "regen", "gewitter"])
});

const WEATHER_COMMANDS: Record<z.infer<typeof weatherSchema>["weather"], string> = {
  sonne: "weather clear",
  regen: "weather rain",
  gewitter: "weather thunder"
};

export default defineEventHandler(async (event) => {
  const parsed = weatherSchema.safeParse(await readBody(event).catch(() => null));
  if (!parsed.success)
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Unbekanntes Wetter" });

  await bsm.sendCommand(WEATHER_COMMANDS[parsed.data.weather]);
  return { ok: true };
});
