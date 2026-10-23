import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import { z } from "zod";

/** Größte hochladbare .mcworld (gepackt). */
const MAX_UPLOAD_BYTES = 1024 ** 3;

const importQuery = z.object({
  name: z.string().trim().refine(isValidWorldName),
  type: z.enum(["normal", "flach"]),
  mode: z.enum(["creative", "survival", "adventure"])
});

/**
 * Importiert eine .mcworld auf einen freien Platz. Die Datei kommt roh im Body und wird gestreamt. Es wird
 * nichts geladen: die Welt liegt danach auf dem Platz und lässt sich wie jede andere laden.
 */
export default defineEventHandler(async (event) => {
  const place = getRouterParam(event, "n") ?? "";
  if (!/^[1-9]$|^10$/.test(place)) throw createError({ statusCode: 400, message: "Ungültiger Platz" });
  const query = importQuery.safeParse(getQuery(event));
  if (!query.success) throw createError({ statusCode: 400, message: "Ungültige Angaben" });
  if (getStoredWorld(Number(place)) !== null)
    throw createError({ statusCode: 409, message: "Platz ist belegt" });

  const { dataDir, bsmServerDir } = useRuntimeConfig();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const upload = join(dataDir, `import-${stamp}.mcworld`);
  const worldsDir = resolve(bsmServerDir, "worlds");
  const unpacked = join(worldsDir, `.import-${stamp}`);

  try {
    // Erst hochladen (kann dauern), noch ohne Sperre.
    let size = 0;
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.length;
        if (size > MAX_UPLOAD_BYTES)
          callback(createError({ statusCode: 413, message: "Die Datei ist zu groß" }));
        else callback(null, chunk);
      }
    });
    await pipeline(event.node.req, limit, createWriteStream(upload));
    if (size === 0) throw createError({ statusCode: 400, message: "Keine Datei" });

    return await runWorldOperation(async () => {
      // Während des Hochladens könnte jemand den Platz belegt haben.
      if (getStoredWorld(Number(place)) !== null)
        throw createError({ statusCode: 409, message: "Platz ist belegt" });
      let world: string;
      try {
        world = await extractMcworld(upload, unpacked);
      } catch (error) {
        if (error instanceof McworldError)
          throw createError({ statusCode: 400, message: `Keine gültige Welt: ${error.message}` });
        throw error;
      }
      const folder = newWorldFolder();
      await mkdir(worldsDir, { recursive: true });
      await rename(world, join(worldsDir, folder));
      // Den Namen zeigt Bedrock aus levelname.txt.
      await writeFile(join(worldsDir, folder, "levelname.txt"), query.data.name);
      await setStoredWorld(Number(place), {
        name: query.data.name,
        folder,
        type: query.data.type,
        mode: query.data.mode,
        difficulty: "normal",
        createdAt: new Date().toISOString()
      });
      return { ok: true, folder };
    });
  } finally {
    await rm(upload, { force: true });
    await rm(unpacked, { recursive: true, force: true });
  }
});
