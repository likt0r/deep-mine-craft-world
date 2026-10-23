import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";
import { initialState } from "../support/fake-nmcli-state.mjs";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());
beforeEach(() => h.fake.reset());

type NmState = ReturnType<typeof initialState>;
const setNm = (change: (state: NmState) => void) => {
  const state = existsSync(h.fixture.nmcliState)
    ? JSON.parse(readFileSync(h.fixture.nmcliState, "utf8"))
    : initialState();
  change(state);
  writeFileSync(h.fixture.nmcliState, JSON.stringify(state));
};
const request = () => join(h.fixture.dataDir, "ethernet-request.json");
const helperState = (state: object) =>
  writeFileSync(join(h.fixture.dataDir, "ethernet-state.json"), JSON.stringify(state));

const STATIC = {
  mode: "static",
  address: "192.168.0.50",
  prefix: 24,
  gateway: "192.168.0.1",
  dns: ["192.168.0.5", "1.1.1.1"]
};

describe("GET /api/network/ethernet", () => {
  it("liest Kabel, Geschwindigkeit, MAC, Adresse, Gateway und DNS", async () => {
    mkdirSync(join(h.fixture.sysDir, "class/net/enp1s0"), { recursive: true });
    writeFileSync(join(h.fixture.sysDir, "class/net/enp1s0/speed"), "1000\n");

    const res = await h.request("/api/network/ethernet");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      device: "enp1s0",
      carrier: true,
      speed: 1000,
      mac: "40:62:31:00:42:8c",
      mode: "dhcp",
      address: "192.168.0.110",
      prefix: 24,
      gateway: "192.168.0.1",
      dns: ["192.168.0.5"],
      change: null
    });
  });

  it("ohne Kabel: kein Träger, keine Adresse; feste Adresse heißt „static“", async () => {
    setNm((s) => {
      s.wired = false;
    });
    expect((await h.request("/api/network/ethernet")).body).toMatchObject({
      carrier: false,
      speed: null,
      address: null
    });

    setNm((s) => {
      s.wired = true;
      s.ethernet.dynamic = false;
    });
    expect((await h.request("/api/network/ethernet")).body.mode).toBe("static");
  });
});

describe("PUT /api/network/ethernet", () => {
  it("schreibt eine geprüfte Anfrage für den root-Helfer", async () => {
    const res = await h.request("/api/network/ethernet", { method: "PUT", body: STATIC });

    expect(res.status).toBe(200);
    const written = JSON.parse(readFileSync(request(), "utf8"));
    expect(written).toEqual({ id: res.body.id, ...STATIC });
    expect((await h.request("/api/network/ethernet")).body.change).toMatchObject({
      phase: "requested",
      setting: STATIC
    });
  });

  it("DHCP braucht nichts weiter", async () => {
    await h.request("/api/network/ethernet", { method: "PUT", body: { mode: "dhcp" } });

    expect(JSON.parse(readFileSync(request(), "utf8"))).toMatchObject({ mode: "dhcp" });
  });

  it.each([
    [{ ...STATIC, address: "192.168.0.256" }],
    [{ ...STATIC, address: "192.168.0.0" }],
    [{ ...STATIC, address: "192.168.0.255" }],
    [{ ...STATIC, gateway: "10.0.0.1" }],
    [{ ...STATIC, gateway: "192.168.0.50" }],
    [{ ...STATIC, prefix: 31 }],
    [{ ...STATIC, prefix: 7 }],
    [{ ...STATIC, dns: ["1.1.1.1", "8.8.8.8", "9.9.9.9", "1.0.0.1"] }],
    [{ ...STATIC, dns: ["dns.example"] }],
    [{ mode: "manuell" }],
    [{ ...STATIC, address: "192.168.0.50; rm -rf /" }]
  ])("lehnt %j mit 400 ab und schreibt nichts", async (body) => {
    const res = await h.request("/api/network/ethernet", { method: "PUT", body });

    expect(res.status).toBe(400);
    expect(existsSync(request())).toBe(false);
  });

  it("solange eine Änderung offen ist: 409", async () => {
    helperState({
      id: "a",
      phase: "pending",
      deadline: Math.floor(Date.now() / 1000) + 100,
      setting: STATIC
    });

    expect((await h.request("/api/network/ethernet", { method: "PUT", body: { mode: "dhcp" } })).status).toBe(
      409
    );
  });
});

describe("POST /api/network/ethernet/confirm", () => {
  it("bestätigt die angewendete Änderung", async () => {
    helperState({ id: "abc", phase: "pending", deadline: 123, setting: STATIC, newAddress: "192.168.0.50" });

    const res = await h.request("/api/network/ethernet/confirm", { method: "POST" });

    expect(res.status).toBe(200);
    expect(JSON.parse(readFileSync(join(h.fixture.dataDir, "ethernet-confirm.json"), "utf8"))).toEqual({
      id: "abc"
    });
  });

  it("ohne offene Änderung: 409", async () => {
    expect((await h.request("/api/network/ethernet/confirm", { method: "POST" })).status).toBe(409);
    helperState({ id: "abc", phase: "confirmed" });
    expect((await h.request("/api/network/ethernet/confirm", { method: "POST" })).status).toBe(409);
  });
});
