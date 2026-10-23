export default defineEventHandler(async (): Promise<SystemInfo> => {
  const { procDir, sysDir, smartFile, bsmServerDir, bsmBackupDir } = useRuntimeConfig();

  const [tempC, loadPercent, memory, disk, ssd, systemSeconds, minecraftSeconds, lastBackup, summary] =
    await Promise.all([
      readCpuTemp(sysDir),
      readCpuLoad(procDir),
      readMemory(procDir),
      readDisk(bsmServerDir),
      readSsd(smartFile),
      readSystemUptime(procDir),
      readMinecraftUptime(bsmServerDir),
      readLastBackup(bsmBackupDir),
      // Ist BSM nicht erreichbar, fehlt nur die Version.
      bsm.summary().catch(() => null)
    ]);

  return {
    cpu: { tempC, loadPercent },
    memory,
    disk,
    ssd,
    // Läuft Minecraft nicht, gibt es auch keine Laufzeit.
    uptime: { systemSeconds, minecraftSeconds: summary?.status === "RUNNING" ? minecraftSeconds : null },
    minecraft: { version: summary?.version || null },
    lastBackup
  };
});
