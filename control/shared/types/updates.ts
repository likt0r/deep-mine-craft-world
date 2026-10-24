/** Was sich aktualisieren lässt. Deep Mine Control („control“) kommt mit einem späteren Ticket dazu. */
export type UpdateKind = "minecraft" | "control";

/** Installierte und neueste Version von Deep Mine Control oder vom Minecraft-Server. */
export interface VersionInfo {
  /** Installierte Version, `null`: unbekannt (z. B. BSM antwortet nicht) */
  current: string | null;
  /** Neueste Version, `null`: noch nicht geprüft oder die Prüfung ist gescheitert */
  latest: string | null;
  /** Die neueste Version ist neuer als die installierte. */
  available: boolean;
  /** Version, deren Update zuletzt gescheitert ist */
  failed: string | null;
}

/**
 * Ein Update, das läuft oder gescheitert ist. Minecraft: countdown: Countdown im Chat (wenn jemand spielt);
 * updating: BSM stoppt, sichert, installiert und startet; failed: gescheitert, `error` nennt den Grund.
 */
export interface UpdateRun {
  kind: UpdateKind;
  phase: "countdown" | "updating" | "failed";
  error: string | null;
}

export interface UpdatesInfo {
  minecraft: VersionInfo;
  /** Zeitpunkt der letzten Prüfung (ISO), `null`: noch nie */
  checkedAt: string | null;
  /** Warum die letzte Prüfung gescheitert ist, z. B. ohne Internet */
  error: string | null;
  /** Laufendes oder zuletzt gescheitertes Update. Nach Erfolg wieder `null`. */
  running: UpdateRun | null;
}
