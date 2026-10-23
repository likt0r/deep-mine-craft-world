import { existsSync } from "node:fs";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());
beforeEach(() => h.fake.reset());

/** Hält einen Weltvorgang offen: Platz 2 laden, der Neustart dauert. */
async function startWorldSwitch() {
  await h.request("/api/places");
  h.fixture.seedPlace(2, { name: "Bauwelt", folder: "w-bauwelt" });
  h.fake.state.startDelayMs = 800;
  await h.request("/api/places/2/load", { method: "POST" });
}

const settled = () => expect.poll(async () => (await h.request("/api/status")).body.busy).toBe(false);

describe("POST /api/stop", () => {
  it("stoppt Minecraft über BSM", async () => {
    const res = await h.request("/api/stop", { method: "POST" });

    expect(res.status).toBe(200);
    await expect.poll(() => h.fake.state.status).toBe("STOPPED");
    expect(h.fake.calls.some((c) => c.method === "POST" && c.path === "/api/server/Bedrock/stop")).toBe(true);
  });

  it("lehnt während eines Weltvorgangs mit 409 ab", async () => {
    await startWorldSwitch();

    const res = await h.request("/api/stop", { method: "POST" });

    expect(res.status).toBe(409);
    expect(h.fake.calls.some((c) => c.path.endsWith("/stop"))).toBe(false);
    await settled();
  });
});

describe.each([
  ["reboot", () => h.fixture.rebootMarker, () => h.fixture.poweroffMarker],
  ["poweroff", () => h.fixture.poweroffMarker, () => h.fixture.rebootMarker]
])("POST /api/system/%s", (kind, marker, other) => {
  it("führt den Befehl aus, und nur diesen", async () => {
    const res = await h.request(`/api/system/${kind}`, { method: "POST" });

    expect(res.status).toBe(200);
    await expect.poll(() => existsSync(marker()), { timeout: 3000 }).toBe(true);
    expect(existsSync(other())).toBe(false);
  });

  it("lehnt während eines Weltvorgangs mit 409 ab", async () => {
    await startWorldSwitch();

    const res = await h.request(`/api/system/${kind}`, { method: "POST" });

    expect(res.status).toBe(409);
    await settled();
    expect(existsSync(marker())).toBe(false);
  });
});
