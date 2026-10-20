import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());
beforeEach(() => h.fake.reset());

describe("GET /api/places", () => {
  it("liefert genau 10 Plätze, ohne Datei nur Platz 1 „Pandaland“", async () => {
    h.fake.state.properties["level-name"] = "Pandaland";

    const res = await h.request("/api/places");

    expect(res.status).toBe(200);
    expect(res.body.places).toHaveLength(10);
    expect(res.body.places[0]).toEqual({
      place: 1,
      world: {
        name: "Pandaland",
        folder: "Pandaland",
        type: "normal",
        mode: "creative",
        difficulty: "easy",
        createdAt: expect.any(String)
      },
      active: true
    });
    expect(res.body.places.slice(1)).toEqual(
      Array.from({ length: 9 }, (_, i) => ({ place: i + 2, world: null, active: false }))
    );
    expect(existsSync(join(h.fixture.dataDir, "places.json"))).toBe(true);
  });

  it("trägt bei der Migration Welttyp, Modus und Schwierigkeit aus den Properties ein", async () => {
    h.fake.state.properties = {
      ...h.fake.state.properties,
      "level-name": "Pandaland",
      gamemode: "survival",
      difficulty: "hard",
      "level-type": "FLAT"
    };

    const res = await h.request("/api/places");

    expect(res.body.places[0].world).toMatchObject({
      folder: "Pandaland",
      type: "flach",
      mode: "survival",
      difficulty: "hard"
    });
  });

  it("überschreibt eine vorhandene Plätze-Datei nicht", async () => {
    h.fake.state.properties["level-name"] = "Pandaland";
    const first = await h.request("/api/places");

    // Würde neu migriert, stünde jetzt ein anderer Modus in der Datei.
    h.fake.state.properties.gamemode = "adventure";
    const second = await h.request("/api/places");

    expect(second.body).toEqual(first.body);
    expect(second.body.places[0].world.mode).toBe("creative");
  });

  it("markiert nur die Welt als aktiv, deren Ordner dem level-name entspricht", async () => {
    h.fake.state.properties["level-name"] = "Pandaland";
    await h.request("/api/places");

    h.fake.state.properties["level-name"] = "Anderer Ordner";
    const res = await h.request("/api/places");

    expect(res.body.places[0].active).toBe(false);
    expect(res.body.places.some((p: { active: boolean }) => p.active)).toBe(false);
  });
});
