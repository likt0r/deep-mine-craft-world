import { existsSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";
import { FIXTURE_VERSION } from "../support/fixture";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());

const INSTALLED = "1.26.52.3";
const NEWER = "1.26.60.1";

/** Fake zurücksetzen, Mojang bietet `latest` an, dann neu prüfen (das Ergebnis bleibt in der App). */
async function offer(latest: string) {
  h.fake.state.latestVersion = latest;
  await h.request("/api/updates/check", { method: "POST" });
}

beforeEach(async () => {
  h.fake.reset();
  await offer(INSTALLED);
});

const readJson = (name: string) => JSON.parse(readFileSync(join(h.fixture.dataDir, name), "utf8"));
const status = async () => (await h.request("/api/status")).body;
const notBusy = async () => (await status()).busy;
const updateCalls = () => h.fake.calls.filter((c) => c.method === "POST" && c.path.endsWith("/update"));

describe("GET /api/updates", () => {
  it("eine neuere Minecraft-Version ist verfügbar", async () => {
    await offer(NEWER);

    const res = await h.request("/api/updates");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      control: {
        current: FIXTURE_VERSION.version,
        latest: FIXTURE_VERSION.version,
        available: false,
        failed: null,
        notes: expect.any(String),
        publishedAt: "2026-10-24T08:00:00Z"
      },
      minecraft: { current: INSTALLED, latest: NEWER, available: true, failed: null },
      checkedAt: expect.any(String),
      errors: { control: null, minecraft: null },
      error: null,
      running: null,
      auto: { control: false, minecraft: false }
    });
    expect(Date.now() - Date.parse(res.body.checkedAt)).toBeLessThan(10_000);
  });

  it("Minecraft ist aktuell", async () => {
    const res = await h.request("/api/updates");

    expect(res.body.minecraft).toEqual({
      current: INSTALLED,
      latest: INSTALLED,
      available: false,
      failed: null
    });
    expect(res.body.error).toBeNull();
  });

  it("Mojang nicht erreichbar: neueste Version unbekannt, mit Grund statt „aktuell“", async () => {
    h.fake.state.mojangDown = true;

    const res = await h.request("/api/updates/check", { method: "POST" });

    expect(res.status).toBe(200);
    expect(res.body.minecraft).toEqual({ current: INSTALLED, latest: null, available: false, failed: null });
    expect(res.body.errors).toEqual({
      control: null,
      minecraft: expect.stringContaining("Mojang ist nicht erreichbar")
    });
    expect(res.body.error).toContain("Mojang ist nicht erreichbar");
    expect(res.body.checkedAt).toEqual(expect.any(String));
  });

  it("nutzt das Ergebnis der letzten Prüfung, bis neu geprüft wird", async () => {
    h.fake.state.latestVersion = NEWER;

    expect((await h.request("/api/updates")).body.minecraft.latest).toBe(INSTALLED);

    const res = await h.request("/api/updates/check", { method: "POST" });
    expect(res.body.minecraft).toMatchObject({ latest: NEWER, available: true });
    expect((await h.request("/api/updates")).body.minecraft.latest).toBe(NEWER);
  });
});

