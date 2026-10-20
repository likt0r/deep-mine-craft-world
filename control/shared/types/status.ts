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
}
