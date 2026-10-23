import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";
import { makeMcworld } from "../support/mcworld";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());

const ACTIVE = "Bedrock level_backup_20261022_183000_ab12cd.mcworld";
const INACTIVE = "w-bauwelt_backup_20261020_100000_ef34.mcworld";
const ORPHAN = "w-alt_backup_20261001_080000.mcworld";

beforeEach(async () => {
  h.fake.reset();
  // Platz 1 „Pandaland“ (aktiv, Ordner „Bedrock level“), Platz 2 „Bauwelt“.
  await h.request("/api/places");
  h.fixture.seedPlace(2, { name: "Bauwelt", folder: "w-bauwelt" });
  mkdirSync(h.fixture.backupDir, { recursive: true });
});

const backup = (file: string, content = "x") => writeFileSync(join(h.fixture.backupDir, file), content);
const bsmCalls = (end: string) => h.fake.calls.filter((c) => c.path.endsWith(end));
const settled = () => expect.poll(async () => (await h.request("/api/status")).body.busy).toBe(false);

describe("GET /api/backups", () => {
  it("listet die Backups je Welt, neueste zuerst; Welten ohne Platz kommen ans Ende", async () => {
    backup(ACTIVE, "12345");
    backup("Bedrock level_backup_20261023_090000_99.mcworld", "1");
    backup(INACTIVE, "123");
    backup(ORPHAN);
    backup("notizen.txt");

    const res = await h.request("/api/backups");

    expect(res.status).toBe(200);
    expect(res.body.dir).toBe(h.fixture.backupDir);
    expect(res.body.autoBackup).toBe(false);
    expect(res.body.onWorldEnd).toBe(true);
    expect(res.body.worlds).toEqual([
      {
        place: 1,
        name: "Pandaland",
        folder: "Bedrock level",
        active: true,
        backups: [
          {
            file: "Bedrock level_backup_20261023_090000_99.mcworld",
            createdAt: "2026-10-23T09:00:00.000Z",
            sizeBytes: 1
          },
          { file: ACTIVE, createdAt: "2026-10-22T18:30:00.000Z", sizeBytes: 5 }
        ]
      },
      {
        place: 2,
        name: "Bauwelt",
        folder: "w-bauwelt",
        active: false,
        backups: [{ file: INACTIVE, createdAt: "2026-10-20T10:00:00.000Z", sizeBytes: 3 }]
      },
      {
        place: null,
        name: "w-alt",
        folder: "w-alt",
        active: false,
        backups: [{ file: ORPHAN, createdAt: "2026-10-01T08:00:00.000Z", sizeBytes: 1 }]
      }
    ]);
  });

  it("ohne Admin-Rechte in BSM ist „Vor jedem Start sichern“ unbekannt", async () => {
    h.fake.state.admin = false;

    expect((await h.request("/api/backups")).body.autoBackup).toBeNull();
  });
});

describe("POST /api/backups", () => {
  it("sichert die aktive Welt über BSM und antwortet, wenn das Backup da ist", async () => {
    const res = await h.request("/api/backups", { method: "POST" });

    expect(res.status).toBe(200);
    expect(bsmCalls("/backup/action")[0]?.body).toEqual({ backup_type: "world" });
    expect(readdirSync(h.fixture.backupDir).some((f) => f.startsWith("Bedrock level_backup_"))).toBe(true);
    expect((await h.request("/api/status")).body.busy).toBe(false);
  });

  it("scheitert die BSM-Aufgabe, meldet die API einen Fehler und gibt die Sperre frei", async () => {
    h.fake.state.tasksFail = true;

    const res = await h.request("/api/backups", { method: "POST" });

    expect(res.status).toBeGreaterThanOrEqual(500);
    await settled();
  });
});