describe("POST /api/updates/minecraft", () => {
  it("ohne Spieler: kein Countdown, BSM aktualisiert, danach ist die neue Version installiert", async () => {
    await offer(NEWER);

    const res = await h.request("/api/updates/minecraft", { method: "POST" });

    expect(res.status).toBe(200);
    await expect.poll(notBusy).toBe(false);
    expect(h.fake.commands()).toEqual([]);
    expect(updateCalls()).toHaveLength(1);
    expect((await h.request("/api/updates")).body).toMatchObject({
      minecraft: { current: NEWER, latest: NEWER, available: false, failed: null },
      running: null
    });
  });

  it("mit Spielern: erst 10 s Countdown im Chat, dann das Update", async () => {
    await offer(NEWER);
    h.fake.state.players = ["Lena"];

    await h.request("/api/updates/minecraft", { method: "POST" });
    await expect.poll(notBusy).toBe(false);

    const steps = h.fake.calls
      .filter((c) => /\/(send_command|update)$/.test(c.path))
      .map((c) => (c.path.endsWith("/send_command") ? (c.body as { command: string }).command : c.path));
    expect(steps).toEqual([
      "say Minecraft wird aktualisiert! Neustart in 10 s.",
      "say Minecraft wird aktualisiert! Neustart in 5 s.",
      "say Minecraft wird aktualisiert! Neustart in 3 s.",
      "say Minecraft wird aktualisiert! Neustart in 2 s.",
      "say Minecraft wird aktualisiert! Neustart in 1 s.",
      "/api/server/Bedrock/update"
    ]);
  });

  it("Status meldet updating und sperrt, solange das Update läuft; danach wieder frei", async () => {
    await offer(NEWER);
    h.fake.state.startDelayMs = 500;

    await h.request("/api/updates/minecraft", { method: "POST" });

    expect(await status()).toMatchObject({ busy: true, switching: null, updating: "minecraft" });
    expect((await h.request("/api/updates")).body.running).toMatchObject({ kind: "minecraft", error: null });
    await expect.poll(notBusy).toBe(false);
    expect((await status()).updating).toBeNull();
  });

  it("ohne neuere Version: 409, BSM wird nicht gefragt", async () => {
    const res = await h.request("/api/updates/minecraft", { method: "POST" });

    expect(res.status).toBe(409);
    expect(updateCalls()).toEqual([]);
  });

  it("läuft schon ein Weltvorgang: 409; während des Updates lässt sich keine Welt laden", async () => {
    await h.request("/api/places");
    h.fixture.seedPlace(2, { name: "Bauwelt", folder: "w-bauwelt" });
    await offer(NEWER);
    h.fake.state.startDelayMs = 500;

    await h.request("/api/places/2/load", { method: "POST" });
    expect((await h.request("/api/updates/minecraft", { method: "POST" })).status).toBe(409);
    await expect.poll(notBusy).toBe(false);
    expect(updateCalls()).toEqual([]);

    expect((await h.request("/api/updates/minecraft", { method: "POST" })).status).toBe(200);
    expect((await h.request("/api/places/1/load", { method: "POST" })).status).toBe(409);
    await expect.poll(notBusy).toBe(false);
  });

  it("scheitert die BSM-Aufgabe, stehen Grund und Version da, und die Sperre ist frei", async () => {
    await offer(NEWER);
    h.fake.state.tasksFail = true;

    await h.request("/api/updates/minecraft", { method: "POST" });
    await expect.poll(notBusy).toBe(false);

    const res = await h.request("/api/updates");
    expect(res.body.running).toEqual({
      kind: "minecraft",
      phase: "failed",
      error: expect.stringContaining("Fehler im Fake")
    });
    expect(res.body.minecraft).toMatchObject({ current: INSTALLED, available: true, failed: NEWER });
    expect((await status()).updating).toBeNull();
    expect(readJson("updates.json")).toEqual({ failed: { control: null, minecraft: NEWER } });

    // Erneut versuchen klappt und räumt den Fehler weg.
    h.fake.state.tasksFail = false;
    expect((await h.request("/api/updates/minecraft", { method: "POST" })).status).toBe(200);
    await expect.poll(notBusy).toBe(false);
    expect((await h.request("/api/updates")).body).toMatchObject({
      minecraft: { current: NEWER, failed: null },
      running: null
    });
    expect(readJson("updates.json")).toEqual({ failed: { control: null, minecraft: null } });
  });
});

