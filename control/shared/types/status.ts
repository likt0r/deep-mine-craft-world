/** Grobe Sicht der Oberfläche auf den Bedrock-Server. */
export type ServerState = "running" | "starting" | "stopped";

export interface Status {
  state: ServerState;
  /** Anzeigename der aktiven Welt */
  world: string;
  /** Online-Spieler (Gamertags) */
  players: string[];
  /** Ein Weltvorgang läuft gerade, Knöpfe sind gesperrt. */
  busy: boolean;
  /** Ziel des laufenden Weltwechsels (Laden oder Anlegen), sonst `null`. */
  switching: WorldSwitch | null;
  /** Was gerade aktualisiert wird, sonst `null`. */
  updating: UpdateKind | null;
}

/** Ein Weltwechsel: erst 10 s Countdown im Chat (wenn jemand spielt), dann sichern (wenn eingestellt), dann Neustart. */
export interface WorldSwitch {
  place: number;
  /** Anzeigename der Welt, die kommt */
  world: string;
  /** countdown: Countdown im Chat; backup: die bisherige Welt wird gesichert; restart: Server startet neu */
  phase: "countdown" | "backup" | "restart";
}
