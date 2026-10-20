import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());
beforeEach(() => h.fake.reset());

describe("POST /api/time", () => {
  it.each([
    ["morgen", "time set sunrise"],
    ["mittag", "time set noon"],
    ["abend", "time set sunset"],
    ["nacht", "time set midnight"]
  ])("stellt die Zeit auf %s und sendet den Befehl", async (time, command) => {
    const res = await h.request("/api/time", { method: "POST", body: { time } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(h.fake.commands()).toEqual([command]);
  });

  it.each([["vormittag"], ["SOMMER"], [""]])("lehnt %s mit 400 ab und sendet nichts", async (time) => {
    const res = await h.request("/api/time", { method: "POST", body: { time } });

    expect(res.status).toBe(400);
    expect(h.fake.commands()).toEqual([]);
  });

  it("lehnt eine Anfrage ohne Zeitangabe mit 400 ab", async () => {
    const res = await h.request("/api/time", { method: "POST", body: {} });

    expect(res.status).toBe(400);
    expect(h.fake.commands()).toEqual([]);
  });
});

describe("POST /api/weather", () => {
  it.each([
    ["sonne", "weather clear"],
    ["regen", "weather rain"],
    ["gewitter", "weather thunder"]
  ])("stellt das Wetter auf %s und sendet den Befehl", async (weather, command) => {
    const res = await h.request("/api/weather", { method: "POST", body: { weather } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(h.fake.commands()).toEqual([command]);
  });

  it.each([["hagel"], ["RAIN"], [""]])("lehnt %s mit 400 ab und sendet nichts", async (weather) => {
    const res = await h.request("/api/weather", { method: "POST", body: { weather } });

    expect(res.status).toBe(400);
    expect(h.fake.commands()).toEqual([]);
  });

  it("lehnt eine Anfrage ohne Wetterangabe mit 400 ab", async () => {
    const res = await h.request("/api/weather", { method: "POST", body: {} });

    expect(res.status).toBe(400);
    expect(h.fake.commands()).toEqual([]);
  });
});
