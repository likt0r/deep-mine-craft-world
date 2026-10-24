import { z } from "zod";

/**
 * Gamertag wie bei Xbox: Buchstaben, Ziffern, Leerzeichen, optional `#1234`. Er kommt in Anführungszeichen in
 * Konsolenbefehle, deshalb sind keine erlaubt.
 */
export const gamertag = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9 ]{1,16}(#\d{1,4})?$/);

/** Online-Spieler, bekannte Spieler und Whitelist als eine Liste. Gleiche Gamertags in anderer Schreibweise sind ein Spieler. */
export async function readPlayers(): Promise<PlayersInfo> {
  const [summary, known, allowlist, properties] = await Promise.all([
    bsm.summary(),
    bsm.knownPlayers(),
    bsm.allowlist(),
    bsm.getProperties()
  ]);
  const byName = new Map<string, PlayerInfo>();
  // Wer zuerst eingetragen wird, bestimmt die Schreibweise: erst aus dem Spiel, dann aus den Logs, dann von der Whitelist.
  const entry = (name: string, xuid?: string | null) => {
    const key = name.toLowerCase();
    let player = byName.get(key);
    if (!player) byName.set(key, (player = { name, xuid: null, online: false, whitelisted: false }));
    player.xuid ??= xuid || null;
    return player;
  };
  for (const p of summary.players) entry(p.name, p.xuid).online = true;
  for (const p of known) entry(p.name, p.xuid);
  for (const p of allowlist) entry(p.name, p.xuid).whitelisted = true;

  const players = [...byName.values()].sort(
    (a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, "de")
  );
  return {
    closed: properties["allow-list"] === "true",
    // Operator ist für neue Spieler bewusst nicht wählbar.
    newPlayers: properties["default-player-permission-level"] === "visitor" ? "visitor" : "member",
    offlineMode: properties["online-mode"] === "false",
    players
  };
}

/** Schickt einen `… reload`, damit der laufende Server geänderte Listen liest. Gestoppt liest er sie beim Start. */
export async function reloadIfRunning(command: "allowlist reload") {
  const { status } = await bsm.summary();
  if (mapServerState(status) === "running") await bsm.sendCommand(command);
}
