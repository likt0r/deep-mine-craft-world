import { appendFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { DEFAULT_LEVEL_NAME, type ServerFixture } from "./fixture";

/**
 * Nachgebautes BSM für Tests. Beantwortet nur die Routen, die Deep Mine Control nutzt,
 * mit denselben Formen wie BSM 4.0.1, und schreibt jeden angenommenen Aufruf mit.
 *
 * Steuerung von außen (für Playwright): GET/POST /__fake/state, POST /__fake/reset,
 * POST /__fake/expire-tokens.
 */

export const FAKE_USER = "deep-mine-control";
export const FAKE_PASSWORD = "test-passwort";
const SERVER = "Bedrock";

export interface FakeState {
  /** BSM-Status: RUNNING, STARTING, STOPPED, … */
  status: string;
  players: string[];
  properties: Record<string, string>;
  /**
   * Spielregeln, die auf `gamerule` ohne Argumente in die Server-Ausgabe geschrieben werden,
   * mit Namen wie BDS sie ausgibt (camelCase). `null`: keine Ausgabe.
   */
  gamerules: Record<string, string> | null;
  /** So lange bleibt der Server beim Start/Neustart in STARTING. */
  startDelayMs: number;
  /** So lange braucht properties/get. Hält einen Weltvorgang offen, der die Properties liest. */
  propertiesDelayMs: number;
}

export interface FakeCall {
  method: string;
  path: string;
  body: unknown;
}

export interface FakeBsm {
  url: string;
  state: FakeState;
  calls: FakeCall[];
  /** Nur die Konsolenbefehle, in Reihenfolge. */
  commands(): string[];
  reset(): void;
  expireTokens(): void;
  close(): Promise<void>;
}

function initialState(): FakeState {
  return {
    status: "RUNNING",
    players: [],
    properties: {
      "level-name": DEFAULT_LEVEL_NAME,
      gamemode: "creative",
      difficulty: "easy",
      "level-type": "DEFAULT",
      "level-seed": ""
    },
    gamerules: null,
    startDelayMs: 0,
    propertiesDelayMs: 0
  };
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function bsmError(res: ServerResponse, status: number, code: string, message: string) {
  send(res, status, { error: { code, message, details: {} } });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function startFakeBsm(fixture: ServerFixture, port = 0): Promise<FakeBsm> {
  const tokens = new Set<string>();
  let tokenCounter = 0;

  const fake: FakeBsm = {
    url: "",
    state: initialState(),
    calls: [],
    commands: () =>
      fake.calls
        .filter((c) => c.path.endsWith("/send_command"))
        .map((c) => (c.body as { command: string }).command),
    reset() {
      fake.state = initialState();
      fake.calls.length = 0;
      tokens.clear();
      fixture.reset();
    },
    expireTokens: () => tokens.clear(),
    close: () => new Promise((resolve) => server.close(() => resolve()))
  };

  async function boot() {
    fake.state.status = "STARTING";
    await sleep(fake.state.startDelayMs);
    fake.state.status = "RUNNING";
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://fake");
    const path = url.pathname;
    const raw = await readBody(req);

    // --- Steuerung für Tests ---
    if (path === "/__fake/state" && req.method === "GET")
      return send(res, 200, { ...fake.state, calls: fake.calls });
    if (path === "/__fake/state" && req.method === "POST") {
      Object.assign(fake.state, JSON.parse(raw || "{}"));
      return send(res, 200, fake.state);
    }
    if (path === "/__fake/reset") {
      fake.reset();
      return send(res, 200, {});
    }
    if (path === "/__fake/expire-tokens") {
      fake.expireTokens();
      return send(res, 200, {});
    }

    let body: unknown = raw;
    if (req.headers["content-type"]?.includes("application/json")) body = JSON.parse(raw || "null");

    // --- Anmeldung ---
    if (path === "/auth/token" && req.method === "POST") {
      fake.calls.push({ method: req.method ?? "GET", path, body });
      const form = new URLSearchParams(raw);
      if (form.get("username") !== FAKE_USER || form.get("password") !== FAKE_PASSWORD) {
        return bsmError(res, 401, "unauthorized", "Incorrect username or password");
      }
      const token = `token-${++tokenCounter}`;
      tokens.add(token);
      return send(res, 200, { access_token: token, token_type: "bearer" });
    }

    const auth = req.headers.authorization ?? "";
    if (!tokens.has(auth.replace(/^Bearer /, "")))
      return bsmError(res, 401, "unauthorized", "Not authenticated");

    // Abgewiesene Anfragen erreichen BSM nicht und werden deshalb nicht mitgeschrieben.
    fake.calls.push({ method: req.method ?? "GET", path, body });

    const prefix = `/api/server/${SERVER}/`;
    if (!path.startsWith(prefix)) return bsmError(res, 404, "not_found", "Not Found");
    const action = `${req.method} ${path.slice(prefix.length)}`;

    switch (action) {
      case "GET summary":
        return send(res, 200, {
          name: SERVER,
          status: fake.state.status,
          version: "1.26.52.3",
          players_available: true,
          player_count: fake.state.players.length,
          players: fake.state.players.map((name, i) => ({ name, xuid: String(1000 + i) }))
        });
      case "POST start":
      case "POST restart":
        await boot();
        return send(res, 200, { status: "success", server_name: SERVER, message: "ok" });
      case "POST send_command": {
        const command = (body as { command?: string } | null)?.command;
        if (!command) return bsmError(res, 422, "validation_error", "API data failed validation.");
        if (fake.state.status !== "RUNNING")
          return bsmError(res, 409, "server_not_running", "Server is not running");
        if (command === "gamerule" && fake.state.gamerules) {
          const lines = Object.entries(fake.state.gamerules).map(([k, v]) => `${k} = ${v}`);
          // Wie BDS 1.26: eine Zeile, Regelnamen in camelCase, z. B. "doDayLightCycle = true".
          const stamp = new Date()
            .toISOString()
            .replace("T", " ")
            .replace(/\.(\d+)Z$/, ":$1");
          appendFileSync(fixture.outputFile, `[${stamp} INFO] ${lines.join(", ")}\n`);
        }
        return send(res, 200, {
          status: "success",
          server_name: SERVER,
          message: `Command '${command}' sent`
        });
      }
      case "GET properties/get":
        await sleep(fake.state.propertiesDelayMs);
        return send(res, 200, { status: "success", properties: fake.state.properties });
      case "POST properties/set": {
        const properties = (body as { properties?: Record<string, string> } | null)?.properties;
        if (!properties) return bsmError(res, 422, "validation_error", "API data failed validation.");
        Object.assign(fake.state.properties, properties);
        return send(res, 200, { status: "success", server_name: SERVER, message: "ok" });
      }
      default:
        return bsmError(res, 404, "not_found", "Not Found");
    }
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  fake.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return fake;
}
