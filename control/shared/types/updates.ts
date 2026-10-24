/** Was sich aktualisieren lässt. Deep Mine Control („control“) kommt mit einem späteren Ticket dazu. */
export type UpdateKind = "minecraft" | "control";

/** Installierte und neueste Version von Deep Mine Control oder vom Minecraft-Server. */
export interface VersionInfo {
  /** Installierte Version, `null`: unbekannt (z. B. BSM antwortet nicht) */
  current: string | null;
  /** Neueste Version, `null`: noch nie geprüft oder die Prüfung ist gescheitert */
  latest: string | null;
  /** Die neueste Version ist neuer als die installierte. */
  available: boolean;
  /**
   * Die neueste Version, deren Update gescheitert ist. Autoupdate versucht sie nicht noch einmal, der Knopf
   * („Erneut versuchen“) schon. Gibt es eine neuere oder klappt ein Update, ist sie wieder `null`.
   */
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

/** Autoupdate je Teil an oder aus, Standard beide aus. Den Schalter für „control“ zeigt die Seite noch nicht. */
export interface AutoUpdateSettings {
  control: boolean;
  minecraft: boolean;
}

export interface UpdatesInfo {
  minecraft: VersionInfo;
  /** Zeitpunkt der letzten Prüfung (ISO), `null`: noch nie */
  checkedAt: string | null;
  /** Warum die letzte Prüfung gescheitert ist, z. B. ohne Internet */
  error: string | null;
  /** Laufendes oder zuletzt gescheitertes Update. Nach Erfolg wieder `null`. */
  running: UpdateRun | null;
  auto: AutoUpdateSettings;
}

/**
 * Warum der Autoupdate-Lauf nichts installiert hat (stabile Schlüssel, z. B. für Logs):
 * - `off`: Autoupdate ist aus
 * - `check-failed`: neueste oder installierte Version unbekannt (Mojang oder BSM nicht erreichbar)
 * - `up-to-date`: nichts neu
 * - `failed`: das Update auf die neueste Version ist schon gescheitert, nur der Knopf versucht es erneut
 * - `players-online`: jemand spielt
 * - `world-operation`: gerade läuft ein Weltvorgang (auch ein Update)
 */
export type AutoUpdateSkip =
  "off" | "check-failed" | "up-to-date" | "failed" | "players-online" | "world-operation";

/**
 * Ergebnis von `POST /api/updates/auto`. `minecraft`: Das Update auf `version` läuft jetzt im Hintergrund
 * (wie per Knopf). `none`: nichts gestartet, `reason` sagt warum.
 */
export type AutoUpdateResult =
  { action: "none"; reason: AutoUpdateSkip } | { action: "minecraft"; version: string };
