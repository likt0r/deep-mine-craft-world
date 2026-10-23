/** Ein Backup einer Welt, wie BSM es anlegt (`.mcworld`). */
export interface BackupFile {
  /** Dateiname im Backup-Ordner */
  file: string;
  /** Zeitpunkt aus dem Dateinamen (ISO, UTC) */
  createdAt: string;
  sizeBytes: number;
}

/** Backups einer Welt. `place` ist `null` für Welten, die auf keinem Platz mehr liegen. */
export interface WorldBackups {
  place: number | null;
  name: string;
  folder: string;
  active: boolean;
  backups: BackupFile[];
}

export interface BackupsInfo {
  /** Ordner auf dem Server */
  dir: string;
  /** „Vor jedem Start sichern“ (BSM-Plugin backup_on_start). `null`: unbekannt, z. B. ohne Admin-Rechte. */
  autoBackup: boolean | null;
  /** „Sichern, wenn eine Welt beendet wird“: Weltwechsel, Minecraft stoppen, Rechner herunterfahren oder neu starten */
  onWorldEnd: boolean;
  worlds: WorldBackups[];
}
