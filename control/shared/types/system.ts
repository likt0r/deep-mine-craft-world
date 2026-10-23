/**
 * Zustand von Rechner, Platte und Minecraft für den Bereich System.
 * Jeder Wert, der sich nicht lesen lässt, ist `null`.
 */
export interface SystemInfo {
  cpu: {
    /** Höchste Temperatur der CPU-Kerne in °C */
    tempC: number | null;
    /** Load-Average der letzten Minute geteilt durch die Zahl der Kerne, in % (kann über 100 liegen) */
    loadPercent: number | null;
  };
  memory: { totalBytes: number; availableBytes: number } | null;
  /** Dateisystem mit dem Server-Ordner */
  disk: { totalBytes: number; availableBytes: number } | null;
  /** SMART-Werte der Systemplatte, geschrieben vom Timer aus install.sh */
  ssd: { model: string | null; healthy: boolean; wearPercent: number | null } | null;
  uptime: { systemSeconds: number | null; minecraftSeconds: number | null };
  minecraft: { version: string | null };
  /** Zeitpunkt der neuesten Sicherung (ISO), `null` wenn es keine gibt */
  lastBackup: string | null;
}
