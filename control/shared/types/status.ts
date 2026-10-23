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
}

/** Ein Weltwechsel: erst 10 s Countdown im Chat, dann startet der Server neu. */
export interface WorldSwitch {
  place: number;
  /** Anzeigename der Welt, die kommt */
  world: string;
  phase: "countdown" | "restart";
}
