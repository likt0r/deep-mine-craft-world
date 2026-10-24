/** Recht eines Spielers: zuschauen, normal spielen, Befehle nutzen. */
export type Permission = "visitor" | "member" | "operator";

/** Ein Spieler, wie Deep Mine Control ihn aus Online-Liste, bekannten Spielern, Whitelist und Sperren zusammenführt. */
export interface PlayerInfo {
  /** Gamertag in der Schreibweise aus dem Spiel, sonst wie eingetragen */
  name: string;
  /** Xbox-ID, erst bekannt, wenn der Spieler einmal da war */
  xuid: string | null;
  online: boolean;
  whitelisted: boolean;
  /** Gesperrt, mit Grund und Zeitpunkt aus BSM (ohne Zeitzone), sonst `null` */
  banned: { reason: string | null; since: string | null } | null;
  /** Eigener Eintrag in permissions.json, sonst das Recht für neue Spieler */
  permission: Permission;
}

export interface PlayersInfo {
  /** `allow-list`: Nur Spieler auf der Whitelist können beitreten */
  closed: boolean;
  /** Recht für neue Spieler; Operator wird als Mitglied gemeldet */
  newPlayers: "visitor" | "member";
  /** `online-mode=false`: Whitelist und Sperren lassen sich umgehen */
  offlineMode: boolean;
  /** Online zuerst, dann nach Name */
  players: PlayerInfo[];
}
