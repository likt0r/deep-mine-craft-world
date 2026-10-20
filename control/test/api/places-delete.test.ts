import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());
beforeEach(() => h.fake.reset());

/** Platz 1 „Pandaland“ migrieren und eine zweite Welt auf Platz 2 anlegen. */
async function migrate(levelName = "Pandaland"): Promise<void> {
  h.fake.state.properties["level-name"] = levelName;
  await h.request("/api/places");
}

/** Eine Welt samt Backups im temporären Server-Ordner anlegen. */
function addWorld(folder: string): void {
  h.fixture.addWorld(folder);
  writeFileSync(join(h.fixture.backupDir, `${folder}_backup_2026-01-01.mcworld`), "backup");
}

/** Die Plätze-Datei direkt schreiben, um einen manipulierten Ordner zu prüfen. */
function writePlace(folder: string): void {
  mkdirSync(h.fixture.dataDir, { recursive: true });
  const places = JSON.parse(readFileSync(join(h.fixture.dataDir, "places.json"), "utf8")) as {
    place: number;
    world: WorldInfo;
  }[];
  places[1] = {
    place: 2,
    world: {
      name: "Wandert",
      folder,
      type: "normal",
      mode: "creative",
      difficulty: "normal",
      createdAt: new Date().toISOString()
    }
  };
  writeFileSync(join(h.fixture.dataDir, "places.json"), JSON.stringify(places, null, 2) + "\n");
}

describe("DELETE /api/places/{n}", () => {
  it("löscht Weltordner, passende Backups und den Eintrag; Backups anderer Welten bleiben", async () => {
    await migrate();
    addWorld("Panda Zwei");
    writePlace("Panda Zwei");
    writeFileSync(join(h.fixture.backupDir, "Pandaland_backup_2026-01-01.mcworld"), "backup");

    const res = await h.request("/api/places/2", { method: "DELETE" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(existsSync(join(h.fixture.worldsDir, "Panda Zwei"))).toBe(false);
    expect(existsSync(join(h.fixture.backupDir, "Panda Zwei_backup_2026-01-01.mcworld"))).toBe(false);
    // Das Backup einer anderen Welt bleibt liegen.
    expect(existsSync(join(h.fixture.backupDir, "Pandaland_backup_2026-01-01.mcworld"))).toBe(true);

    const places = await h.request("/api/places");
    expect(places.body.places[1]).toEqual({ place: 2, world: null, active: false });
  });

  it("löscht nichts an der aktiven Welt und antwortet 409", async () => {
    await migrate("Bedrock level");
    addWorld("Bedrock level");

    const res = await h.request("/api/places/1", { method: "DELETE" });

    expect(res.status).toBe(409);
    expect(existsSync(join(h.fixture.worldsDir, "Bedrock level"))).toBe(true);

    const places = await h.request("/api/places");
    expect(places.body.places[0].world.name).toBe("Pandaland");
    expect(places.body.places[0].active).toBe(true);
  });

  it("löscht einen manipulierten Ordnereintrag außerhalb des Weltenordners nicht", async () => {
    await migrate();
    const outside = join(h.fixture.root, "noch-da");
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "wichtig.txt"), "bleibt");
    writePlace("../noch-da");

    const res = await h.request("/api/places/2", { method: "DELETE" });

    expect(res.status).toBe(400);
    expect(existsSync(join(outside, "wichtig.txt"))).toBe(true);

    const places = await h.request("/api/places");
    expect(places.body.places[1].world.folder).toBe("../noch-da");
  });

  it("lehnt einen leeren Platz ab", async () => {
    await migrate();

    const res = await h.request("/api/places/2", { method: "DELETE" });

    expect(res.status).toBe(404);
  });

  it.each(["0", "11", "halb"])("lehnt die Platznummer %s ab", async (n) => {
    const res = await h.request(`/api/places/${n}`, { method: "DELETE" });

    expect(res.status).toBe(400);
  });

  it("gilt für die Sperre für Weltvorgänge: während eines anderen Vorgangs kommt 409", async () => {
    await migrate();
    h.fake.state.propertiesDelayMs = 200;

    // Ein zweites Löschen hängt in properties/get fest und hält die Sperre kurz offen.
    const first = h.request("/api/places/1", { method: "DELETE" });
    await expect.poll(() => h.fake.calls.some((c) => c.path.endsWith("/properties/get"))).toBe(true);

    const second = await h.request("/api/places/2", { method: "DELETE" });

    expect(second.status).toBe(409);
    expect((await first).status).toBe(409);
  });
});
