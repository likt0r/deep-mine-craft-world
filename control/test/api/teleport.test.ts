import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());
beforeEach(() => h.fake.reset());

describe("POST /api/teleport", () => {
  it("holt alle Spieler zu einem Online-Spieler", async () => {
    h.fake.state.players = ["Lena", "Tom"];

    const res = await h.request("/api/teleport", { method: "POST", body: { player: "Lena" } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(h.fake.commands()).toEqual(['tp @a "Lena"']);
  });

  it("lehnt einen Namen ab, der nicht in der Online-Liste steht, und sendet nichts", async () => {
    h.fake.state.players = ["Lena"];

    const res = await h.request("/api/teleport", { method: "POST", body: { player: "Unbekannt" } });

    expect(res.status).toBe(400);
    expect(h.fake.calls.some((c) => c.path.endsWith("/send_command"))).toBe(false);
  });

  it.each(['Lena"; say tschuss', "Lena'; say tschuss", '"Lena"', "'Lena'"])(
    "lehnt den Namen %s mit Anführungszeichen ab, auch wenn er online ist, und sendet nichts",
    async (player) => {
      h.fake.state.players = [player, "Tom"];

      const res = await h.request("/api/teleport", { method: "POST", body: { player } });

      expect(res.status).toBe(400);
      expect(h.fake.calls.some((c) => c.path.endsWith("/send_command"))).toBe(false);
    }
  );

  it("lehnt eine Anfrage ohne Ziel ab", async () => {
    const res = await h.request("/api/teleport", { method: "POST", body: {} });

    expect(res.status).toBe(400);
    expect(h.fake.calls.some((c) => c.path.endsWith("/send_command"))).toBe(false);
  });
});
