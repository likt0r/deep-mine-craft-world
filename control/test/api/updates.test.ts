import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";

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
      minecraft: { current: INSTALLED, latest: NEWER, available: true, failed: null },
      checkedAt: expect.any(String),
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
