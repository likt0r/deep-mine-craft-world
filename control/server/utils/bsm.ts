import { FetchError } from "ofetch";

interface BsmSummary {
  name: string;
  status: string;
  version: string;
  player_count: number;
  players: { name: string; xuid: string }[];
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
async function bsmFetch<T>(path: string, options: { method?: "GET" | "POST"; body?: object } = {}) {
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
  /** Schreibt nur server.properties. Wirksam wird es erst nach `restart()`. */
  setProperties: (properties: Record<string, string>) =>
    bsmFetch(serverPath("properties/set"), { method: "POST", body: { properties } })
};
