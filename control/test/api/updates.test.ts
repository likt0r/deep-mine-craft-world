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
      running: null
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

    // Erneut versuchen klappt und räumt den Fehler weg.
    h.fake.state.tasksFail = false;
    expect((await h.request("/api/updates/minecraft", { method: "POST" })).status).toBe(200);
    await expect.poll(notBusy).toBe(false);
    expect((await h.request("/api/updates")).body).toMatchObject({
      minecraft: { current: NEWER, failed: null },
      running: null
    });
  });
});
