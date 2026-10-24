import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Der root-Helfer server/update.py gegen ein nachgebautes GitHub (Release-JSON, Pakete, Prüfsummen) und den
 * Status von Deep Mine Control, beides auf einem lokalen HTTP-Server. apt-get, systemd-run und systemctl sind
 * Shell-Skripte, die ihre Aufrufe mitschreiben. apt-get schreibt die Versionsdatei um, wie es das echte Paket tut.
 */
const helper = fileURLToPath(new URL("../../../server/update.py", import.meta.url));

const INSTALLED = "1.2.3";
const NEWER = "1.3.0";
const deb = (version: string) => `deep-mine-control_${version}_amd64.deb`;
const content = (version: string) => `Paket ${version}`;
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

/** Was das Fake-GitHub anbietet und was es gefragt wurde */
interface Github {
  latest: string;
  /** Für diese Version stimmt die Prüfsumme nicht zum Paket. */
  wrongSum: string | null;
  /** Für diese Versionen gibt es keine Pakete (404). */
  missing: string[];
  /** Die Anhänge zeigen auf eine fremde Adresse. */
  foreign: boolean;
  /** Der Status antwortet nicht (Verbindung bricht ab) oder mit 503 (BSM antwortet nicht), aber mit Version. */
  status: "ok" | "down" | "bsm-down";
  requests: string[];
}

let server: Server;
let base: string;
let github: Github;
let dir: string;

const data = (name: string) => join(dir, "data", name);
const cache = (name = "") => join(dir, "cache", name);
const versionFile = () => join(dir, "version.json");
const installedVersion = () => JSON.parse(readFileSync(versionFile(), "utf8")).version;
const log = () =>
  existsSync(join(dir, "log")) ? readFileSync(join(dir, "log"), "utf8").trim().split("\n") : [];
const aptCalls = () => log().filter((line) => line.startsWith("apt-get"));
const state = () => JSON.parse(readFileSync(data("update-state.json"), "utf8"));
const downloads = () => github.requests.filter((path) => path.startsWith("/download/"));

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = req.url ?? "/";
    github.requests.push(path);
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (path === "/status") {
      if (github.status === "down") return res.destroy();
      const version = installedVersion();
      if (github.status === "bsm-down")
        return json(503, {
          statusCode: 503,
          message: "BSM antwortet nicht",
          data: { reason: "bsm", version }
        });
      return json(200, { state: "running", version });
    }
    if (path === "/releases/latest") {
      const tag = `v${github.latest}`;
      const prefix = github.foreign ? "https://example.invalid/download/" : `${base}/download/`;
      const asset = (name: string) => ({ name, browser_download_url: `${prefix}${tag}/${name}` });
      return json(200, {
        tag_name: tag,
        body: "* Neu",
        assets: [asset(deb(github.latest)), asset(`${deb(github.latest)}.sha256`)]
      });
    }
    const download = path.match(/^\/download\/v([0-9.]+)\/(deep-mine-control_\1_amd64\.deb)(\.sha256)?$/);
    if (download && !github.missing.includes(download[1]!)) {
      const [, version, name, checksum] = download;
      if (!checksum) return res.end(content(version!));
      const sum = version === github.wrongSum ? sha("etwas anderes") : sha(content(version!));
      return res.end(`${sum}  ${name}\n`);
    }
    json(404, { message: "Not Found" });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

function fakeCommand(name: string, body = "") {
  const path = join(dir, "bin", name);
  writeFileSync(path, `#!/usr/bin/env bash\necho "${name} $*" >> "${join(dir, "log")}"\n${body}\nexit 0\n`);
  chmodSync(path, 0o755);
}

