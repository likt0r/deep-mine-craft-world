import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());
beforeEach(() => h.fake.reset());

const whitelistEntry = (name: string) => ({ name, xuid: null, ignoresPlayerLimit: false });

describe("GET /api/players", () => {
  it("führt Online-Spieler, bekannte Spieler und Whitelist zusammen: Online zuerst, dann nach Name", async () => {
    h.fake.state.knownPlayers = [
      { name: "Tom", xuid: "2000" },
      { name: "anna", xuid: "3000" }
    ];
    h.fake.state.players = ["Anna"];
    h.fake.state.allowlist = [whitelistEntry("tom"), whitelistEntry("Ben")];

    const res = await h.request("/api/players");

    expect(res.status).toBe(200);
    expect(res.body.players).toEqual([
      // Schreibweise aus dem Spiel, XUID aus den Logs
      { name: "Anna", xuid: "3000", online: true, whitelisted: false },
      // Nur auf der Whitelist, noch nie da gewesen
      { name: "Ben", xuid: null, online: false, whitelisted: true },
      { name: "Tom", xuid: "2000", online: false, whitelisted: true }
    ]);
  });

  it("kennt Online-Spieler auch, wenn BSM sie noch nicht in den Logs gefunden hat", async () => {
    h.fake.state.players = ["Neu"];

    const res = await h.request("/api/players");

    expect(res.body.players).toEqual([{ name: "Neu", xuid: "1000", online: true, whitelisted: false }]);
  });
});

describe("POST /api/players/whitelist", () => {
  it("setzt einen Gamertag auf die Whitelist, der laufende Server liest sie neu ein", async () => {
    const res = await h.request("/api/players/whitelist", { method: "POST", body: { name: " Steve#12 " } });

    expect(res.status).toBe(200);
    expect(h.fake.state.allowlist).toEqual([whitelistEntry("Steve#12")]);
    expect(h.fake.commands()).toEqual(["allowlist reload"]);
  });

  it("bei gestopptem Server nur in die Datei, ohne Befehl", async () => {
    h.fake.state.status = "STOPPED";

    const res = await h.request("/api/players/whitelist", { method: "POST", body: { name: "Steve" } });

    expect(res.status).toBe(200);
    expect(h.fake.state.allowlist).toEqual([whitelistEntry("Steve")]);
    expect(h.fake.commands()).toEqual([]);
  });

  it.each(['Steve"', "Steve'", "", "Ein viel zu langer Name", "Steve\nop Steve", "Stève"])(
    "lehnt den Gamertag %j ab und ändert nichts",
    async (name) => {
      const res = await h.request("/api/players/whitelist", { method: "POST", body: { name } });

      expect(res.status).toBe(400);
      expect(h.fake.state.allowlist).toEqual([]);
      expect(h.fake.commands()).toEqual([]);
    }
  );
});

describe("DELETE /api/players/whitelist", () => {
  it("nimmt einen Spieler von der Whitelist, der laufende Server liest sie neu ein", async () => {
    h.fake.state.allowlist = [whitelistEntry("Steve"), whitelistEntry("Lena")];

    const res = await h.request("/api/players/whitelist", { method: "DELETE", body: { name: "Steve" } });

    expect(res.status).toBe(200);
    expect(h.fake.state.allowlist).toEqual([whitelistEntry("Lena")]);
    expect(h.fake.commands()).toEqual(["allowlist reload"]);
  });
});