describe("PUT /api/updates/auto", () => {
  it("ohne Datei: Autoupdate aus", async () => {
    expect(existsSync(join(h.fixture.dataDir, "update-settings.json"))).toBe(false);
    expect((await h.request("/api/updates")).body.auto).toEqual({ control: false, minecraft: false });
  });

  it("setzt einen Schalter, die anderen bleiben; dauerhaft im Datenordner", async () => {
    const on = await h.request("/api/updates/auto", { method: "PUT", body: { minecraft: true } });

    expect(on.status).toBe(200);
    expect(on.body).toEqual({ control: false, minecraft: true });
    expect(readJson("update-settings.json")).toEqual({ control: false, minecraft: true });
    expect((await h.request("/api/updates")).body.auto).toEqual({ control: false, minecraft: true });

    await h.request("/api/updates/auto", { method: "PUT", body: { control: true } });
    expect(readJson("update-settings.json")).toEqual({ control: true, minecraft: true });

    await h.request("/api/updates/auto", { method: "PUT", body: { minecraft: false } });
    expect((await h.request("/api/updates")).body.auto).toEqual({ control: true, minecraft: false });
  });

  it.each([
    ["leer", {}],
    ["kein Wahrheitswert", { minecraft: "ja" }],
    ["unbekannter Schalter", { minecraft: true, bsm: true }],
    ["kein Objekt", "an"]
  ])("ungültig (%s): 400, nichts gespeichert", async (_, body) => {
    const res = await h.request("/api/updates/auto", { method: "PUT", body });

    expect(res.status).toBe(400);
    expect(existsSync(join(h.fixture.dataDir, "update-settings.json"))).toBe(false);
  });
});

describe("POST /api/updates/auto", () => {
  const autoRun = async () => {
    const res = await h.request("/api/updates/auto", { method: "POST" });
    expect(res.status).toBe(200);
    return res.body;
  };
  const autoOn = () => h.request("/api/updates/auto", { method: "PUT", body: { minecraft: true } });

  it("Autoupdate aus: prüft trotzdem, installiert aber nichts", async () => {
    h.fake.state.latestVersion = NEWER;

    expect(await autoRun()).toEqual({ action: "none", reason: "off" });

    expect((await h.request("/api/updates")).body.minecraft).toMatchObject({
      latest: NEWER,
      available: true
    });
    expect(updateCalls()).toEqual([]);
  });

  it("an und niemand online: prüft neu und startet das Update im Hintergrund", async () => {
    await autoOn();
    h.fake.state.latestVersion = NEWER;
    h.fake.state.startDelayMs = 500;

    expect(await autoRun()).toEqual({ action: "minecraft", version: NEWER });

    expect(await status()).toMatchObject({ busy: true, updating: "minecraft" });
    await expect.poll(notBusy).toBe(false);
    expect(updateCalls()).toHaveLength(1);
    expect(h.fake.commands()).toEqual([]);
    expect((await h.request("/api/updates")).body.minecraft).toMatchObject({
      current: NEWER,
      available: false
    });
  });

  it("an, aber nichts neu: nichts", async () => {
    await autoOn();

    expect(await autoRun()).toEqual({ action: "none", reason: "up-to-date" });
    expect(updateCalls()).toEqual([]);
  });

  it("an, aber Mojang nicht erreichbar: nichts, mit eigenem Grund", async () => {
    await autoOn();
    h.fake.state.mojangDown = true;

    expect(await autoRun()).toEqual({ action: "none", reason: "check-failed" });
    expect(updateCalls()).toEqual([]);
  });

  it("an, aber jemand spielt: nichts, auch kein Countdown", async () => {
    await autoOn();
    await offer(NEWER);
    h.fake.state.players = ["Lena"];

    expect(await autoRun()).toEqual({ action: "none", reason: "players-online" });
    expect(updateCalls()).toEqual([]);
    expect(h.fake.commands()).toEqual([]);
  });

  it("an, aber ein Weltvorgang läuft: nichts", async () => {
    await h.request("/api/places");
    h.fixture.seedPlace(2, { name: "Bauwelt", folder: "w-bauwelt" });
    await autoOn();
    await offer(NEWER);
    h.fake.state.startDelayMs = 500;
    await h.request("/api/places/2/load", { method: "POST" });

    expect(await autoRun()).toEqual({ action: "none", reason: "world-operation" });

    await expect.poll(notBusy).toBe(false);
    expect(updateCalls()).toEqual([]);
  });

  it("gescheiterte Version: übersprungen, der Knopf versucht es trotzdem; eine neuere hebt die Sperre auf", async () => {
    await autoOn();
    await offer(NEWER);
    h.fake.state.tasksFail = true;
    expect(await autoRun()).toEqual({ action: "minecraft", version: NEWER });
    await expect.poll(notBusy).toBe(false);
    expect((await h.request("/api/updates")).body.minecraft.failed).toBe(NEWER);

    h.fake.state.tasksFail = false;
    expect(await autoRun()).toEqual({ action: "none", reason: "failed" });
    expect(updateCalls()).toHaveLength(1);

    // Eine noch neuere Version versucht Autoupdate wieder.
    h.fake.state.latestVersion = "1.26.70.2";
    expect(await autoRun()).toEqual({ action: "minecraft", version: "1.26.70.2" });
    await expect.poll(notBusy).toBe(false);
    expect(updateCalls()).toHaveLength(2);
    expect((await h.request("/api/updates")).body.minecraft).toMatchObject({
      current: "1.26.70.2",
      failed: null
    });
  });

  it("gescheiterte Version, gemerkt im Datenordner: Autoupdate überspringt, „Erneut versuchen“ geht", async () => {
    writeFileSync(
      join(h.fixture.dataDir, "updates.json"),
      JSON.stringify({ failed: { control: null, minecraft: NEWER } })
    );
    await autoOn();
    await offer(NEWER);

    expect((await h.request("/api/updates")).body.minecraft.failed).toBe(NEWER);
    expect(await autoRun()).toEqual({ action: "none", reason: "failed" });
    expect(updateCalls()).toEqual([]);

    expect((await h.request("/api/updates/minecraft", { method: "POST" })).status).toBe(200);
    await expect.poll(notBusy).toBe(false);
    expect(updateCalls()).toHaveLength(1);
    expect((await h.request("/api/updates")).body.minecraft).toMatchObject({ current: NEWER, failed: null });
    expect(readJson("updates.json")).toEqual({ failed: { control: null, minecraft: null } });
  });
});

