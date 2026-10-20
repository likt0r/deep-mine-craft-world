import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { WORLD_NAME_MAX } from "../../shared/utils/worldName";
import { startHarness, type ControlHarness } from "../support/app";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());
beforeEach(async () => {
  // Läuft aus einem vorigen Test noch ein Weltvorgang, hier dessen Ende abwarten.
  await expect.poll(async () => (await h.request("/api/status")).body.busy).toBe(false);
  h.fake.reset();
});

/** Platz 1 als „Pandaland“ anlegen und die bisherigen BSM-Aufrufe zählen. */
async function migrate(): Promise<number> {
  h.fake.state.properties["level-name"] = "Pandaland";
  await h.request("/api/places");
  return h.fake.calls.length;
}

const normal = { name: "Bauwelt", type: "normal", mode: "creative" };

/** Die Aufrufe, die nach dem Anlegen auf einem Platz dazugekommen sind. */
function after(before: number) {
  return h.fake.calls.slice(before).map((call) => `${call.method} ${call.path}`);
}

/** Wartet, bis der Weltvorgang fertig ist (Status läuft wieder, busy weg). */
async function settled() {
  await expect.poll(() => h.fake.state.status).toBe("RUNNING");
  await expect.poll(async () => (await h.request("/api/status")).body.busy).toBe(false);
}

describe("POST /api/places/{n}", () => {
  it("legt die Welt an, setzt die Properties und startet neu", async () => {
    const before = await migrate();

    const res = await h.request("/api/places/2", { method: "POST", body: normal });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    await settled();
    expect(h.fake.state.properties).toMatchObject({
      "level-type": "DEFAULT",
      "level-seed": "",
      gamemode: "creative",
      difficulty: "normal"
    });
    // Der Weltordner ist nicht der Anzeigename, sondern ein eigener Name.
    const folder = h.fake.state.properties["level-name"] ?? "";
    expect(folder).not.toBe("Pandaland");
    expect(folder).not.toBe("Bauwelt");

    const calls = after(before);
    expect(calls).toContain("POST /api/server/Bedrock/properties/set");
    expect(calls).toContain("POST /api/server/Bedrock/restart");
  });

  it("lädt die neue Welt gleich als aktive Welt", async () => {
    await migrate();

    await h.request("/api/places/2", { method: "POST", body: normal });

    await settled();
    const places = await h.request("/api/places");
    const place2 = places.body.places.find((p: { place: number }) => p.place === 2);
    expect(place2.world.name).toBe("Bauwelt");
    expect(place2.active).toBe(true);
    const place1 = places.body.places.find((p: { place: number }) => p.place === 1);
    expect(place1.active).toBe(false);

    const status = await h.request("/api/status");
    expect(status.body.world).toBe("Bauwelt");
  });

  it("meldet busy, solange die neue Welt lädt, und danach wieder frei", async () => {
    h.fake.state.startDelayMs = 500;
    await migrate();

    await h.request("/api/places/2", { method: "POST", body: normal });

    const busy = await h.request("/api/status");
    expect(busy.body.busy).toBe(true);

    await settled();
  });

  it("setzt eine flache Welt auf FLAT", async () => {
    await migrate();

    await h.request("/api/places/3", { method: "POST", body: { ...normal, type: "flach" } });

    await settled();
    expect(h.fake.state.properties["level-type"]).toBe("FLAT");
    const places = await h.request("/api/places");
    expect(places.body.places.find((p: { place: number }) => p.place === 3).world.type).toBe("flach");
  });

  it("nimmt den gewählten Startmodus in die Welt auf", async () => {
    await migrate();

    await h.request("/api/places/4", { method: "POST", body: { ...normal, mode: "survival" } });

    await settled();
    expect(h.fake.state.properties.gamemode).toBe("survival");
    // Neue Welten starten mit Schwierigkeit „normal“.
    expect(h.fake.state.properties.difficulty).toBe("normal");
    const places = await h.request("/api/places");
    expect(places.body.places.find((p: { place: number }) => p.place === 4).world.mode).toBe("survival");
  });

  it.each([
    ["den leeren Namen", { ...normal, name: "" }],
    ["einen zu langen Namen", { ...normal, name: "a".repeat(WORLD_NAME_MAX + 1) }],
    ["einen Namen mit Steuerzeichen", { ...normal, name: "Bau\nwelt" }]
  ])("lehnt %s ab, ohne eine Welt anzulegen", async (_titel, body) => {
    const before = await migrate();

    const res = await h.request("/api/places/2", { method: "POST", body });

    expect(res.status).toBe(400);
    expect(after(before)).toEqual([]);
    const places = await h.request("/api/places");
    expect(places.body.places.find((p: { place: number }) => p.place === 2).world).toBeNull();
  });

  it("lehnt einen unbekannten Welttyp ab", async () => {
    await migrate();

    const res = await h.request("/api/places/2", {
      method: "POST",
      body: { ...normal, type: "riesig" }
    });

    expect(res.status).toBe(400);
  });

  it("lehnt einen belegten Platz ab", async () => {
    const before = await migrate();

    const res = await h.request("/api/places/1", { method: "POST", body: normal });

    expect(res.status).toBe(409);
    expect(after(before)).toEqual([]);
    const places = await h.request("/api/places");
    expect(places.body.places[0].world.name).toBe("Pandaland");
  });

  it.each(["0", "11", "halb"])("lehnt die Platznummer %s ab", async (n) => {
    const before = await migrate();

    const res = await h.request(`/api/places/${n}`, { method: "POST", body: normal });

    expect(res.status).toBe(400);
    expect(after(before)).toEqual([]);
  });
});

describe("POST /api/places/{n}: eindeutige Ordner", () => {
  it("gibt zwei nacheinander angelegten Welten verschiedene Ordner", async () => {
    await migrate();

    await h.request("/api/places/2", { method: "POST", body: normal });
    await settled();
    const first = h.fake.state.properties["level-name"];

    await h.request("/api/places/3", { method: "POST", body: { ...normal, name: "Zweite" } });
    await settled();
    const second = h.fake.state.properties["level-name"];

    expect(first).not.toBe(second);
  });

  it("gibt nach dem Löschen auf demselben Platz einen neuen Ordner, alte Backups gehören nicht dazu", async () => {
    await migrate();
    await h.request("/api/places/2", { method: "POST", body: normal });
    await settled();
    const first = h.fake.state.properties["level-name"];

    // Zurück zu Platz 1, dann die erste Welt löschen und neu anlegen.
    await h.request("/api/places/1/load", { method: "POST" });
    await settled();
    expect((await h.request("/api/places/2", { method: "DELETE" })).status).toBe(200);
    await h.request("/api/places/2", { method: "POST", body: { ...normal, name: "Neu" } });
    await settled();

    expect(h.fake.state.properties["level-name"]).not.toBe(first);
  });
});

describe("POST /api/places/{n}: Sperre für Weltvorgänge", () => {
  it("weist ein zweites Anlegen ab, solange das erste lädt", async () => {
    h.fake.state.startDelayMs = 500;
    await migrate();

    const first = await h.request("/api/places/2", { method: "POST", body: normal });
    expect(first.status).toBe(200);

    const second = await h.request("/api/places/3", {
      method: "POST",
      body: { ...normal, name: "Zweite" }
    });
    expect(second.status).toBe(409);

    await settled();
    const places = await h.request("/api/places");
    expect(places.body.places.find((p: { place: number }) => p.place === 3).world).toBeNull();
  });
});
