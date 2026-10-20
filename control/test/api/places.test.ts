import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { WORLD_NAME_MAX } from "../../shared/utils/worldName";
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

describe("PATCH /api/places/{n}", () => {
  /** Platz 1 als „Pandaland“ anlegen und die bisherigen BSM-Aufrufe zählen. */
  async function migrate(): Promise<number> {
    h.fake.state.properties["level-name"] = "Pandaland";
    await h.request("/api/places");
    return h.fake.calls.length;
  }

  it("ändert nur den Anzeigename, ohne einen einzigen BSM-Aufruf", async () => {
    const before = await migrate();

    const res = await h.request("/api/places/1", { method: "PATCH", body: { name: "Panda Wiese" } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    // Kein Login, keine Properties, kein Neustart, kein Befehl.
    expect(h.fake.calls.slice(before)).toEqual([]);
    expect(h.fake.state.status).toBe("RUNNING");
    expect(h.fake.state.properties["level-name"]).toBe("Pandaland");

    const places = await h.request("/api/places");
    expect(places.body.places[0]).toEqual({
      place: 1,
      world: {
        name: "Panda Wiese",
        folder: "Pandaland",
        type: "normal",
        mode: "creative",
        difficulty: "easy",
        createdAt: expect.any(String)
      },
      active: true
    });
  });

  it("nennt die aktive Welt im Status mit dem neuen Namen", async () => {
    await migrate();
    await h.request("/api/places/1", { method: "PATCH", body: { name: "Panda Wiese" } });

    const res = await h.request("/api/status");

    expect(res.body.world).toBe("Panda Wiese");
  });

  it("schneidet Leerzeichen am Namen ab", async () => {
    await migrate();

    const res = await h.request("/api/places/1", { method: "PATCH", body: { name: "  Bär  " } });

    expect(res.status).toBe(200);
    const places = await h.request("/api/places");
    expect(places.body.places[0].world.name).toBe("Bär");
  });

  it.each(["", "   "])("lehnt den leeren Namen %j ab und lässt den alten stehen", async (name) => {
    await migrate();

    const res = await h.request("/api/places/1", { method: "PATCH", body: { name } });

    expect(res.status).toBe(400);
    const places = await h.request("/api/places");
    expect(places.body.places[0].world.name).toBe("Pandaland");
  });

  it("lehnt einen Namen ab, der zu lang ist", async () => {
    await migrate();

    const res = await h.request("/api/places/1", {
      method: "PATCH",
      body: { name: "a".repeat(WORLD_NAME_MAX + 1) }
    });

    expect(res.status).toBe(400);
    const places = await h.request("/api/places");
    expect(places.body.places[0].world.name).toBe("Pandaland");
  });

  it("nimmt genau die Grenze noch auf", async () => {
    await migrate();

    const res = await h.request("/api/places/1", {
      method: "PATCH",
      body: { name: "a".repeat(WORLD_NAME_MAX) }
    });

    expect(res.status).toBe(200);
    const places = await h.request("/api/places");
    expect(places.body.places[0].world.name).toBe("a".repeat(WORLD_NAME_MAX));
  });

  it("lehnt einen leeren Platz ab", async () => {
    await migrate();

    const res = await h.request("/api/places/2", { method: "PATCH", body: { name: "Neue Welt" } });

    expect(res.status).toBe(404);
    const places = await h.request("/api/places");
    expect(places.body.places[1]).toEqual({ place: 2, world: null, active: false });
  });

  it("lehnt einen Platz ab, bevor es eine Plätze-Datei gibt, ohne BSM zu fragen", async () => {
    const before = h.fake.calls.length;

    const res = await h.request("/api/places/1", { method: "PATCH", body: { name: "Neue Welt" } });

    expect(res.status).toBe(404);
    expect(h.fake.calls.slice(before)).toEqual([]);
    expect(existsSync(join(h.fixture.dataDir, "places.json"))).toBe(false);
  });

  it.each(["0", "11", "halb"])("lehnt die Platznummer %s ab", async (n) => {
    const res = await h.request(`/api/places/${n}`, { method: "PATCH", body: { name: "Neu" } });

    expect(res.status).toBe(400);
  });

  it("lehnt eine Anfrage ohne Namen ab", async () => {
    await migrate();

    const res = await h.request("/api/places/1", { method: "PATCH", body: {} });

    expect(res.status).toBe(400);
    const places = await h.request("/api/places");
    expect(places.body.places[0].world.name).toBe("Pandaland");
  });
});
