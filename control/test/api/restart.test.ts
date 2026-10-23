import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());
beforeEach(() => h.fake.reset());

const restarts = () =>
  h.fake.calls.filter((c) => c.method === "POST" && c.path === "/api/server/Bedrock/restart");

describe("POST /api/restart", () => {
  it("startet Minecraft über BSM neu", async () => {
    h.fake.state.startDelayMs = 300;

    const res = await h.request("/api/restart", { method: "POST" });

    expect(res.status).toBe(200);
    await expect.poll(() => restarts().length).toBe(1);
    await expect.poll(() => h.fake.state.status).toBe("RUNNING");
  });

  it("lehnt während eines Weltvorgangs mit 409 ab und ruft BSM nicht auf", async () => {
    await h.request("/api/places");
    h.fixture.seedPlace(2, { name: "Bauwelt", folder: "w-bauwelt" });
    h.fake.state.startDelayMs = 800;
    await h.request("/api/places/2/load", { method: "POST" });
    const before = restarts().length;

    const res = await h.request("/api/restart", { method: "POST" });

    expect(res.status).toBe(409);
    expect(restarts().length).toBe(before);
    await expect.poll(async () => (await h.request("/api/status")).body.busy).toBe(false);
  });
});
