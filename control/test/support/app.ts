import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

import { FAKE_PASSWORD, FAKE_USER, startFakeBsm, type FakeBsm } from "./fake-bsm";
import { createServerFixture, type ServerFixture } from "./fixture";

const entry = fileURLToPath(new URL("../../.output/server/index.mjs", import.meta.url));
const fakeNmcli = fileURLToPath(new URL("./fake-nmcli.mjs", import.meta.url));
const fakeIp = fileURLToPath(new URL("./fake-ip.mjs", import.meta.url));

export interface RunningApp {
  url: string;
  close(): Promise<void>;
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/** Startet die gebaute App (`nuxt build` vorher) gegen ein Fake-BSM und eine Fixture. */
export async function startApp(fake: FakeBsm, fixture: ServerFixture, port?: number): Promise<RunningApp> {
  port ??= await freePort();
  const child = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      NUXT_BSM_URL: fake.url,
      NUXT_BSM_USER: FAKE_USER,
      NUXT_BSM_PASSWORD: FAKE_PASSWORD,
      NUXT_BSM_SERVER_DIR: fixture.serverDir,
      NUXT_BSM_BACKUP_DIR: fixture.backupDir,
      NUXT_DATA_DIR: fixture.dataDir,
      NUXT_PROC_DIR: fixture.procDir,
      NUXT_SYS_DIR: fixture.sysDir,
      NUXT_SMART_FILE: fixture.smartFile,
      NUXT_VERSION_FILE: fixture.versionFile,
      // Statt den Rechner neu zu starten oder auszuschalten, nur eine Datei anlegen.
      NUXT_REBOOT_COMMAND: `/usr/bin/touch ${fixture.rebootMarker}`,
      NUXT_POWEROFF_COMMAND: `/usr/bin/touch ${fixture.poweroffMarker}`,
      // Fake-nmcli spielt auch iw. Sein Zustand liegt in der Fixture.
      NUXT_NMCLI_PATH: fakeNmcli,
      NUXT_IW_PATH: fakeNmcli,
      FAKE_NMCLI_STATE: fixture.nmcliState,
      NUXT_WIFI_SETTINGS_FILE: fixture.wifiSettings,
      NUXT_WIFI_RESCUE_FILE: fixture.wifiRescue,
      // Fake-ip spielt auch resolvectl.
      NUXT_IP_PATH: fakeIp,
      // Kleine Grenze, damit der Test für zu große Welten keine Gigabytes braucht.
      NUXT_WORLD_MAX_BYTES: "1000000",
      NUXT_RESOLVECTL_PATH: fakeIp,
      NUXT_COUNTDOWN_STEP_MS: "0",
      // Das Fake-BSM spielt auch die Download-Links von Mojang.
      NUXT_MOJANG_LINKS_URL: `${fake.url}/mojang/links`,
      // … und die GitHub-API (Releases von Deep Mine Control).
      NUXT_GITHUB_API: `${fake.url}/github`,
      NUXT_RULES_WAIT_MS: "4000"
    },
    stdio: ["ignore", "inherit", "inherit"]
  });

  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`App beendet mit Code ${child.exitCode}`);
    try {
      await fetch(url);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return {
    url,
    close: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", () => resolve());
        child.kill();
      })
  };
}

export interface ControlHarness {
  fake: FakeBsm;
  fixture: ServerFixture;
  app: RunningApp;
  /** Anfrage an Deep Mine Control. Wirft nicht bei Fehlerstatus. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tests prüfen die Antwort direkt
  request(path: string, init?: { method?: string; body?: unknown }): Promise<{ status: number; body: any }>;
  close(): Promise<void>;
}

/** Fixture + Fake-BSM + App in einem. Pro Testdatei einmal starten, pro Test `fake.reset()`. */
export async function startHarness(): Promise<ControlHarness> {
  const fixture = createServerFixture();
  const fake = await startFakeBsm(fixture);
  const app = await startApp(fake, fixture);
  return {
    fake,
    fixture,
    app,
    async request(path, init = {}) {
      const res = await fetch(app.url + path, {
        method: init.method ?? "GET",
        headers: init.body === undefined ? {} : { "Content-Type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body)
      });
      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        // kein JSON
      }
      return { status: res.status, body };
    },
    async close() {
      await app.close();
      await fake.close();
      fixture.remove();
    }
  };
}
