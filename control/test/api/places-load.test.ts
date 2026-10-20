import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());
beforeEach(async () => {
  h.fake.reset();
  // Platz 1 „Pandaland“ (aktiv, aus der Migration) und Platz 2 „Bauwelt“.
  await h.request("/api/places");
  h.fixture.seedPlace(2, {
    name: "Bauwelt",
    folder: "w-bauwelt",
    type: "flach",
    mode: "survival",
    difficulty: "hard"
  });
});

const notBusy = async () => (await h.request("/api/status")).body.busy;

describe("POST /api/places/{n}/load", () => {
  it("zählt im Chat herunter, setzt dann die Properties der Welt und startet neu", async () => {
    const res = await h.request("/api/places/2/load", { method: "POST" });

    expect(res.status).toBe(200);
    await expect.poll(notBusy).toBe(false);

    const steps = h.fake.calls
      .filter((c) => /\/(send_command|properties\/set|restart)$/.test(c.path))
      .map((c) => (c.path.endsWith("/send_command") ? (c.body as { command: string }).command : c.path));
    expect(steps).toEqual([
      "say Gleich geht es nach „Bauwelt“! Neustart in 10 s.",
      "say Gleich geht es nach „Bauwelt“! Neustart in 5 s.",
      "say Gleich geht es nach „Bauwelt“! Neustart in 3 s.",
      "say Gleich geht es nach „Bauwelt“! Neustart in 2 s.",
      "say Gleich geht es nach „Bauwelt“! Neustart in 1 s.",
      "/api/server/Bedrock/properties/set",
      "/api/server/Bedrock/restart"
    ]);
    expect(h.fake.calls.find((c) => c.path.endsWith("/properties/set"))?.body).toEqual({
      properties: { "level-name": "w-bauwelt", gamemode: "survival", difficulty: "hard" }
    });
  });

  it("macht die geladene Welt zur aktiven Welt", async () => {
    await h.request("/api/places/2/load", { method: "POST" });
    await expect.poll(notBusy).toBe(false);

    const places = (await h.request("/api/places")).body.places;
    expect(places[0].active).toBe(false);
    expect(places[1].active).toBe(true);
    expect((await h.request("/api/status")).body.world).toBe("Bauwelt");
  });

  it("stellt beim Zurückladen Modus und Schwierigkeit der anderen Welt wieder her", async () => {
    await h.request("/api/places/2/load", { method: "POST" });
    await expect.poll(notBusy).toBe(false);

    await h.request("/api/places/1/load", { method: "POST" });
    await expect.poll(notBusy).toBe(false);

    expect(h.fake.state.properties).toMatchObject({
      "level-name": "Bedrock level",
      gamemode: "creative",
      difficulty: "easy"
    });
  });

  it("meldet busy, solange der Wechsel läuft, und lehnt einen zweiten Weltvorgang mit 409 ab", async () => {
    h.fake.state.startDelayMs = 500;

    await h.request("/api/places/2/load", { method: "POST" });

    expect((await h.request("/api/status")).body.busy).toBe(true);
    expect((await h.request("/api/places/1/load", { method: "POST" })).status).toBe(409);
    expect((await h.request("/api/places/2", { method: "DELETE" })).status).toBe(409);
    await expect.poll(notBusy).toBe(false);
  });

  it("lehnt die bereits aktive Welt ab, ohne etwas zu senden", async () => {
    h.fake.calls.length = 0;

    const res = await h.request("/api/places/1/load", { method: "POST" });

    expect(res.status).toBe(409);
    expect(h.fake.commands()).toEqual([]);
  });

  it("lehnt einen leeren Platz mit 404 ab", async () => {
    expect((await h.request("/api/places/3/load", { method: "POST" })).status).toBe(404);
  });

  it.each(["0", "11", "x"])("lehnt die Platznummer %s mit 400 ab", async (n) => {
    expect((await h.request(`/api/places/${n}/load`, { method: "POST" })).status).toBe(400);
  });

  it("gibt die Sperre wieder frei, wenn der Neustart fehlschlägt", async () => {
    h.fake.state.status = "STOPPED";

    await h.request("/api/places/2/load", { method: "POST" });

    // Ohne laufenden Server lehnt BSM Befehle ab, der Weltwechsel bricht ab.
    await expect.poll(notBusy).toBe(false);
    expect(h.fake.state.properties["level-name"]).toBe("Bedrock level");
  });
});
