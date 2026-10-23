import { z } from "zod";

const restoreSchema = z.object({ file: z.string() });

/**
 * Spielt ein Backup zurück. Aktive Welt: über BSM (stoppt und startet den Server). Andere Welt: direkt in
 * ihren Weltordner, denn BSM spielt immer in die aktive Welt zurück.
 */
export default defineEventHandler(async (event) => {
  const body = restoreSchema.safeParse(await readBody(event).catch(() => null));
  if (!body.success || !isBackupName(body.data.file))
    throw createError({ statusCode: 400, message: "Ungültiger Backup-Name" });
  const path = backupPath(body.data.file);
  if (!path) throw createError({ statusCode: 404, message: "Backup nicht gefunden" });

  const properties = await bsm.getProperties();
  const levelName = properties["level-name"] ?? "";
  const places = await getPlaces(properties);
  const world = places.find((p) => p.world && body.data.file.startsWith(backupPrefix(p.world.folder)))?.world;

  if (levelName && body.data.file.startsWith(backupPrefix(levelName))) {
    startWorldOperation(null, async () => {
      const { task_id } = await bsm.restoreWorld(body.data.file);
      await waitForTask(task_id);
    });
    return { ok: true, restart: true };
  }
  if (!world) throw createError({ statusCode: 409, message: "Diese Welt liegt auf keinem Platz" });

  await runWorldOperation(() => restoreInactiveWorld(path, world.folder));
  return { ok: true, restart: false };
});
