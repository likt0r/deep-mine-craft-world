export default defineEventHandler(async () => {
  // Ein Weltvorgang startet den Server gleich neu, ein Stopp käme dazwischen.
  if (isWorldOperationRunning())
    throw createError({ statusCode: 409, message: "Gerade läuft ein Weltvorgang" });

  const { onWorldEnd } = await readBackupSettings();
  // Im Hintergrund: erst sichern (wenn eingeschaltet), dann stoppen. Die Seite sieht den Fortschritt über den Status.
  startWorldOperation(null, async () => {
    if (onWorldEnd) {
      // Ein gescheitertes Backup darf das Stoppen nicht verhindern.
      await backupActiveWorld().catch((error) =>
        console.error("Backup vor dem Stoppen fehlgeschlagen:", error)
      );
    }
    await bsm.stop();
  });
  return { ok: true };
});
