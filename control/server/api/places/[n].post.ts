import { z } from "zod";

const createRequest = z.object({
  /** Anzeigename der neuen Welt; er landet auch in Chat-Nachrichten. */
  name: z.string().trim().refine(isValidWorldName),
  /** Welttyp: normal oder flach. */
  type: z.enum(["normal", "flach"]),
  /** Startmodus, wie `server.properties` ihn speichert. */
  mode: z.enum(["creative", "survival", "adventure"])
});

export default defineEventHandler(async (event) => {
  const place = getRouterParam(event, "n") ?? "";
  if (!/^[1-9]$|^10$/.test(place)) throw createError({ statusCode: 400, message: "Ungültiger Platz" });

  const body = createRequest.safeParse(await readBody(event).catch(() => null));
  if (!body.success) throw createError({ statusCode: 400, message: "Ungültige Angaben" });

  // Läuft schon ein Weltvorgang, wird hier gar nichts angelegt.
  if (isWorldOperationRunning())
    throw createError({ statusCode: 409, message: "Gerade läuft schon ein Weltvorgang" });

  // Belegter Platz: verweigert, bevor irgendetwas angelegt wird.
  if (getStoredWorld(Number(place)) !== null)
    throw createError({ statusCode: 409, message: "Platz ist belegt" });

  const world: WorldInfo = {
    name: body.data.name,
    folder: newWorldFolder(),
    type: body.data.type,
    mode: body.data.mode,
    // Jede neue Welt startet mit normalen Minecraft-Regeln.
    difficulty: "normal",
    createdAt: new Date().toISOString()
  };

  // Wie beim Laden im Hintergrund: die Antwort kommt sofort, die Seite folgt über `busy`.
  startWorldOperation({ place: Number(place), world: world.name }, async () => {
    // Erst unter der Sperre eintragen, damit bei einem gleichzeitigen Weltvorgang (409) nichts liegen bleibt.
    await setStoredWorld(Number(place), world);
    await switchWorld(world.name, {
      "level-name": world.folder,
      "level-type": world.type === "flach" ? "FLAT" : "DEFAULT",
      "level-seed": "",
      gamemode: world.mode,
      difficulty: world.difficulty
    });
  });

  return { ok: true };
});