beforeEach(() => {
  github = { latest: NEWER, wrongSum: null, missing: [], foreign: false, status: "ok", requests: [] };
  dir = mkdtempSync(join(tmpdir(), "dmc-update-"));
  for (const sub of ["data", "cache", "bin"]) mkdirSync(join(dir, sub));
  writeFileSync(versionFile(), JSON.stringify({ version: INSTALLED, commit: "0".repeat(40) }));
  // Führt den Befehl gleich aus, ohne die Optionen (--unit=…).
  fakeCommand("systemd-run", 'while [[ "$1" == --* ]]; do shift; done\nexec "$@"');
  // is-active: Läuft schon ein Update? Nur mit RUN_ACTIVE.
  fakeCommand("systemctl", '[ "$1" = is-active ] && { [ -n "$RUN_ACTIVE" ] || exit 3; }');
  // Installiert „das Paket“: schreibt dessen Version in die Versionsdatei, außer bei APT_BROKEN (kommt nicht hoch)
  // oder APT_FAIL (apt scheitert für diese Version).
  fakeCommand(
    "apt-get",
    [
      'echo "Ausgabe von apt-get für ${@: -1}"',
      'version=$(basename "${@: -1}" | sed -E "s/^deep-mine-control_(.*)_amd64\\.deb$/\\1/")',
      '[ "$version" = "$APT_FAIL" ] && { echo "E: kaputt" >&2; exit 100; }',
      '[ "$version" = "$APT_BROKEN" ] && exit 0',
      'printf \'{"version":"%s","commit":"x"}\' "$version" > "$VERSION_FILE"'
    ].join("\n")
  );
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** `deep-mine-update run`, wie von der Path-Unit gestartet. Asynchron, sonst antwortet das Fake-GitHub nicht. */
function helperRun(env: Record<string, string> = {}) {
  const child = spawn("python3", [helper, "run"], {
    env: {
      ...process.env,
      DATA_DIR: join(dir, "data"),
      CACHE_DIR: cache(),
      GITHUB_API: `${base}/releases/latest`,
      DOWNLOAD_PREFIX: `${base}/download/`,
      STATUS_URL: `${base}/status`,
      VERSION_FILE: versionFile(),
      APT_GET: join(dir, "bin", "apt-get"),
      SYSTEMD_RUN: join(dir, "bin", "systemd-run"),
      SYSTEMCTL: join(dir, "bin", "systemctl"),
      SELF: helper,
      VERIFY_SECONDS: "1",
      POLL_SECONDS: "0.1",
      ...env
    }
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  return new Promise<void>((resolve, reject) =>
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Code ${code}: ${stderr}`))))
  );
}

const ask = (version: string, id = "u1") =>
  writeFileSync(data("update-request.json"), JSON.stringify({ id, version }));
const install = (version: string, downgrade = false) =>
  `apt-get install -y -o DPkg::Lock::Timeout=300 ${downgrade ? "--allow-downgrades " : ""}${cache(deb(version))}`;

describe("Update", () => {
  it("lädt, prüft und installiert die neueste Version; der Cache hält neues und voriges Paket", async () => {
    ask(NEWER);

    await helperRun();

    expect(state()).toEqual({
      id: "u1",
      version: NEWER,
      phase: "done",
      error: null,
      startedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/),
      finishedAt: expect.stringMatching(/Z$/)
    });
    expect(log()).toEqual([
      "systemctl is-active --quiet deep-mine-update-run.service",
      `systemd-run --unit=deep-mine-update-run --collect --quiet --description=Deep Mine Control auf ${NEWER} aktualisieren ${helper} work u1 ${NEWER}`,
      install(NEWER)
    ]);
    expect(installedVersion()).toBe(NEWER);
    // Das vorige Paket kommt beim ersten Update vom Release der installierten Version.
    expect(readdirSync(cache()).sort()).toEqual([deb(INSTALLED), deb(NEWER)]);
    expect(readFileSync(cache(deb(NEWER)), "utf8")).toBe(content(NEWER));
    expect(existsSync(data("update-request.json"))).toBe(false);
    expect(readFileSync(data("update.log"), "utf8")).toContain(
      `Ausgabe von apt-get für ${cache(deb(NEWER))}`
    );
  });

  it("voriges Paket aus dem Cache, ältere Pakete fliegen raus", async () => {
    writeFileSync(cache(deb("1.1.0")), content("1.1.0"));
    writeFileSync(cache(deb(INSTALLED)), content(INSTALLED));
    ask(NEWER);

    await helperRun();

    expect(state().phase).toBe("done");
    expect(readdirSync(cache()).sort()).toEqual([deb(INSTALLED), deb(NEWER)]);
    expect(downloads()).not.toContain(`/download/v${INSTALLED}/${deb(INSTALLED)}`);
  });

  it("meldet der Status 503 (BSM antwortet nicht), zählt die Version darin", async () => {
    github.status = "bsm-down";
    ask(NEWER);

    await helperRun();

    expect(state().phase).toBe("done");
  });
});

describe("abgelehnt, nichts installiert", () => {
  it("falsche Prüfsumme: failed, das Paket bleibt nicht liegen", async () => {
    github.wrongSum = NEWER;
    ask(NEWER);

    await helperRun();

    expect(state()).toMatchObject({
      id: "u1",
      phase: "failed",
      error: `Prüfsumme von ${deb(NEWER)} stimmt nicht.`
    });
    expect(aptCalls()).toEqual([]);
    expect(readdirSync(cache())).toEqual([]);
    expect(installedVersion()).toBe(INSTALLED);
  });

  it("nicht die neueste Version: nichts geladen", async () => {
    ask("1.2.9");

    await helperRun();

    expect(state()).toMatchObject({
      phase: "failed",
      error: "Version 1.2.9 ist nicht die neueste (neueste: v1.3.0)."
    });
    expect(downloads()).toEqual([]);
    expect(aptCalls()).toEqual([]);
  });

  it.each([
    ["älter", "1.2.0"],
    ["gleich", INSTALLED]
  ])("Downgrade (%s), auch wenn es die neueste ist: nichts geladen", async (_, version) => {
    github.latest = version;
    ask(version);

    await helperRun();

    expect(state()).toMatchObject({
      phase: "failed",
      error: `Version ${version} ist nicht neuer als die installierte (${INSTALLED}).`
    });
    expect(downloads()).toEqual([]);
    expect(aptCalls()).toEqual([]);
  });

  it("fremde Download-Adresse am Release: nichts geladen", async () => {
    github.foreign = true;
    ask(NEWER);

    await helperRun();

    expect(state()).toMatchObject({
      phase: "failed",
      error: expect.stringContaining("Download-Adresse nicht erlaubt")
    });
    expect(downloads()).toEqual([]);
    expect(aptCalls()).toEqual([]);
  });

  it("kein Paket der installierten Version für den Rückfall: nicht installiert", async () => {
    github.missing = [INSTALLED];
    ask(NEWER);

    await helperRun();

    expect(state()).toMatchObject({
      phase: "failed",
      error: expect.stringContaining(`Kein Paket der installierten Version ${INSTALLED} für den Rückfall`)
    });
    expect(aptCalls()).toEqual([]);
  });

  it.each([
    ["Version mit Befehl", { id: "u1", version: "1.3.0; reboot" }],
    ["Version ohne Form", { id: "u1", version: "neu" }],
    ["id fehlt", { version: NEWER }]
  ])("ungültige Anfrage (%s): failed, nichts gestartet", async (_, request) => {
    writeFileSync(data("update-request.json"), JSON.stringify(request));

    await helperRun();

    expect(state().phase).toBe("failed");
    expect(log()).toEqual(["systemctl is-active --quiet deep-mine-update-run.service"]);
    expect(github.requests).toEqual([]);
  });

  it("läuft schon ein Update: Anfrage verworfen, dessen Stand bleibt", async () => {
    const running = {
      id: "u0",
      version: NEWER,
      phase: "installing",
      error: null,
      startedAt: "x",
      finishedAt: null
    };
    writeFileSync(data("update-state.json"), JSON.stringify(running));
    ask(NEWER);

    await helperRun({ RUN_ACTIVE: "1" });

    expect(state()).toEqual(running);
    expect(existsSync(data("update-request.json"))).toBe(false);
    expect(log()).toEqual(["systemctl is-active --quiet deep-mine-update-run.service"]);
  });
});

describe("Rückfall", () => {
  it("meldet der Status die neue Version nicht, kommt das vorige Paket wieder", async () => {
    ask(NEWER);

    await helperRun({ APT_BROKEN: NEWER });

    expect(aptCalls()).toEqual([install(NEWER), install(INSTALLED, true)]);
    expect(installedVersion()).toBe(INSTALLED);
    expect(state()).toMatchObject({
      phase: "rolled-back",
      error: `Version ${NEWER} hat sich nach 1 s nicht gemeldet. Version ${INSTALLED} ist wieder installiert.`
    });
  });

  it("antwortet der Status gar nicht, ebenso", async () => {
    github.status = "down";
    ask(NEWER);

    await helperRun();

    expect(aptCalls()).toEqual([install(NEWER), install(INSTALLED, true)]);
    expect(state().phase).toBe("rolled-back");
  });

  it("scheitert apt: voriges Paket wieder installiert", async () => {
    ask(NEWER);

    await helperRun({ APT_FAIL: NEWER });

    expect(aptCalls()).toEqual([install(NEWER), install(INSTALLED, true)]);
    expect(state()).toMatchObject({
      phase: "rolled-back",
      error: expect.stringContaining(`Installieren von ${NEWER} ist fehlgeschlagen`)
    });
    expect(readFileSync(data("update.log"), "utf8")).toContain("E: kaputt");
  });

  it("scheitert auch der Rückfall: failed, mit beiden Gründen", async () => {
    ask(NEWER);

    await helperRun({ APT_BROKEN: NEWER, APT_FAIL: INSTALLED });

    expect(state()).toMatchObject({
      phase: "failed",
      error: expect.stringContaining(`Auch Version ${INSTALLED} ließ sich nicht wieder installieren`)
    });
  });
});
