import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());
beforeEach(() => h.fake.reset());

describe("POST /api/gamemode", () => {
  it("sendet den Befehl, setzt die Property ohne Neustart und speichert den Modus in der aktiven Welt", async () => {
    h.fake.state.properties["level-name"] = "Pandaland";
    await h.request("/api/places"); // Migration anstoßen

    const res = await h.request("/api/gamemode", { method: "POST", body: { mode: "survival" } });

    expect(res.status).toBe(200);
    expect(h.fake.commands()).toContain("gamemode survival @a");
    expect(h.fake.state.properties.gamemode).toBe("survival");

    const places = await h.request("/api/places");
    expect(places.body.places[0].world.mode).toBe("survival");
  });

  it("lehnt ungültige Werte mit 400 ab", async () => {
    const res = await h.request("/api/gamemode", { method: "POST", body: { mode: "invalid" } });

    expect(res.status).toBe(400);
    expect(h.fake.commands().some((c) => c.includes("gamemode"))).toBe(false);
  });
});
