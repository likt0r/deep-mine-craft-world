import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";
import { makeMcworld } from "../support/mcworld";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());
beforeEach(async () => {
  h.fake.reset();
  await h.request("/api/places");
});

const tmp = mkdtempSync(join(tmpdir(), "dmc-import-"));
function world(files: Record<string, string>, name = "w.mcworld") {
  const path = join(tmp, `${Math.random().toString(36).slice(2)}-${name}`);
  makeMcworld(path, files);
  return readFileSync(path);
}

async function importWorld(
  place: number,
  body: Buffer | string,
  query = "name=Insel&type=normal&mode=survival"
) {
  const res = await fetch(`${h.app.url}/api/places/${place}/import?${query}`, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const places = async () => (await h.request("/api/places")).body.places;
const hidden = () => readdirSync(h.fixture.worldsDir).filter((d) => d.startsWith("."));

describe("PUT /api/places/{n}/import", () => {
  it("legt die Welt unter einem neuen Ordner auf den Platz, ohne etwas zu laden", async () => {
    const res = await importWorld(3, world({ "level.dat": "welt", "db/CURRENT": "x" }));

    expect(res.status).toBe(200);
    const entry = (await places())[2];
    expect(entry.world).toMatchObject({
      name: "Insel",
      type: "normal",
      mode: "survival",
      difficulty: "normal"
    });
    expect(entry.active).toBe(false);
    const dir = join(h.fixture.worldsDir, res.body.folder);
    expect(readFileSync(join(dir, "level.dat"), "utf8")).toBe("welt");
    expect(readFileSync(join(dir, "db/CURRENT"), "utf8")).toBe("x");
    expect(readFileSync(join(dir, "levelname.txt"), "utf8")).toBe("Insel");
    // Nichts geladen: kein Neustart, keine Properties.
    expect(h.fake.calls.some((c) => /\/(restart|properties\/set)$/.test(c.path))).toBe(false);
    expect(hidden()).toEqual([]);
    expect(readdirSync(h.fixture.dataDir).filter((f) => f.startsWith("import-"))).toEqual([]);
  });

  it("findet die Welt auch in genau einem Unterordner", async () => {
    const res = await importWorld(4, world({ "Meine Welt/level.dat": "welt", "Meine Welt/db/CURRENT": "x" }));

    expect(res.status).toBe(200);
    expect(readFileSync(join(h.fixture.worldsDir, res.body.folder, "level.dat"), "utf8")).toBe("welt");
  });

  it("die importierte Welt lässt sich danach laden", async () => {
    await importWorld(3, world({ "level.dat": "welt" }));

    expect((await h.request("/api/places/3/load", { method: "POST" })).status).toBe(200);
    await expect.poll(async () => (await places())[2].active).toBe(true);
  });

  it.each([
    ["ohne level.dat", () => world({ "irgendwas.txt": "x" }), "level.dat fehlt"],
    ["keine ZIP-Datei", () => Buffer.from("Hallo Welt"), "keine ZIP-Datei"],
    ["Pfad nach außen", () => world({ "level.dat": "x", "../ausbruch.txt": "x" }), "ungültiger Pfad"],
    ["ausgepackt zu groß", () => world({ "level.dat": "x".repeat(1_200_000) }), "zu groß"]
  ])("%s: 400 mit Grund, Platz bleibt frei, keine Reste", async (_, file, reason) => {
    const res = await importWorld(3, file());

    expect(res.status).toBe(400);
    expect(res.body.message).toContain(reason);
    expect((await places())[2].world).toBeNull();
    expect(hidden()).toEqual([]);
    expect(existsSync(join(h.fixture.root, "ausbruch.txt"))).toBe(false);
  });

  it("belegter Platz: 409", async () => {
    expect((await importWorld(1, world({ "level.dat": "x" }))).status).toBe(409);
  });

  it.each([
    "name=&type=normal&mode=survival",
    "name=Insel&type=rund&mode=survival",
    "name=Insel&type=normal&mode=god"
  ])("ungültige Angaben (%s): 400", async (query) => {
    expect((await importWorld(3, world({ "level.dat": "x" }), query)).status).toBe(400);
  });

  it("während eines Weltvorgangs 409, der Platz bleibt frei", async () => {
    h.fixture.seedPlace(2, { name: "Bauwelt", folder: "w-bauwelt" });
    h.fake.state.startDelayMs = 800;
    await h.request("/api/places/2/load", { method: "POST" });

    expect((await importWorld(3, world({ "level.dat": "x" }))).status).toBe(409);
    expect((await places())[2].world).toBeNull();
    await expect.poll(async () => (await h.request("/api/status")).body.busy).toBe(false);
  });
});
