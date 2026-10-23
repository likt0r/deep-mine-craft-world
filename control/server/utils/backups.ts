import { existsSync } from "node:fs";
import { readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

/** Wie BSM den Anfang eines Backup-Namens bildet: Weltordner, Sonderzeichen durch „_“ ersetzt. */
export function backupPrefix(folder: string): string {
  return folder.replace(/[:"/\\|?*]/g, "_") + "_backup_";
}

/** `<präfix>_backup_<JJJJMMTT>_<HHMMSS>[_<hex>].mcworld`, nur ein Dateiname ohne Pfad. */
const BACKUP_NAME = /^[^/\\]+_backup_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:_[a-f0-9]+)?\.mcworld$/;

export function isBackupName(file: string): boolean {
  return BACKUP_NAME.test(file) && !file.includes("..");
}

function createdAt(file: string): string {
  const [, y, mo, d, h, mi, s] = file.match(BACKUP_NAME)!;
  return new Date(Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +s!)).toISOString();
}

/** Pfad eines Backups, nur wenn der Name passt und die Datei im Backup-Ordner liegt. */
export function backupPath(file: string): string | null {
  if (!isBackupName(file)) return null;
  const dir = resolve(useRuntimeConfig().bsmBackupDir);
  const path = resolve(dir, file);
  return path.startsWith(dir + sep) && existsSync(path) ? path : null;
}

/** Alle Backups, nach Welt sortiert: Plätze 1–10, dann Welten ohne Platz. Neueste zuerst. */
export async function readBackups(places: Place[]): Promise<WorldBackups[]> {
  const dir = useRuntimeConfig().bsmBackupDir;
  const files = (await readdir(dir).catch(() => [] as string[])).filter(isBackupName);
  const details = await Promise.all(
    files.map(async (file) => ({
      file,
      createdAt: createdAt(file),
      sizeBytes: (await stat(join(dir, file))).size
    }))
  );

  const worlds: WorldBackups[] = places
    .filter((p) => p.world)
    .map((p) => ({
      place: p.place,
      name: p.world!.name,
      folder: p.world!.folder,
      active: p.active,
      backups: []
    }));
  for (const backup of details) {
    let world = worlds.find((w) => backup.file.startsWith(backupPrefix(w.folder)));
    if (!world) {
      // Welt liegt auf keinem Platz mehr: der Ordnername steht vor „_backup_“.
      const folder = backup.file.slice(0, backup.file.lastIndexOf("_backup_"));
      world = worlds.find((w) => w.place === null && w.folder === folder);
      if (!world) worlds.push((world = { place: null, name: folder, folder, active: false, backups: [] }));
    }
    world.backups.push(backup);
  }
  for (const world of worlds) world.backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return worlds;
}

/**
 * Einstellungen von Deep Mine Control zu Backups. `onWorldEnd`: sichern, wenn eine Welt beendet wird
 * (Weltwechsel, Minecraft stoppen, Rechner herunterfahren oder neu starten). Ohne Datei an.
 */
export interface BackupSettings {
  onWorldEnd: boolean;
}

function settingsFile() {
  return join(useRuntimeConfig().dataDir, "backup-settings.json");
}

export async function readBackupSettings(): Promise<BackupSettings> {
  try {
    const stored = JSON.parse(await readFile(settingsFile(), "utf8"));
    return { onWorldEnd: stored.onWorldEnd !== false };
  } catch {
    return { onWorldEnd: true };
  }
}

export async function writeBackupSettings(settings: BackupSettings): Promise<void> {
  await writeFile(settingsFile(), JSON.stringify(settings) + "\n");
}

/** Sichert die aktive Welt über BSM und wartet, bis das Backup fertig ist. BSM kann nur die aktive Welt sichern. */
export async function backupActiveWorld(): Promise<void> {
  const { task_id } = await bsm.backupWorld();
  await waitForTask(task_id);
}

/** Wartet, bis eine BSM-Aufgabe fertig ist. Wirft, wenn sie scheitert. */
export async function waitForTask(taskId: string, timeoutMs = 300_000): Promise<void> {
  const until = Date.now() + timeoutMs;
  // Erst schnell nachfragen, dann seltener: kurze Aufgaben sind so gleich fertig, lange belasten BSM nicht.
  let wait = 50;
  while (Date.now() < until) {
    const task = await bsm.taskStatus(taskId);
    if (task.status === "completed") return;
    if (task.status === "failed" || task.status === "cancelled")
      throw new Error(`BSM-Aufgabe ${task.status}: ${task.error?.message ?? task.message}`);
    await new Promise((r) => setTimeout(r, wait));
    wait = Math.min(wait * 2, 500);
  }
  throw new Error("BSM-Aufgabe dauert zu lange");
}

/**
 * Spielt ein Backup in den Ordner einer Welt zurück, die gerade nicht aktiv ist. BSM kann das nicht
 * (es spielt immer in die aktive Welt). Erst daneben entpacken und prüfen, dann tauschen: Scheitert etwas,
 * bleibt die Welt wie sie war.
 */
export async function restoreInactiveWorld(backup: string, folder: string): Promise<void> {
  const { bsmServerDir } = useRuntimeConfig();
  const worldsDir = resolve(bsmServerDir, "worlds");
  const target = resolve(worldsDir, folder);
  if (!target.startsWith(worldsDir + sep)) throw new Error("Ungültiger Weltordner");

  const stamp = Date.now();
  const unpacked = join(worldsDir, `.restore-${stamp}`);
  const old = join(worldsDir, `.old-${stamp}`);
  try {
    const world = await extractMcworld(backup, unpacked);
    if (existsSync(target)) await rename(target, old);
    await rename(world, target);
  } finally {
    await rm(unpacked, { recursive: true, force: true });
    await rm(old, { recursive: true, force: true });
  }
}
