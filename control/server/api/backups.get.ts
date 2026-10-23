export default defineEventHandler(async (): Promise<BackupsInfo> => {
  const properties = await bsm.getProperties();
  const [worlds, plugins] = await Promise.all([
    readBackups(await getPlaces(properties)),
    // Plugins lesen darf nur ein BSM-Admin; sonst ist der Schalter unbekannt.
    bsm.plugins().catch(() => null)
  ]);
  return {
    dir: useRuntimeConfig().bsmBackupDir,
    autoBackup: plugins?.plugins?.backup_on_start?.enabled ?? null,
    worlds
  };
});
