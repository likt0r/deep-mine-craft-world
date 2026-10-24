import { z } from "zod";

/** Gamertag eines Spielers (siehe `GAMERTAG`). */
export const gamertag = z.string().trim().regex(GAMERTAG);

/** Nachricht beim Kicken oder Grund beim Sperren. Leer heißt: keine. */
export const playerMessage = z
  .string()
  .refine(isValidPlayerMessage)
  .transform((text) => text.trim());

/**
 * Online-Spieler, bekannte Spieler, Whitelist und Sperren als eine Liste. Gleiche Gamertags in anderer Schreibweise
 * sind ein Spieler.
 */
export async function readPlayers(): Promise<PlayersInfo> {
  const [summary, known, allowlist, bans, properties, permissions] = await Promise.all([
    bsm.summary(),
    bsm.knownPlayers(),
    bsm.allowlist(),
    bsm.bans(),
    bsm.getProperties(),
    bsm.permissions()
  ]);
  const byName = new Map<string, PlayerInfo>();
  // Wer zuerst eingetragen wird, bestimmt die Schreibweise: erst aus dem Spiel, dann aus den Logs, dann von der Whitelist.
  const entry = (name: string, xuid?: string | null) => {
    const key = name.toLowerCase();
    let player = byName.get(key);
    if (!player)
      byName.set(
        key,
        (player = { name, xuid: null, online: false, whitelisted: false, banned: null, permission: "member" })
      );
    player.xuid ??= xuid || null;
    return player;
  };
  for (const p of summary.players) entry(p.name, p.xuid).online = true;
  for (const p of known) entry(p.name, p.xuid);
  for (const p of allowlist) entry(p.name, p.xuid).whitelisted = true;
  // Sperren gelten für die XUID. Wen BSM sonst nicht mehr kennt, der steht mit dem Namen aus der Sperre in der Liste.
  for (const ban of bans) {
    const player = [...byName.values()].find((p) => p.xuid === ban.xuid) ?? entry(ban.player_name, ban.xuid);
    player.banned = { reason: ban.reason || null, since: ban.banned_at || null };
  }

  // Ohne eigenen Eintrag gilt das Recht für neue Spieler.
  const fallback = (properties["default-player-permission-level"] ?? "member") as Permission;
  const byXuid = new Map(permissions.map((p) => [p.xuid, p.permission_level]));
  for (const player of byName.values())
    player.permission = (player.xuid && byXuid.get(player.xuid)) || fallback;

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
export async function reloadIfRunning(command: "allowlist reload" | "permission reload") {
  const { status } = await bsm.summary();
  if (mapServerState(status) === "running") await bsm.sendCommand(command);
}
