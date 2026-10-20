import { existsSync, readdirSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";

export default defineEventHandler(async (event) => {
  const place = getRouterParam(event, "n") ?? "";
  if (!/^[1-9]$|^10$/.test(place)) throw createError({ statusCode: 400, message: "Ungültiger Platz" });

  // Löschen ist kurz, läuft aber wie Laden und Anlegen unter der Sperre für Weltvorgänge.
  return runWorldOperation(async () => {
    const world = getStoredWorld(Number(place));
    if (!world) throw createError({ statusCode: 404, message: "Platz ist leer" });

    const config = useRuntimeConfig();
    const levelName = (await bsm.getProperties())["level-name"] ?? "";
    if (world.folder === levelName)
      throw createError({ statusCode: 409, message: "Die aktive Welt kann nicht gelöscht werden" });

    // Geschützt vor einem manipulierten Ordnereintrag, der über den Weltenordner hinauszeigt.
    const worldsDir = resolve(config.bsmServerDir, "worlds");
    const worldDir = resolve(worldsDir, world.folder);
    if (worldDir === worldsDir || !worldDir.startsWith(worldsDir + sep))
      throw createError({ statusCode: 400, message: "Ungültiger Weltordner" });

    rmSync(worldDir, { recursive: true, force: true });

    // Backups dieser Welt, benannt wie sie BSM anlegt. Backups anderer Welten bleiben.
    if (existsSync(config.bsmBackupDir)) {
      for (const file of readdirSync(config.bsmBackupDir)) {
        if (file.startsWith(`${world.folder}_backup_`))
          rmSync(join(config.bsmBackupDir, file), { recursive: true, force: true });
      }
    }

    await setStoredWorld(Number(place), null);
    return { ok: true };
  });
});
