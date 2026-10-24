import { FetchError } from "ofetch";

interface BsmSummary {
  name: string;
  status: string;
  version: string;
  player_count: number;
  players: { name: string; xuid: string }[];
}

/** Hintergrundaufgabe in BSM (Backup, Restore, Update). */
interface BsmTask {
  status: "queued" | "running" | "completed" | "failed" | "cancelling" | "cancelled";
  message: string;
  error?: { message?: string } | null;
}

interface BsmProperties {
  properties: Record<string, string>;
}

// Gemeinsames Login für gleichzeitige Anfragen, damit nach einem 401 nur einmal neu angemeldet wird.
let token: Promise<string> | null = null;

async function login(): Promise<string> {
  const { bsmUrl, bsmUser, bsmPassword } = useRuntimeConfig();
  const res = await $fetch<{ access_token: string }>("/auth/token", {
    baseURL: bsmUrl,
    method: "POST",
    body: new URLSearchParams({ username: bsmUser, password: bsmPassword })
  });
  return res.access_token;
}

/** Neues Login starten. Schlägt es fehl, versucht die nächste Anfrage es erneut. */
function freshLogin() {
  const pending = login();
  pending.catch(() => {
    if (token === pending) token = null;
  });
  return pending;
}

/** Ruft die BSM-API auf. Bei 401 einmal neu anmelden und wiederholen. */
async function bsmFetch<T>(
  path: string,
  options: { method?: "GET" | "POST" | "DELETE"; body?: object } = {}
) {
  const { bsmUrl } = useRuntimeConfig();
  const call = (current: string) =>
    $fetch<T>(path, {
      baseURL: bsmUrl,
      method: options.method ?? "GET",
      body: options.body,
      headers: { Authorization: `Bearer ${current}` }
    });

  const used = (token ??= freshLogin());
  try {
    return await call(await used);
  } catch (error) {
    if (!(error instanceof FetchError) || error.statusCode !== 401) throw error;
    if (token === used) token = freshLogin();
    return await call(await token);
  }
}

function serverPath(action: string) {
  return `/api/server/${encodeURIComponent(useRuntimeConfig().bsmServer)}/${action}`;
}

export function mapServerState(bsmStatus: string): ServerState {
  if (bsmStatus === "RUNNING") return "running";
  if (["STARTING", "STOPPING", "UPDATING", "INSTALLING"].includes(bsmStatus)) return "starting";
  return "stopped";
}

export const bsm = {
  summary: () => bsmFetch<BsmSummary>(serverPath("summary")),
  start: () => bsmFetch(serverPath("start"), { method: "POST" }),
  restart: () => bsmFetch(serverPath("restart"), { method: "POST" }),
  /** BSM antwortet erst, wenn der Server aus ist. */
  stop: () => bsmFetch(serverPath("stop"), { method: "POST" }),
  sendCommand: (command: string) =>
    bsmFetch(serverPath("send_command"), { method: "POST", body: { command } }),
  getProperties: async () => (await bsmFetch<BsmProperties>(serverPath("properties/get"))).properties,
  /** Sichert die aktive Welt (Aufgabe im Hintergrund). */
  backupWorld: () =>
    bsmFetch<{ task_id: string }>(serverPath("backup/action"), {
      method: "POST",
      body: { backup_type: "world" }
    }),
  /** Spielt ein Backup in die aktive Welt zurück; BSM stoppt und startet den Server dafür. */
  restoreWorld: (backupFile: string) =>
    bsmFetch<{ task_id: string }>(serverPath("restore/action"), {
      method: "POST",
      body: { restore_type: "world", backup_file: backupFile }
    }),
  /**
   * Aktualisiert den Bedrock-Server auf die neueste Version (Aufgabe im Hintergrund). BSM stoppt ihn dafür,
   * sichert alles, installiert und startet ihn wieder.
   */
  updateServer: () => bsmFetch<{ task_id: string }>(serverPath("update"), { method: "POST" }),
  taskStatus: (taskId: string) => bsmFetch<BsmTask>(`/api/tasks/status/${encodeURIComponent(taskId)}`),
  /** Plugins lesen und schalten darf nur ein BSM-Admin. */
  plugins: () => bsmFetch<{ plugins?: Record<string, { enabled?: boolean }> }>("/api/plugins"),
  setPlugin: (name: string, enabled: boolean) =>
    bsmFetch(`/api/plugins/${encodeURIComponent(name)}`, { method: "POST", body: { enabled } }),
  /** Schreibt nur server.properties. Wirksam wird es erst nach `restart()`. */
  setProperties: (properties: Record<string, string>) =>
    bsmFetch(serverPath("properties/set"), { method: "POST", body: { properties } }),
  /** Whitelist aus allowlist.json. `xuid` steht dort erst, wenn der Spieler einmal da war. */
  allowlist: () =>
    bsmFetch<{ players: { name: string; xuid?: string | null }[] }>(serverPath("allowlist/get")).then(
      (r) => r.players
    ),
  /** Schreibt nur allowlist.json. Der laufende Server liest sie erst nach `allowlist reload`. */
  allowlistAdd: (name: string) =>
    bsmFetch(serverPath("allowlist/add"), {
      method: "POST",
      body: { players: [name], ignoresPlayerLimit: false }
    }),
  allowlistRemove: (name: string) =>
    bsmFetch(serverPath("allowlist/remove"), { method: "DELETE", body: { players: [name] } }),
  /** Gesperrte Spieler. BSM kickt sie bei jedem Spielerscan. `banned_at` ohne Zeitzone, z. B. „2026-10-24T12:00:00“. */
  bans: () =>
    bsmFetch<{
      bans: { player_name: string; xuid: string; reason: string | null; banned_at: string | null }[];
    }>(serverPath("bans/get")).then((r) => r.bans),
  ban: (name: string, xuid: string, reason: string | null) =>
    bsmFetch(serverPath("bans/add"), { method: "POST", body: { player_name: name, xuid, reason } }),
  unban: (xuid: string) => bsmFetch(serverPath("bans/remove"), { method: "DELETE", body: { xuid } }),
  /** Alle Spieler, die BSM je in den Server-Logs gesehen hat, mit XUID. */
  knownPlayers: () =>
    bsmFetch<{ players: { name: string; xuid: string }[] }>("/api/players/get").then((r) => r.players),
  /** Rechte aus permissions.json. */
  permissions: () =>
    bsmFetch<{
      permissions: { xuid: string; name: string; permission_level: Permission }[];
    }>(serverPath("permissions/get")).then((r) => r.permissions),
  /** Setzt den Eintrag dieser XUID in permissions.json. Der laufende Server liest sie erst nach `permission reload`. */
  setPermission: (xuid: string, name: string, level: Permission) =>
    bsmFetch(serverPath("permissions/set"), {
      method: "POST",
      body: { permissions: [{ xuid, name, permission_level: level }] }
    })
};
