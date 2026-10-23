import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { DEFAULT_LEVEL_NAME, type ServerFixture } from "./fixture";

/**
 * Nachgebautes BSM für Tests. Beantwortet nur die Routen, die Deep Mine Control nutzt,
 * mit denselben Formen wie BSM 4.0.1, und schreibt jeden angenommenen Aufruf mit.
 *
 * Steuerung von außen (für Playwright): GET/POST /__fake/state, POST /__fake/reset,
 * POST /__fake/expire-tokens, POST /__fake/seed-place ({ place, world }, siehe ServerFixture.seedPlace).
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
  /**
   * So spät erscheint die Ausgabe von `gamerule`. Wie bei BDS, das Befehle nach dem Start
   * erst abarbeitet, wenn es fertig geladen hat (BSM meldet da schon RUNNING).
   */
  outputDelayMs: number;
  /** BSM ist kaputt: jede Anfrage an die Server-API antwortet mit 500. */
  failing: boolean;
  /** Das BSM-Konto hat Admin-Rechte (sonst 403 auf /api/plugins). */
  admin: boolean;
  /** Plugins und ob sie an sind */
  plugins: Record<string, boolean>;
  /** Backup- und Restore-Aufgaben scheitern. */
  tasksFail: boolean;
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
    propertiesDelayMs: 0,
    outputDelayMs: 0,
    failing: false,
    admin: true,
    plugins: { backup_on_start: false },
    tasksFail: false
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

  /** Aufgaben (Backup, Restore). Erst „running“, dann fertig – oder gescheitert, wenn `tasksFail`. */
  const tasks = new Map<
    string,
    { status: string; message: string; result: null; error: { message: string } | null }
  >();
  function startTask(restart = false): string {
    const id = randomBytes(8).toString("hex");
    tasks.set(id, { status: "running", message: "läuft", result: null, error: null });
    void (async () => {
      if (restart && !fake.state.tasksFail) await boot();
      else await sleep(50);
      tasks.set(
        id,
        fake.state.tasksFail
          ? {
              status: "failed",
              message: "fehlgeschlagen",
              result: null,
              error: { message: "Fehler im Fake" }
            }
          : { status: "completed", message: "fertig", result: null, error: null }
      );
    })();
    return id;
  }

  async function boot() {
    // Wie BSM: Bei jedem Start beginnt die Ausgabedatei neu.
    writeFileSync(fixture.outputFile, "");
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
    if (path === "/__fake/seed-place") {
      const { place, world } = JSON.parse(raw);
      fixture.seedPlace(place, world);
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

    if (fake.state.failing) return bsmError(res, 500, "internal_error", "Internal Server Error");

    // --- Aufgaben und Plugins (außerhalb von /api/server/…) ---
    const taskMatch = path.match(/^\/api\/tasks\/status\/(.+)$/);
    if (taskMatch && req.method === "GET") {
      const task = tasks.get(taskMatch[1]!);
      return task
        ? send(res, 200, { id: taskMatch[1], ...task })
        : bsmError(res, 404, "not_found", "Task not found");
    }
    if (path === "/api/plugins" && req.method === "GET") {
      if (!fake.state.admin) return bsmError(res, 403, "forbidden", "Admin privileges required");
      return send(res, 200, {
        status: "success",
        plugins: Object.fromEntries(
          Object.entries(fake.state.plugins).map(([name, enabled]) => [name, { enabled }])
        )
      });
    }
    const pluginMatch = path.match(/^\/api\/plugins\/([^/]+)$/);
    if (pluginMatch && req.method === "POST") {
      if (!fake.state.admin) return bsmError(res, 403, "forbidden", "Admin privileges required");
      fake.state.plugins[pluginMatch[1]!] = (body as { enabled: boolean }).enabled;
      return send(res, 200, { status: "success", message: "ok" });
    }

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
      case "POST backup/action": {
        // Wie BSM: <Ordner der aktiven Welt>_backup_<Zeit>_<hex>.mcworld im Backup-Ordner.
        const level = fake.state.properties["level-name"] ?? "";
        const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
        const name = `${level.replace(/[:"/\\|?*]/g, "_")}_backup_${stamp}_${randomBytes(4).toString("hex")}.mcworld`;
        mkdirSync(fixture.backupDir, { recursive: true });
        if (!fake.state.tasksFail) writeFileSync(join(fixture.backupDir, name), "fake mcworld");
        return send(res, 202, { status: "accepted", message: "ok", task_id: startTask() });
      }
      case "POST restore/action": {
        const file = (body as { backup_file?: string } | null)?.backup_file ?? "";
        if (!existsSync(join(fixture.backupDir, file)))
          return bsmError(res, 404, "not_found", `Backup file not found: ${file}`);
        // BSM stoppt den Server, spielt zurück und startet ihn wieder.
        const id = startTask(true);
        return send(res, 202, { status: "accepted", message: "ok", task_id: id });
      }
      case "POST stop":
        fake.state.status = "STOPPED";
        return send(res, 200, { status: "success", server_name: SERVER, message: "ok" });
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
          const write = () => {
            const stamp = new Date()
              .toISOString()
              .replace("T", " ")
              .replace(/\.(\d+)Z$/, ":$1");
            appendFileSync(fixture.outputFile, `[${stamp} INFO] ${lines.join(", ")}\n`);
          };
          if (fake.state.outputDelayMs > 0) setTimeout(write, fake.state.outputDelayMs);
          else write();
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
