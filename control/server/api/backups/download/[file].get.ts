import { createReadStream } from "node:fs";

/** Lädt ein Backup herunter, z. B. um es auf dem Tablet in Minecraft zu öffnen. */
export default defineEventHandler((event) => {
  const file = getRouterParam(event, "file") ?? "";
  if (!isBackupName(file)) throw createError({ statusCode: 400, message: "Ungültiger Backup-Name" });
  const path = backupPath(file);
  if (!path) throw createError({ statusCode: 404, message: "Backup nicht gefunden" });

  setResponseHeaders(event, {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${file}"`
  });
  return sendStream(event, createReadStream(path));
});