// --- Deep Mine Control ---

const CONTROL_INSTALLED = FIXTURE_VERSION.version;
const CONTROL_NEWER = "1.3.0";

/** GitHub bietet `latest` an, dann neu prüfen. */
async function offerControl(latest: string, change: Partial<typeof h.fake.state> = {}) {
  Object.assign(h.fake.state, { controlLatest: latest, ...change });
  return (await h.request("/api/updates/check", { method: "POST" })).body;
}
const dataFile = (name: string) => join(h.fixture.dataDir, name);
/** Schreibt den Stand, wie ihn der root-Helfer deep-mine-update schreibt. */
function helperState(phase: string, extra: Record<string, unknown> = {}) {
  writeFileSync(
    dataFile("update-state.json"),
    JSON.stringify({
      id: "u1",
      version: CONTROL_NEWER,
      phase,
      error: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      ...extra
    })
  );
}

describe("Deep Mine Control: GET /api/updates", () => {
  it("neueres Release mit Paket: verfügbar, mit Änderungsliste", async () => {
    const body = await offerControl(CONTROL_NEWER, { controlNotes: "* Neu: Updates\n* Behoben: Toasts" });

    expect(body.control).toEqual({
      current: CONTROL_INSTALLED,
      latest: CONTROL_NEWER,
      available: true,
      failed: null,
      notes: "* Neu: Updates\n* Behoben: Toasts",
      publishedAt: "2026-10-24T08:00:00Z"
    });
    expect(body.errors).toEqual({ control: null, minecraft: null });
  });

  it("gleiches oder älteres Release: aktuell", async () => {
    expect((await offerControl(CONTROL_INSTALLED)).control).toMatchObject({
      latest: CONTROL_INSTALLED,
      available: false
    });
    expect((await offerControl("1.2.0")).control).toMatchObject({ latest: "1.2.0", available: false });
  });

  it("Release noch ohne Paket: zählt nicht, mit Grund", async () => {
    const body = await offerControl(CONTROL_NEWER, { controlPackage: false });

    expect(body.control).toMatchObject({ latest: null, available: false });
    expect(body.errors.control).toBe(
      "Das neueste Release v1.3.0 hat noch kein Paket. Gleich noch einmal prüfen."
    );
  });

  it("ohne Paket installiert („dev“): kein Update per Knopf", async () => {
    rmSync(h.fixture.versionFile);

    const body = await offerControl(CONTROL_NEWER);

    expect(body.control).toMatchObject({ current: "dev", latest: CONTROL_NEWER, available: false });
    expect((await h.request("/api/updates/control", { method: "POST" })).status).toBe(409);
  });

  it("GitHub weg, Mojang da: nur die Control-Prüfung scheitert", async () => {
    h.fake.state.latestVersion = NEWER;
    const body = await offerControl(CONTROL_NEWER, { githubDown: true });

    expect(body.control).toMatchObject({ current: CONTROL_INSTALLED, latest: null, available: false });
    expect(body.minecraft).toMatchObject({ latest: NEWER, available: true });
    expect(body.errors).toEqual({
      control: "GitHub ist nicht erreichbar. Hat der Server Internet?",
      minecraft: null
    });
    expect(body.error).toBe("GitHub ist nicht erreichbar. Hat der Server Internet?");
  });

  it("Mojang weg, GitHub da: nur die Minecraft-Prüfung scheitert", async () => {
    h.fake.state.mojangDown = true;
    const body = await offerControl(CONTROL_NEWER);

    expect(body.control).toMatchObject({ latest: CONTROL_NEWER, available: true });
    expect(body.minecraft).toMatchObject({ latest: null, available: false });
    expect(body.errors).toEqual({ control: null, minecraft: expect.stringContaining("Mojang") });
  });
});

