import { appendFileSync } from "node:fs";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { RULE_NAMES } from "../../shared/types/rules";
import { startHarness, type ControlHarness } from "../support/app";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());
beforeEach(() => h.fake.reset());

describe("GET /api/rules", () => {
  it("liest die acht Regeln aus der Ausgabe von gamerule", async () => {
    h.fake.state.gamerules = {
      commandBlockOutput: "true",
      doDayLightCycle: "false",
      doWeatherCycle: "true",
      keepInventory: "false",
      doMobSpawning: "true",
      doFireTick: "true",
      tntExplodes: "false",
      pvp: "true",
      showCoordinates: "false"
    };

    const res = await h.request("/api/rules");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      dodaylightcycle: false,
      doweathercycle: true,
      keepinventory: false,
      domobspawning: true,
      dofiretick: true,
      tntexplodes: false,
      pvp: true,
      showcoordinates: false
    });
    expect(h.fake.commands()).toContain("gamerule");
  });

  it("liest nur die neue Ausgabe, auch wenn davor Umlaute und alte Regeln stehen", async () => {
    appendFileSync(h.fixture.outputFile, "[INFO] Player connected: Jürgen\n[INFO] keepInventory = true\n");
    h.fake.state.gamerules = { keepInventory: "false" };

    const res = await h.request("/api/rules");

    expect(res.body.keepinventory).toBe(false);
  });

  it("ohne passende Ausgabe kommen alle Regeln als unbekannt zurück", async () => {
    // gamerules bleibt null: das Fake-BSM schreibt nichts in die Ausgabedatei.
    const res = await h.request("/api/rules");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(Object.fromEntries(RULE_NAMES.map((name) => [name, null])));
  });
});

describe("POST /api/rules", () => {
  it.each(RULE_NAMES)("setzt %s per gamerule-Befehl", async (name) => {
    const res = await h.request("/api/rules", { method: "POST", body: { name, value: true } });

    expect(res.status).toBe(200);
    expect(h.fake.commands()).toContain(`gamerule ${name} true`);
  });

  it("schreibt den Wert false klein", async () => {
    const res = await h.request("/api/rules", {
      method: "POST",
      body: { name: "keepinventory", value: false }
    });

    expect(res.status).toBe(200);
    expect(h.fake.commands()).toContain("gamerule keepinventory false");
  });

  it("lehnt unbekannte Regeln ab", async () => {
    const res = await h.request("/api/rules", {
      method: "POST",
      body: { name: "commandblockoutput", value: true }
    });

    expect(res.status).toBe(400);
    expect(h.fake.commands()).toEqual([]);
  });

  it("lehnt Werte ab, die keine Wahrheitswerte sind", async () => {
    const res = await h.request("/api/rules", { method: "POST", body: { name: "pvp", value: "true" } });

    expect(res.status).toBe(400);
    expect(h.fake.commands()).toEqual([]);
  });
});
