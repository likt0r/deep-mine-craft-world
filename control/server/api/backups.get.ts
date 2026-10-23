export default defineEventHandler(async (): Promise<BackupsInfo> => {
  const properties = await bsm.getProperties();
  const [worlds, plugins, settings] = await Promise.all([
    readBackups(await getPlaces(properties)),
    // Plugins lesen darf nur ein BSM-Admin; sonst ist der Schalter unbekannt.
    bsm.plugins().catch(() => null),
    readBackupSettings()
  ]);
  return {
    dir: useRuntimeConfig().bsmBackupDir,
    autoBackup: plugins?.plugins?.backup_on_start?.enabled ?? null,
    onWorldEnd: settings.onWorldEnd,
    worlds
  };
});
