import { readdir, readFile, stat, statfs } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { join } from "node:path";

/** Liest eine Datei als Text, `null` wenn es sie nicht gibt oder sie nicht lesbar ist. */
async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

/** Sensor-Chips der CPU unter /sys/class/hwmon (Intel, AMD, Raspberry Pi). */
const CPU_CHIPS = ["coretemp", "k10temp", "zenpower", "cpu_thermal"];

/** Höchste CPU-Temperatur in °C. Erst die hwmon-Chips der CPU, sonst eine passende thermal_zone. */
export async function readCpuTemp(sysDir: string): Promise<number | null> {
  const hwmon = join(sysDir, "class/hwmon");
  for (const dir of await readdir(hwmon).catch(() => [])) {
    const name = (await readText(join(hwmon, dir, "name")))?.trim();
    if (!name || !CPU_CHIPS.includes(name)) continue;
    const inputs = (await readdir(join(hwmon, dir))).filter((f) => /^temp\d+_input$/.test(f));
    const values = await Promise.all(inputs.map((f) => readText(join(hwmon, dir, f))));
    const temps = values.map(Number).filter((v) => Number.isFinite(v) && v > 0);
    if (temps.length) return Math.round(Math.max(...temps) / 1000);
  }

  // Ohne hwmon-Chip: nur Zonen, die wirklich die CPU messen (acpitz misst das Mainboard).
  const thermal = join(sysDir, "class/thermal");
  for (const dir of await readdir(thermal).catch(() => [])) {
    const type = (await readText(join(thermal, dir, "type")))?.trim();
    if (type !== "x86_pkg_temp" && type !== "cpu-thermal") continue;
    const temp = Number(await readText(join(thermal, dir, "temp")));
    if (Number.isFinite(temp) && temp > 0) return Math.round(temp / 1000);
  }
  return null;
}

export async function readCpuLoad(procDir: string): Promise<number | null> {
  const loadavg = await readText(join(procDir, "loadavg"));
  const load = Number(loadavg?.split(" ")[0]);
  if (!loadavg || !Number.isFinite(load)) return null;
  const cpuinfo = await readText(join(procDir, "cpuinfo"));
  const cores = cpuinfo?.match(/^processor\s*:/gm)?.length || availableParallelism();
  return Math.round((load / cores) * 100);
}

export async function readMemory(procDir: string): Promise<SystemInfo["memory"]> {
  const meminfo = await readText(join(procDir, "meminfo"));
  const kb = (key: string) => Number(meminfo?.match(new RegExp(`^${key}:\\s+(\\d+) kB`, "m"))?.[1]);
  const total = kb("MemTotal");
  const available = kb("MemAvailable");
  if (!Number.isFinite(total) || !Number.isFinite(available)) return null;
  return { totalBytes: total * 1024, availableBytes: available * 1024 };
}

export async function readDisk(path: string): Promise<SystemInfo["disk"]> {
  try {
    const fs = await statfs(path);
    return { totalBytes: fs.blocks * fs.bsize, availableBytes: fs.bavail * fs.bsize };
  } catch {
    return null;
  }
}

/** Ausgabe von `smartctl --json -x`. Nur die Felder, die wir brauchen. */
interface SmartJson {
  model_name?: string;
  smart_status?: { passed?: boolean };
  endurance_used?: { current_percent?: number };
  nvme_smart_health_information_log?: { percentage_used?: number };
}

export async function readSsd(smartFile: string): Promise<SystemInfo["ssd"]> {
  const text = await readText(smartFile);
  if (!text) return null;
  let smart: SmartJson;
  try {
    smart = JSON.parse(text);
  } catch {
    return null;
  }
  // Ohne Gesamturteil hat smartctl die Platte nicht lesen können.
  if (typeof smart.smart_status?.passed !== "boolean") return null;
  return {
    model: smart.model_name ?? null,
    healthy: smart.smart_status.passed,
    wearPercent:
      smart.endurance_used?.current_percent ??
      smart.nvme_smart_health_information_log?.percentage_used ??
      null
  };
}

export async function readSystemUptime(procDir: string): Promise<number | null> {
  const seconds = Number((await readText(join(procDir, "uptime")))?.split(" ")[0]);
  return Number.isFinite(seconds) ? Math.floor(seconds) : null;
}

/**
 * Seit wann Minecraft läuft: Bedrock schreibt beim Start „[2026-10-23 09:51:47:873 INFO] Starting Server“
 * in die Ausgabedatei, die BSM bei jedem Start neu beginnt. Die Zeit ist die Ortszeit des Servers.
 */
export async function readMinecraftUptime(serverDir: string, now = new Date()): Promise<number | null> {
  const output = await readText(join(serverDir, "server_output.txt"));
  const match = output?.match(/^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}):\d+ INFO\] Starting Server/m);
  if (!match) return null;
  const started = new Date(`${match[1]}T${match[2]}`);
  const seconds = Math.floor((now.getTime() - started.getTime()) / 1000);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/** Neueste Datei im Backup-Ordner (bis drei Ebenen tief), `null` wenn es keine gibt. */
export async function readLastBackup(backupDir: string): Promise<string | null> {
  let newest = 0;
  async function walk(dir: string, depth: number) {
    for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const path = join(dir, entry.name);
      if (entry.isDirectory() && depth < 3) await walk(path, depth + 1);
      else if (entry.isFile()) newest = Math.max(newest, (await stat(path)).mtimeMs);
    }
  }
  await walk(backupDir, 1);
  return newest ? new Date(newest).toISOString() : null;
}
