import { z } from "zod";

const ipv4 = z.string().refine(isIPv4);
const settingSchema = z
  .discriminatedUnion("mode", [
    z.object({ mode: z.literal("dhcp") }),
    z.object({
      mode: z.literal("static"),
      address: ipv4,
      prefix: z.number().int(),
      gateway: ipv4,
      dns: z.array(ipv4).max(3)
    })
  ])
  .refine((s) => s.mode === "dhcp" || isValidStaticIPv4(s.address, s.prefix, s.gateway));

export default defineEventHandler(async (event) => {
  const body = settingSchema.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Ungültige Netzwerkeinstellung" });

  const { change } = await readEthernet();
  if (isEthernetChangeOpen(change))
    throw createError({ statusCode: 409, message: "Die letzte Änderung ist noch nicht bestätigt" });

  return { id: await requestEthernet(body.data) };
});
