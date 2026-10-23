import { existsSync, readFileSync, writeFileSync } from "node:fs";

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

const nm = (): NmState =>
  existsSync(h.fixture.nmcliState) ? JSON.parse(readFileSync(h.fixture.nmcliState, "utf8")) : initialState();
const setNm = (change: (state: NmState) => void) => {
  const state = nm();
  change(state);
  writeFileSync(h.fixture.nmcliState, JSON.stringify(state));
};
/** Alle Aufrufe von nmcli, in Reihenfolge. */
const calls = (): string[][] =>
  existsSync(`${h.fixture.nmcliState}.calls`)
    ? readFileSync(`${h.fixture.nmcliState}.calls`, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
    : [];
/** Aufrufe von nmcli, die etwas ändern (add, modify, up, delete). */
const changes = () => calls().filter((c) => c[0] === "connection" && c[1] !== "show");

describe("GET /api/wifi", () => {
  it("eigenes WLAN aktiv: AP mit Passwort und Geräten, sichtbare WLANs ohne das eigene", async () => {
    const res = await h.request("/api/wifi");

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("ap");
    expect(res.body.client).toBeNull();
    expect(res.body.ap).toEqual({
      ssid: "MINECRAFT-World",
      password: "deep-mine-craft",
      active: true,
      devices: 2,
      ip: "10.42.0.1"
    });
    expect(res.body.saved).toEqual([]);
    // Je SSID der stärkste Eintrag, das eigene WLAN nicht, „:“ im Namen richtig gelesen.
    expect(res.body.available).toEqual([
      { ssid: "Zuhause", signal: 72, secured: true, saved: false },
      { ssid: "Nachbar:in", signal: 31, secured: true, saved: false },
      { ssid: "Café offen", signal: 25, secured: false, saved: false }
    ]);
    expect(res.body.availableStale).toBe(true);
  });

  it("mit einem hinterlegten WLAN verbunden: Name, Signal und IP", async () => {
    setNm((s) => {
      s.connections.push({ name: "dmc-wlan-1", ssid: "Zuhause", psk: "geheim123", mode: "infrastructure" });
      s.active = "dmc-wlan-1";
    });

    const res = await h.request("/api/wifi");

    expect(res.body.mode).toBe("client");
    expect(res.body.client).toEqual({ ssid: "Zuhause", signal: 72, ip: "192.168.178.57" });
    expect(res.body.ap).toMatchObject({ active: false, devices: null, ip: null });
    expect(res.body.saved).toEqual([{ id: 1, ssid: "Zuhause", active: true }]);
    expect(res.body.available[0]).toMatchObject({ ssid: "Zuhause", saved: true });
    expect(res.body.availableStale).toBe(false);
    // Passwörter hinterlegter WLANs kommen nie heraus.
    expect(JSON.stringify(res.body)).not.toContain("geheim123");
  });

  it("läuft NetworkManager nicht: 503", async () => {
    setNm((s) => {
      s.broken = true;
    });

    expect((await h.request("/api/wifi")).status).toBe(503);
  });
});

describe("hinterlegte WLANs", () => {
  it("hinzufügen legt ein Profil mit Priorität 10 an und verbindet", async () => {
    const res = await h.request("/api/wifi/networks", {
      method: "POST",
      body: { ssid: "Zuhause", password: "geheim123" }
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 1 });
    await expect.poll(() => nm().active).toBe("dmc-wlan-1");
    expect(changes()).toEqual([
      [
        "connection",
        "add",
        "type",
        "wifi",
        "ifname",
        "wlp3s0",
        "con-name",
        "dmc-wlan-1",
        "ssid",
        "Zuhause",
        "wifi-sec.key-mgmt",
        "wpa-psk",
        "wifi-sec.psk",
        "geheim123",
        "connection.autoconnect",
        "yes",
        "connection.autoconnect-priority",
        "10"
      ],
      ["connection", "up", "dmc-wlan-1"]
    ]);
  });

  it("ein offenes WLAN braucht kein Passwort", async () => {
    await h.request("/api/wifi/networks", { method: "POST", body: { ssid: "Café offen", password: "" } });

    const add = changes().find((c: string[]) => c[1] === "add")!;
    expect(add).not.toContain("wifi-sec.psk");
  });

  it("nicht in Reichweite: das eigene WLAN bleibt", async () => {
    await h.request("/api/wifi/networks", {
      method: "POST",
      body: { ssid: "Ferienhaus", password: "geheim123" }
    });

    await expect.poll(() => changes().some((c: string[]) => c[1] === "up")).toBe(true);
    expect(nm().active).toBe("dmc-ap");
    expect((await h.request("/api/wifi")).body.saved).toEqual([{ id: 1, ssid: "Ferienhaus", active: false }]);
  });

  it.each([
    [{ ssid: "", password: "geheim123" }],
    [{ ssid: "x".repeat(33), password: "geheim123" }],
    [{ ssid: "Zuhause", password: "kurz" }],
    [{ ssid: "Zuhause", password: "x".repeat(64) }],
    [{ ssid: "Zuhause\n", password: "geheim123" }],
    [{ ssid: "Zuhause" }]
  ])("lehnt %j mit 400 ab, ohne nmcli zu ändern", async (body) => {
    const res = await h.request("/api/wifi/networks", { method: "POST", body });

    expect(res.status).toBe(400);
    expect(changes()).toEqual([]);
  });

  it("dasselbe WLAN zweimal: 409", async () => {
    await h.request("/api/wifi/networks", {
      method: "POST",
      body: { ssid: "Zuhause", password: "geheim123" }
    });

    const res = await h.request("/api/wifi/networks", {
      method: "POST",
      body: { ssid: "Zuhause", password: "anderes12" }
    });

    expect(res.status).toBe(409);
  });

  it("entfernen löscht das Profil; ohne WLAN kommt das eigene zurück", async () => {
    await h.request("/api/wifi/networks", {
      method: "POST",
      body: { ssid: "Zuhause", password: "geheim123" }
    });
    await expect.poll(() => nm().active).toBe("dmc-wlan-1");

    const res = await h.request("/api/wifi/networks/1", { method: "DELETE" });

    expect(res.status).toBe(200);
    expect(nm().connections.map((c: { name: string }) => c.name)).toEqual(["dmc-ap"]);
    expect(nm().active).toBe("dmc-ap");
  });

  it("verbinden schaltet auf ein hinterlegtes WLAN", async () => {
    setNm((s) => {
      s.connections.push({ name: "dmc-wlan-2", ssid: "Zuhause", psk: "geheim123", mode: "infrastructure" });
    });

    const res = await h.request("/api/wifi/networks/2/connect", { method: "POST" });

    expect(res.status).toBe(200);
    await expect.poll(() => nm().active).toBe("dmc-wlan-2");
  });

  it("fremde oder fehlende Profile: 404, das eigene WLAN ist nicht löschbar", async () => {
    expect((await h.request("/api/wifi/networks/7", { method: "DELETE" })).status).toBe(404);
    expect((await h.request("/api/wifi/networks/7/connect", { method: "POST" })).status).toBe(404);
    expect((await h.request("/api/wifi/networks/dmc-ap", { method: "DELETE" })).status).toBe(404);
    expect(nm().connections.map((c: { name: string }) => c.name)).toEqual(["dmc-ap"]);
  });
});

describe("PUT /api/wifi/ap", () => {
  it("ändert Name und Passwort und startet das eigene WLAN neu", async () => {
    const res = await h.request("/api/wifi/ap", {
      method: "PUT",
      body: { ssid: "Deep Mine", password: "neues-passwort" }
    });

    expect(res.status).toBe(200);
    expect(nm().connections[0]).toMatchObject({ ssid: "Deep Mine", psk: "neues-passwort" });
    await expect.poll(() => changes().some((c: string[]) => c[1] === "up" && c[2] === "dmc-ap")).toBe(true);
  });

  it("ist das eigene WLAN nicht aktiv, wird nur gespeichert", async () => {
    setNm((s) => {
      s.connections.push({ name: "dmc-wlan-1", ssid: "Zuhause", psk: "geheim123", mode: "infrastructure" });
      s.active = "dmc-wlan-1";
    });

    await h.request("/api/wifi/ap", {
      method: "PUT",
      body: { ssid: "Deep Mine", password: "neues-passwort" }
    });

    expect(nm().active).toBe("dmc-wlan-1");
    expect(changes().some((c: string[]) => c[1] === "up")).toBe(false);
  });

  it("ein AP braucht ein Passwort mit mindestens 8 Zeichen", async () => {
    const res = await h.request("/api/wifi/ap", { method: "PUT", body: { ssid: "Deep Mine", password: "" } });

    expect(res.status).toBe(400);
    expect(changes()).toEqual([]);
  });
});

describe("Offline-Modus", () => {
  it("zeigt und setzt online-mode, startet dann neu", async () => {
    h.fake.state.properties["online-mode"] = "true";
    expect((await h.request("/api/offline")).body).toEqual({ offline: false });

    const res = await h.request("/api/offline", { method: "PUT", body: { offline: true } });

    expect(res.status).toBe(200);
    expect(h.fake.state.properties["online-mode"]).toBe("false");
    await expect.poll(() => h.fake.calls.some((c) => c.path.endsWith("/restart"))).toBe(true);
    expect((await h.request("/api/offline")).body).toEqual({ offline: true });
  });

  it("lehnt während eines Weltvorgangs mit 409 ab", async () => {
    await h.request("/api/places");
    h.fixture.seedPlace(2, { name: "Bauwelt", folder: "w-bauwelt" });
    h.fake.state.startDelayMs = 800;
    await h.request("/api/places/2/load", { method: "POST" });

    const res = await h.request("/api/offline", { method: "PUT", body: { offline: true } });

    expect(res.status).toBe(409);
    expect(h.fake.state.properties["online-mode"]).toBeUndefined();
    await expect.poll(async () => (await h.request("/api/status")).body.busy).toBe(false);
  });

  it("lehnt Unsinn mit 400 ab", async () => {
    expect((await h.request("/api/offline", { method: "PUT", body: { offline: "ja" } })).status).toBe(400);
  });
});