describe("POST /api/backups/restore", () => {
  it("aktive Welt: über BSM, der Server startet neu, solange ist alles gesperrt", async () => {
    backup(ACTIVE);
    h.fake.state.startDelayMs = 400;

    const res = await h.request("/api/backups/restore", { method: "POST", body: { file: ACTIVE } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, restart: true });
    expect((await h.request("/api/status")).body).toMatchObject({ busy: true, switching: null });
    expect(bsmCalls("/restore/action")[0]?.body).toEqual({ restore_type: "world", backup_file: ACTIVE });
    await settled();
  });

  it("andere Welt: direkt in deren Ordner, ohne BSM und ohne Neustart", async () => {
    makeMcworld(join(h.fixture.backupDir, INACTIVE), {
      "level.dat": "aus dem Backup",
      "db/000001.ldb": "daten"
    });
    const worldDir = join(h.fixture.worldsDir, "w-bauwelt");
    writeFileSync(join(worldDir, "neu-seit-backup.txt"), "geht verloren");

    const res = await h.request("/api/backups/restore", { method: "POST", body: { file: INACTIVE } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, restart: false });
    expect(readFileSync(join(worldDir, "level.dat"), "utf8")).toBe("aus dem Backup");
    expect(readFileSync(join(worldDir, "db/000001.ldb"), "utf8")).toBe("daten");
    expect(existsSync(join(worldDir, "neu-seit-backup.txt"))).toBe(false);
    expect(bsmCalls("/restore/action")).toEqual([]);
    expect(readdirSync(h.fixture.worldsDir).filter((d) => d.startsWith("."))).toEqual([]);
  });

  it("ein Backup ohne level.dat lässt die Welt, wie sie ist", async () => {
    makeMcworld(join(h.fixture.backupDir, INACTIVE), { "irgendwas.txt": "kaputt" });
    const worldDir = join(h.fixture.worldsDir, "w-bauwelt");
    writeFileSync(join(worldDir, "bleibt.txt"), "ja");

    const res = await h.request("/api/backups/restore", { method: "POST", body: { file: INACTIVE } });

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(readFileSync(join(worldDir, "bleibt.txt"), "utf8")).toBe("ja");
    expect(readdirSync(h.fixture.worldsDir).filter((d) => d.startsWith("."))).toEqual([]);
  });

  it("eine Welt ohne Platz lässt sich nicht zurückspielen", async () => {
    backup(ORPHAN);

    expect((await h.request("/api/backups/restore", { method: "POST", body: { file: ORPHAN } })).status).toBe(
      409
    );
  });

  it.each([
    "../etc/passwd",
    "a/b_backup_20261022_183000.mcworld",
    "notizen.txt",
    "..._backup_20261022_183000.mcworld"
  ])("lehnt %s mit 400 ab", async (file) => {
    expect((await h.request("/api/backups/restore", { method: "POST", body: { file } })).status).toBe(400);
  });

  it("ein unbekanntes Backup ergibt 404", async () => {
    expect((await h.request("/api/backups/restore", { method: "POST", body: { file: ACTIVE } })).status).toBe(
      404
    );
  });

  it("während eines Weltvorgangs 409", async () => {
    backup(INACTIVE);
    h.fake.state.startDelayMs = 800;
    await h.request("/api/places/2/load", { method: "POST" });

    expect(
      (await h.request("/api/backups/restore", { method: "POST", body: { file: INACTIVE } })).status
    ).toBe(409);
    await settled();
  });
});

