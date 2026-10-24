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

  it("meldet standardmäßig offenen Zugang, Mitglieder und keinen Offline-Modus", async () => {
    const res = await h.request("/api/players");

    expect(res.body).toMatchObject({ closed: false, newPlayers: "member", offlineMode: false });
  });

  it("liest Zugang, Recht für neue Spieler und Offline-Modus aus den Eigenschaften", async () => {
    h.fake.state.properties["allow-list"] = "true";
    h.fake.state.properties["default-player-permission-level"] = "visitor";
    h.fake.state.properties["online-mode"] = "false";

    const res = await h.request("/api/players");

    expect(res.body).toMatchObject({ closed: true, newPlayers: "visitor", offlineMode: true });
  });

  it("meldet Operator für neue Spieler als Mitglied", async () => {
    h.fake.state.properties["default-player-permission-level"] = "operator";

    const res = await h.request("/api/players");

    expect(res.body.newPlayers).toBe("member");
  });
});

describe("PUT /api/players/access", () => {
  it("schließt den Zugang bei gestopptem Server nur in den Eigenschaften", async () => {
    h.fake.state.status = "STOPPED";

    const res = await h.request("/api/players/access", { method: "PUT", body: { closed: true } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(h.fake.state.properties["allow-list"]).toBe("true");
    expect(h.fake.commands()).toEqual([]);
  });

  it("schließt den Zugang am laufenden Server zusätzlich mit allowlist on", async () => {
    const res = await h.request("/api/players/access", { method: "PUT", body: { closed: true } });

    expect(res.status).toBe(200);
    expect(h.fake.state.properties["allow-list"]).toBe("true");
    expect(h.fake.commands()).toEqual(["allowlist on"]);
  });

  it("öffnet den Zugang am laufenden Server mit allowlist off", async () => {
    h.fake.state.properties["allow-list"] = "true";

    const res = await h.request("/api/players/access", { method: "PUT", body: { closed: false } });

    expect(res.status).toBe(200);
    expect(h.fake.state.properties["allow-list"]).toBe("false");
    expect(h.fake.commands()).toEqual(["allowlist off"]);
  });

  it.each(["visitor", "member"] as const)("setzt neue Spieler auf %s", async (newPlayers) => {
    const res = await h.request("/api/players/access", { method: "PUT", body: { newPlayers } });

    expect(res.status).toBe(200);
    expect(h.fake.state.properties["default-player-permission-level"]).toBe(newPlayers);
    expect(h.fake.commands()).toEqual([]);
  });

  it("lehnt Operator für neue Spieler ab und ändert nichts", async () => {
    const res = await h.request("/api/players/access", {
      method: "PUT",
      body: { newPlayers: "operator" }
    });

    expect(res.status).toBe(400);
    expect(h.fake.state.properties["default-player-permission-level"]).toBeUndefined();
    expect(h.fake.commands()).toEqual([]);
  });

  it("verlangt Zugang oder Recht für neue Spieler", async () => {
    const res = await h.request("/api/players/access", { method: "PUT", body: {} });

    expect(res.status).toBe(400);
    expect(h.fake.commands()).toEqual([]);
  });

  it("fragt beim Schließen mit Online-Spielern ohne Whitelist nach und ändert nichts", async () => {
    h.fake.state.players = ["Lena"];
    h.fake.state.allowlist = [whitelistEntry("Tom")];

    const res = await h.request("/api/players/access", { method: "PUT", body: { closed: true } });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("Lena");
    expect(h.fake.state.properties["allow-list"]).toBeUndefined();
    expect(h.fake.state.allowlist).toEqual([whitelistEntry("Tom")]);
    expect(h.fake.state.players).toEqual(["Lena"]);
    expect(h.fake.commands()).toEqual([]);
  });

  it("schließt den Zugang und setzt Online-Spieler ohne Whitelist auf die Whitelist", async () => {
    h.fake.state.players = ["Lena", "Ben"];
    h.fake.state.allowlist = [whitelistEntry("Lena")];

    const res = await h.request("/api/players/access", {
      method: "PUT",
      body: { closed: true, onlineNotListed: "whitelist" }
    });

    expect(res.status).toBe(200);
    expect(h.fake.state.allowlist).toEqual([whitelistEntry("Lena"), whitelistEntry("Ben")]);
    expect(h.fake.state.properties["allow-list"]).toBe("true");
    expect(h.fake.commands()).toEqual(["allowlist reload", "allowlist on"]);
  });

  it("schließt den Zugang und kickt Online-Spieler ohne Whitelist", async () => {
    h.fake.state.players = ["Lena", "Ben"];
    h.fake.state.allowlist = [whitelistEntry("Lena")];

    const res = await h.request("/api/players/access", {
      method: "PUT",
      body: { closed: true, onlineNotListed: "kick" }
    });

    expect(res.status).toBe(200);
    expect(h.fake.state.players).toEqual(["Lena"]);
    expect(h.fake.state.properties["allow-list"]).toBe("true");
    expect(h.fake.commands()).toEqual(['kick "Ben" Der Server ist jetzt geschlossen.', "allowlist on"]);
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

describe("POST /api/players/kick", () => {
  it("kickt einen Online-Spieler mit Nachricht, in der Schreibweise aus dem Spiel", async () => {
    h.fake.state.players = ["Lena", "Tom"];

    const res = await h.request("/api/players/kick", {
      method: "POST",
      body: { name: "lena", reason: " Zeit fürs Abendessen! " }
    });

    expect(res.status).toBe(200);
    expect(h.fake.commands()).toEqual(['kick "Lena" Zeit fürs Abendessen!']);
    expect(h.fake.state.players).toEqual(["Tom"]);
  });

  it.each([{}, { reason: "" }])("kickt ohne Nachricht nur mit dem Namen (%j)", async (extra) => {
    h.fake.state.players = ["Lena"];

    const res = await h.request("/api/players/kick", { method: "POST", body: { name: "Lena", ...extra } });

    expect(res.status).toBe(200);
    expect(h.fake.commands()).toEqual(['kick "Lena"']);
    expect(h.fake.state.players).toEqual([]);
  });

  it("antwortet 409, wenn der Server nicht läuft", async () => {
    h.fake.state.status = "STOPPED";

    const res = await h.request("/api/players/kick", { method: "POST", body: { name: "Lena" } });

    expect(res.status).toBe(409);
    expect(h.fake.commands()).toEqual([]);
  });

  it("antwortet 404, wenn der Spieler nicht online ist", async () => {
    h.fake.state.players = ["Tom"];
    h.fake.state.knownPlayers = [{ name: "Lena", xuid: "2000" }];

    const res = await h.request("/api/players/kick", { method: "POST", body: { name: "Lena" } });

    expect(res.status).toBe(404);
    expect(h.fake.commands()).toEqual([]);
    expect(h.fake.state.players).toEqual(["Tom"]);
  });

  it.each([
    { name: "Lena", reason: 'Sag "Tschüss"' },
    { name: "Lena", reason: "Tschüss'" },
    { name: "Lena", reason: "Tschüss\nop Lena" },
    { name: "Lena", reason: "Tschüss\n" },
    { name: "Lena", reason: "x".repeat(81) },
    { name: "Lena", reason: 42 },
    { name: 'Lena"' },
    { name: "" },
    { reason: "Tschüss" }
  ])("lehnt %j ab und schickt keinen Befehl", async (body) => {
    h.fake.state.players = ["Lena"];

    const res = await h.request("/api/players/kick", { method: "POST", body });

    expect(res.status).toBe(400);
    expect(h.fake.commands()).toEqual([]);
    expect(h.fake.state.players).toEqual(["Lena"]);
  });

  it("80 Zeichen Nachricht sind erlaubt", async () => {
    h.fake.state.players = ["Lena"];
    const reason = "x".repeat(80);

    const res = await h.request("/api/players/kick", { method: "POST", body: { name: "Lena", reason } });

    expect(res.status).toBe(200);
    expect(h.fake.commands()).toEqual([`kick "Lena" ${reason}`]);
  });
});