describe("POST /api/updates/control", () => {
  it("schreibt die Anfrage für den root-Helfer, mit der neuesten Version", async () => {
    await offerControl(CONTROL_NEWER);

    const res = await h.request("/api/updates/control", { method: "POST" });

    expect(res.status).toBe(200);
    const request = readJson("update-request.json");
    expect(request).toEqual({ id: expect.any(String), version: CONTROL_NEWER });
    expect(res.body).toEqual({ id: request.id, version: CONTROL_NEWER });
    // Bis der Helfer sie abholt, gilt sie schon als laufendes Update.
    expect(await status()).toMatchObject({ updating: "control", busy: true });
    expect((await h.request("/api/updates")).body.running).toEqual({
      kind: "control",
      phase: "downloading",
      error: null
    });
  });

  it("ohne neueres Release: 409, keine Anfrage", async () => {
    await offerControl(CONTROL_INSTALLED);

    expect((await h.request("/api/updates/control", { method: "POST" })).status).toBe(409);
    expect(existsSync(dataFile("update-request.json"))).toBe(false);
  });

  it("GitHub nicht erreichbar: 409", async () => {
    await offerControl(CONTROL_NEWER, { githubDown: true });

    expect((await h.request("/api/updates/control", { method: "POST" })).status).toBe(409);
  });

  it("läuft schon eins (Anfrage offen oder Helfer bei der Arbeit): 409", async () => {
    await offerControl(CONTROL_NEWER);
    await h.request("/api/updates/control", { method: "POST" });
    const first = readJson("update-request.json");

    expect((await h.request("/api/updates/control", { method: "POST" })).status).toBe(409);
    expect(readJson("update-request.json")).toEqual(first);

    rmSync(dataFile("update-request.json"));
    helperState("verifying");
    expect((await h.request("/api/updates/control", { method: "POST" })).status).toBe(409);
  });

  it("eine Anfrage, die der Helfer nach einer Minute nicht abgeholt hat, sperrt nicht mehr", async () => {
    await offerControl(CONTROL_NEWER);
    await h.request("/api/updates/control", { method: "POST" });
    const old = new Date(Date.now() - 2 * 60_000);
    utimesSync(dataFile("update-request.json"), old, old);

    expect((await status()).updating).toBeNull();
    expect((await h.request("/api/updates/control", { method: "POST" })).status).toBe(200);
  });

  it("während eines Weltvorgangs: 409", async () => {
    await h.request("/api/places");
    h.fixture.seedPlace(2, { name: "Bauwelt", folder: "w-bauwelt" });
    await offerControl(CONTROL_NEWER);
    h.fake.state.startDelayMs = 500;
    await h.request("/api/places/2/load", { method: "POST" });

    expect((await h.request("/api/updates/control", { method: "POST" })).status).toBe(409);
    expect(existsSync(dataFile("update-request.json"))).toBe(false);
    await expect.poll(notBusy).toBe(false);
  });
});

