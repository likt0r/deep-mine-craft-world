/**
 * Aufgerufen von der systemd-Unit deep-mine-backup-on-shutdown, bevor der Rechner herunterfährt oder neu
 * startet (BSM und Minecraft laufen da noch). Sichert die aktive Welt, wenn „Beim Herunterfahren sichern“ an
 * ist (Sichern, wenn eine Welt beendet wird) und Minecraft läuft, und antwortet erst danach.
 */
export default defineEventHandler(async () => {
  if (!(await readBackupSettings()).onWorldEnd) return { backup: false, reason: "ausgeschaltet" };
  if (isWorldOperationRunning()) return { backup: false, reason: "Weltvorgang läuft" };
  const summary = await bsm.summary();
  // Ohne laufendes Minecraft hat sich die Welt seit dem letzten Stopp nicht geändert.
  if (summary.status !== "RUNNING") return { backup: false, reason: "Minecraft läuft nicht" };

  await runWorldOperation(backupActiveWorld);
  return { backup: true };
});
