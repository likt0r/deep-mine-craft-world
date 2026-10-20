import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());
beforeEach(() => h.fake.reset());

describe("POST /api/difficulty", () => {
  it("sendet den Befehl, setzt die Property ohne Neustart und speichert die Schwierigkeit in der aktiven Welt", async () => {
    h.fake.state.properties["level-name"] = "Pandaland";
    await h.request("/api/places"); // Migration anstoßen

    const res = await h.request("/api/difficulty", { method: "POST", body: { difficulty: "hard" } });

    expect(res.status).toBe(200);
    expect(h.fake.commands()).toContain("difficulty hard");
    expect(h.fake.state.properties.difficulty).toBe("hard");

    const places = await h.request("/api/places");
    expect(places.body.places[0].world.difficulty).toBe("hard");
  });

  it("lehnt ungültige Werte mit 400 ab", async () => {
    const res = await h.request("/api/difficulty", { method: "POST", body: { difficulty: "easy-peasy" } });

    expect(res.status).toBe(400);
    expect(h.fake.commands().some((c) => c.includes("difficulty"))).toBe(false);
  });
});
