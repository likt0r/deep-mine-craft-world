import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());
beforeEach(() => h.fake.reset());

describe("GET /api/status", () => {
  it("liefert Serverstatus, aktive Welt und Online-Spieler", async () => {
    h.fake.state.players = ["Lena", "Tom"];

    const res = await h.request("/api/status");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      state: "running",
      world: "Bedrock level",
      players: ["Lena", "Tom"],
      busy: false
    });
  });

  it.each([
    ["STARTING", "starting"],
    ["STOPPING", "starting"],
    ["STOPPED", "stopped"],
    ["ERROR", "stopped"]
  ])("übersetzt BSM-Status %s zu %s", async (bsmStatus, state) => {
    h.fake.state.status = bsmStatus;

    const res = await h.request("/api/status");

    expect(res.body.state).toBe(state);
  });

  it("meldet sich nach abgelaufenem Token einmal neu an und wiederholt die Anfrage", async () => {
    await h.request("/api/status");
    h.fake.expireTokens();
    h.fake.calls.length = 0;

    const res = await h.request("/api/status");

    expect(res.status).toBe(200);
    expect(h.fake.calls.filter((c) => c.path === "/auth/token")).toHaveLength(1);
  });
});

describe("POST /api/start", () => {
  it("startet den Server über BSM", async () => {
    h.fake.state.status = "STOPPED";

    const res = await h.request("/api/start", { method: "POST" });

    expect(res.status).toBe(200);
    await expect.poll(() => h.fake.state.status).toBe("RUNNING");
    expect(h.fake.calls.some((c) => c.method === "POST" && c.path === "/api/server/Bedrock/start")).toBe(
      true
    );
  });
});
