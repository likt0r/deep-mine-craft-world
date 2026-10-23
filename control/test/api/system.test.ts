import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startHarness, type ControlHarness } from "../support/app";
import { writeSystemFiles } from "../support/system-files";

let h: ControlHarness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(() => h.close());
beforeEach(() => h.fake.reset());

/** Zeitstempel wie in der Ausgabe von Bedrock, in Ortszeit. */
function bedrockStamp(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}:123`;
}

describe("GET /api/system", () => {
  it("liest CPU, Speicher, SSD, Laufzeiten und Version", async () => {
    writeSystemFiles(h.fixture);
    const started = new Date(Date.now() - 600_000);
    writeFileSync(
      h.fixture.outputFile,
      `NO LOG FILE! - setting up server logging...\n[${bedrockStamp(started)} INFO] Starting Server\n`
    );

    const res = await h.request("/api/system");

    expect(res.status).toBe(200);
    expect(res.body.cpu).toEqual({ tempC: 39, loadPercent: 12 });
    expect(res.body.memory).toEqual({ totalBytes: 6730656 * 1024, availableBytes: 5777860 * 1024 });
    expect(res.body.ssd).toEqual({ model: "SanDisk SSD U110 32GB", healthy: true, wearPercent: 6 });
    expect(res.body.uptime.systemSeconds).toBe(4198);
    expect(res.body.uptime.minecraftSeconds).toBeGreaterThanOrEqual(599);
    expect(res.body.uptime.minecraftSeconds).toBeLessThan(620);
    expect(res.body.minecraft).toEqual({ version: "1.26.52.3" });
  });

  it("misst die Platte mit dem Server-Ordner", async () => {
    const res = await h.request("/api/system");

    expect(res.body.disk.totalBytes).toBeGreaterThan(0);
    expect(res.body.disk.availableBytes).toBeGreaterThan(0);
    expect(res.body.disk.availableBytes).toBeLessThanOrEqual(res.body.disk.totalBytes);
  });

  it("nimmt die CPU-Kerne, nicht die Mainboard-Zone", async () => {
    writeSystemFiles(h.fixture, { coreTemps: [51000, 47000], otherChips: [{ name: "acpitz", temp: 80000 }] });

    const res = await h.request("/api/system");

    expect(res.body.cpu.tempC).toBe(51);
  });

  it("fehlende Sensoren und Dateien ergeben null statt eines Fehlers", async () => {
    writeSystemFiles(h.fixture, { coreTemps: null, otherChips: [], meminfo: null, smart: null });

    const res = await h.request("/api/system");

    expect(res.status).toBe(200);
    expect(res.body.cpu.tempC).toBeNull();
    expect(res.body.memory).toBeNull();
    expect(res.body.ssd).toBeNull();
    expect(res.body.lastBackup).toBeNull();
    expect(res.body.uptime.minecraftSeconds).toBeNull();
  });

  it("ganz ohne /proc und /sys antwortet die API trotzdem", async () => {
    const res = await h.request("/api/system");

    expect(res.status).toBe(200);
    expect(res.body.cpu).toEqual({ tempC: null, loadPercent: null });
    expect(res.body.uptime.systemSeconds).toBeNull();
  });

  it("smart_status.passed: false heißt „nicht gesund“", async () => {
    writeSystemFiles(h.fixture, { smart: { model_name: "Alte Platte", smart_status: { passed: false } } });

    const res = await h.request("/api/system");

    expect(res.body.ssd).toEqual({ model: "Alte Platte", healthy: false, wearPercent: null });
  });

  it("eine kaputte SMART-Datei oder eine ohne Gesamturteil ergibt null", async () => {
    writeSystemFiles(h.fixture, { smart: "{ kaputt" });
    expect((await h.request("/api/system")).body.ssd).toBeNull();

    writeSystemFiles(h.fixture, { smart: { smartctl: { exit_status: 2 } } });
    expect((await h.request("/api/system")).body.ssd).toBeNull();
  });

  it("NVMe: der Verschleiß kommt aus percentage_used", async () => {
    writeSystemFiles(h.fixture, {
      smart: { smart_status: { passed: true }, nvme_smart_health_information_log: { percentage_used: 3 } }
    });

    const res = await h.request("/api/system");

    expect(res.body.ssd).toEqual({ model: null, healthy: true, wearPercent: 3 });
  });

  it("Minecraft aus: keine Laufzeit für Minecraft", async () => {
    writeFileSync(h.fixture.outputFile, `[${bedrockStamp(new Date())} INFO] Starting Server\n`);
    h.fake.state.status = "STOPPED";

    const res = await h.request("/api/system");

    expect(res.body.uptime.minecraftSeconds).toBeNull();
  });

  it("letzte Sicherung ist die neueste Datei im Backup-Ordner", async () => {
    const dir = join(h.fixture.backupDir, "world-a");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "alt.mcworld"), "");
    writeFileSync(join(dir, "neu.mcworld"), "");
    utimesSync(join(dir, "alt.mcworld"), new Date("2026-10-01T10:00:00Z"), new Date("2026-10-01T10:00:00Z"));
    utimesSync(join(dir, "neu.mcworld"), new Date("2026-10-22T18:30:00Z"), new Date("2026-10-22T18:30:00Z"));

    const res = await h.request("/api/system");

    expect(res.body.lastBackup).toBe("2026-10-22T18:30:00.000Z");
  });
});
