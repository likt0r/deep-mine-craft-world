import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { ServerFixture } from "./fixture";

function write(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/** Werte wie auf dem echten Server (4 Kerne, 6,4 GB, SanDisk-SSD), nach Bedarf überschreibbar. */
export interface SystemFiles {
  /** Kerntemperaturen des coretemp-Chips in m°C. `null`: kein CPU-Chip. */
  coreTemps?: number[] | null;
  /** Weitere hwmon-Chips, die nicht die CPU messen */
  otherChips?: { name: string; temp: number }[];
  loadavg?: string;
  cores?: number;
  meminfo?: { totalKb: number; availableKb: number } | null;
  uptime?: string;
  /** Inhalt der SMART-Datei. `null`: keine Datei. */
  smart?: unknown;
}

export const REAL_SMART = {
  model_name: "SanDisk SSD U110 32GB",
  smart_status: { passed: true },
  endurance_used: { current_percent: 6 }
};

/** Legt /proc-, /sys- und SMART-Dateien in der Fixture an. */
export function writeSystemFiles(fixture: ServerFixture, files: SystemFiles = {}) {
  const {
    coreTemps = [39000, 38000, 34000, 28000],
    otherChips = [{ name: "acpitz", temp: 26800 }],
    loadavg = "0.48 0.30 0.20 1/238 2343",
    cores = 4,
    meminfo = { totalKb: 6730656, availableKb: 5777860 },
    uptime = "4198.12 16145.82",
    smart = REAL_SMART
  } = files;

  let n = 0;
  for (const chip of otherChips) {
    const dir = join(fixture.sysDir, "class/hwmon", `hwmon${n++}`);
    write(join(dir, "name"), `${chip.name}\n`);
    write(join(dir, "temp1_input"), `${chip.temp}\n`);
  }
  if (coreTemps) {
    const dir = join(fixture.sysDir, "class/hwmon", `hwmon${n}`);
    write(join(dir, "name"), "coretemp\n");
    coreTemps.forEach((temp, i) => {
      write(join(dir, `temp${i + 2}_input`), `${temp}\n`);
      write(join(dir, `temp${i + 2}_label`), `Core ${i}\n`);
    });
  }

  write(join(fixture.procDir, "loadavg"), `${loadavg}\n`);
  write(
    join(fixture.procDir, "cpuinfo"),
    Array.from({ length: cores }, (_, i) => `processor\t: ${i}\nmodel name\t: Test CPU\n`).join("\n")
  );
  if (meminfo)
    write(
      join(fixture.procDir, "meminfo"),
      `MemTotal:        ${meminfo.totalKb} kB\nMemFree:          100000 kB\nMemAvailable:    ${meminfo.availableKb} kB\n`
    );
  write(join(fixture.procDir, "uptime"), `${uptime}\n`);
  if (smart !== null) write(fixture.smartFile, typeof smart === "string" ? smart : JSON.stringify(smart));
}
