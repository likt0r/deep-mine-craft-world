/** Ein Spieler, wie Deep Mine Control ihn aus Online-Liste, bekannten Spielern und Whitelist zusammenführt. */
export interface PlayerInfo {
  /** Gamertag in der Schreibweise aus dem Spiel, sonst wie eingetragen */
  name: string;
  /** Xbox-ID, erst bekannt, wenn der Spieler einmal da war */
  xuid: string | null;
  online: boolean;
  whitelisted: boolean;
}

export interface PlayersInfo {
  /** Online zuerst, dann nach Name */
  players: PlayerInfo[];
}