describe("Deep Mine Control: Stand des Updates", () => {
  it.each(["downloading", "installing", "verifying"])(
    "Helfer bei „%s“: Status meldet updating control",
    async (phase) => {
      await offerControl(CONTROL_NEWER);
      helperState(phase);

      expect(await status()).toMatchObject({ updating: "control", busy: true });
      expect((await h.request("/api/updates")).body.running).toEqual({ kind: "control", phase, error: null });
    }
  );

  it("währenddessen kein Minecraft-Update und kein Neustart des Rechners", async () => {
    await offer(NEWER);
    helperState("installing");

    expect((await h.request("/api/updates/minecraft", { method: "POST" })).status).toBe(409);
    expect((await h.request("/api/system/reboot", { method: "POST" })).status).toBe(409);
    expect((await h.request("/api/system/poweroff", { method: "POST" })).status).toBe(409);
    expect(updateCalls()).toEqual([]);
  });

  it.each([
    ["rolled-back", "Version 1.3.0 hat sich nach 60 s nicht gemeldet. Version 1.2.3 ist wieder installiert."],
    ["failed", "Prüfsumme von deep-mine-control_1.3.0_amd64.deb stimmt nicht."]
  ])(
    "Helfer meldet %s: Grund in running, Version dauerhaft als gescheitert gemerkt",
    async (phase, error) => {
      await offerControl(CONTROL_NEWER);
      helperState(phase, { error, finishedAt: new Date().toISOString() });

      const res = await h.request("/api/updates");

      expect(res.body.running).toEqual({ kind: "control", phase: "failed", error });
      expect(res.body.control).toMatchObject({ available: true, failed: CONTROL_NEWER });
      expect(await status()).toMatchObject({ updating: null, busy: false });
      expect(readJson("updates.json")).toEqual({ failed: { control: CONTROL_NEWER, minecraft: null } });

      // „Erneut versuchen“ geht.
      expect((await h.request("/api/updates/control", { method: "POST" })).status).toBe(200);
    }
  );

  it("nach Erfolg ist die gescheiterte Version vergessen", async () => {
    await offerControl(CONTROL_NEWER);
    helperState("rolled-back", { error: "kaputt" });
    await h.request("/api/updates");

    helperState("done");
    writeFileSync(h.fixture.versionFile, JSON.stringify({ ...FIXTURE_VERSION, version: CONTROL_NEWER }));

    const res = await h.request("/api/updates");
    expect(res.body.running).toBeNull();
    expect(res.body.control).toMatchObject({ current: CONTROL_NEWER, available: false, failed: null });
    expect(readJson("updates.json")).toEqual({ failed: { control: null, minecraft: null } });
    expect((await status()).version).toBe(CONTROL_NEWER);
  });

  it("steht der Stand über eine halbe Stunde auf „läuft“ (Rechner war aus): unterbrochen", async () => {
    await offerControl(CONTROL_NEWER);
    helperState("installing", { startedAt: new Date(Date.now() - 60 * 60_000).toISOString() });

    expect((await status()).updating).toBeNull();
    expect((await h.request("/api/updates")).body).toMatchObject({
      running: { kind: "control", phase: "failed", error: "Das Update wurde unterbrochen." },
      control: { failed: CONTROL_NEWER }
    });
  });

  it("ein laufendes Minecraft-Update geht in running vor einem gescheiterten Control-Update", async () => {
    await offer(NEWER);
    await offerControl(CONTROL_NEWER);
    helperState("failed", { error: "kaputt" });
    h.fake.state.startDelayMs = 500;

    await h.request("/api/updates/minecraft", { method: "POST" });

    expect((await h.request("/api/updates")).body.running).toMatchObject({ kind: "minecraft", error: null });
    await expect.poll(notBusy).toBe(false);
    expect((await h.request("/api/updates")).body.running).toMatchObject({
      kind: "control",
      phase: "failed"
    });
  });
});