describe("Download", () => {
  it("liefert die Datei als Anhang", async () => {
    backup(ACTIVE, "mcworld-inhalt");

    const res = await fetch(`${h.app.url}/api/backups/download/${encodeURIComponent(ACTIVE)}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe(`attachment; filename="${ACTIVE}"`);
    expect(await res.text()).toBe("mcworld-inhalt");
  });

  it("falsche Namen 400, fehlende Dateien 404", async () => {
    expect((await h.request(`/api/backups/download/${encodeURIComponent("../../etc/passwd")}`)).status).toBe(
      400
    );
    expect((await h.request(`/api/backups/download/${encodeURIComponent(ACTIVE)}`)).status).toBe(404);
  });
});

describe("PUT /api/backups/auto", () => {
  it("schaltet backup_on_start in BSM", async () => {
    expect((await h.request("/api/backups/auto", { method: "PUT", body: { enabled: true } })).status).toBe(
      200
    );
    expect(h.fake.state.plugins.backup_on_start).toBe(true);
    expect((await h.request("/api/backups")).body.autoBackup).toBe(true);
  });

  it("ohne Admin-Rechte: 503 mit Hinweis", async () => {
    h.fake.state.admin = false;

    const res = await h.request("/api/backups/auto", { method: "PUT", body: { enabled: true } });

    expect(res.status).toBe(503);
    expect(res.body.message).toContain("Admin-Rechte");
  });
});

describe("Sichern, wenn eine Welt beendet wird", () => {
  /** Reihenfolge der BSM-Aufrufe, die hier zählen */
  const order = () =>
    h.fake.calls
      .map((c) => c.path.split("/").slice(-2).join("/"))
      .filter((p) => ["backup/action", "Bedrock/stop", "properties/set", "Bedrock/restart"].includes(p));
  const setWorldEnd = (enabled: boolean) =>
    h.request("/api/backups/on-world-end", { method: "PUT", body: { enabled } });

  it("ist ohne Einstellung an und lässt sich ausschalten", async () => {
    expect((await setWorldEnd(false)).status).toBe(200);
    expect((await h.request("/api/backups")).body.onWorldEnd).toBe(false);
    expect(JSON.parse(readFileSync(join(h.fixture.dataDir, "backup-settings.json"), "utf8"))).toEqual({
      onWorldEnd: false
    });
  });

  it("Weltwechsel: erst die bisherige Welt sichern, dann umstellen und neu starten", async () => {
    await h.request("/api/places/2/load", { method: "POST" });
    await settled();

    expect(order()).toEqual(["backup/action", "properties/set", "Bedrock/restart"]);
    expect(readdirSync(h.fixture.backupDir).some((f) => f.startsWith("Bedrock level_backup_"))).toBe(true);
  });

  it("Weltwechsel ausgeschaltet: kein Backup", async () => {
    await setWorldEnd(false);

    await h.request("/api/places/2/load", { method: "POST" });
    await settled();

    expect(order()).toEqual(["properties/set", "Bedrock/restart"]);
  });

  it("scheitert das Backup, findet der Wechsel trotzdem statt", async () => {
    h.fake.state.tasksFail = true;

    await h.request("/api/places/2/load", { method: "POST" });
    await settled();

    expect(h.fake.state.properties["level-name"]).toBe("w-bauwelt");
  });

  it("Minecraft stoppen: erst sichern, dann stoppen", async () => {
    await h.request("/api/stop", { method: "POST" });

    await expect.poll(() => h.fake.state.status).toBe("STOPPED");
    expect(order()).toEqual(["backup/action", "Bedrock/stop"]);
  });

  it("Minecraft stoppen ausgeschaltet: nur stoppen", async () => {
    await setWorldEnd(false);

    await h.request("/api/stop", { method: "POST" });

    await expect.poll(() => h.fake.state.status).toBe("STOPPED");
    expect(order()).toEqual(["Bedrock/stop"]);
  });

  it("Herunterfahren: sichert und antwortet erst danach", async () => {
    const res = await h.request("/api/backups/shutdown", { method: "POST" });

    expect(res.body).toEqual({ backup: true });
    expect(order()).toEqual(["backup/action"]);
    expect(readdirSync(h.fixture.backupDir).some((f) => f.startsWith("Bedrock level_backup_"))).toBe(true);
  });

  it("Herunterfahren: aus, Minecraft aus oder Weltvorgang läuft → kein Backup", async () => {
    await setWorldEnd(false);
    expect((await h.request("/api/backups/shutdown", { method: "POST" })).body).toMatchObject({
      backup: false
    });

    await setWorldEnd(true);
    h.fake.state.status = "STOPPED";
    expect((await h.request("/api/backups/shutdown", { method: "POST" })).body).toMatchObject({
      backup: false
    });

    expect(order()).toEqual([]);
  });
});
