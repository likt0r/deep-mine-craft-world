import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Dateien zum root-Helfer deep-mine-ethernet (server/ethernet.py). Deep Mine Control schreibt nur
 * Anfragen und Bestätigungen; anwenden, zurücknehmen und den Stand schreiben tut der Helfer.
 */
function files() {
  const { dataDir } = useRuntimeConfig();
  return {
    request: join(dataDir, "ethernet-request.json"),
    confirm: join(dataDir, "ethernet-confirm.json"),
    state: join(dataDir, "ethernet-state.json")
  };
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

async function json<T>(command: string, args: string[]): Promise<T | null> {
  try {
    const { stdout } = await run(command, args, { timeout: 5000 });
    return JSON.parse(stdout) as T;
  } catch {
    return null;
  }
}

interface IpLink {
  address?: string;
  flags?: string[];
  addr_info?: { family: string; local: string; prefixlen: number; dynamic?: boolean }[];
}

type HelperState = Partial<NonNullable<EthernetInfo["change"]>>;

async function readChange(): Promise<EthernetInfo["change"]> {
  const { request, state } = files();
  const pending = await readJson<{ id: string } & EthernetSetting>(request);
  if (pending) {
    const { id, ...setting } = pending;
    return { id, phase: "requested", deadline: null, setting, newAddress: null, error: null };
  }
  const helper = await readJson<HelperState>(state);
  if (!helper?.phase) return null;
  return {
    id: helper.id ?? null,
    phase: helper.phase,
    deadline: helper.deadline ?? null,
    setting: helper.setting ?? null,
    newAddress: helper.newAddress ?? null,
    error: helper.error ?? null
  };
}

export async function readEthernet(): Promise<EthernetInfo> {
  const { ipPath, resolvectlPath, sysDir, ethernetDevice: device } = useRuntimeConfig();
  const [links, routes, dnsInfo, speedText, change] = await Promise.all([
    json<IpLink[]>(ipPath, ["-j", "addr", "show", "dev", device]),
    json<{ gateway?: string; dev?: string }[]>(ipPath, ["-j", "-4", "route", "show", "default"]),
    json<{ ifname: string; servers?: { addressString: string }[] }[]>(resolvectlPath, [
      "--json=short",
      "dns",
      device
    ]),
    readFile(join(sysDir, "class/net", device, "speed"), "utf8").catch(() => ""),
    readChange()
  ]);

  const link = links?.[0];
  const v4 = link?.addr_info?.find((a) => a.family === "inet");
  const carrier = link?.flags?.includes("LOWER_UP") ?? false;
  const speed = Number(speedText);

  return {
    device,
    carrier,
    speed: carrier && speed > 0 ? speed : null,
    mac: link?.address ?? null,
    // Kein „dynamic“ an der Adresse heißt: fest eingestellt.
    mode: v4 && !v4.dynamic ? "static" : "dhcp",
    address: v4?.local ?? null,
    prefix: v4?.prefixlen ?? null,
    gateway: routes?.find((r) => r.dev === device)?.gateway ?? null,
    dns: (dnsInfo?.find((d) => d.ifname === device)?.servers ?? [])
      .map((s) => s.addressString)
      .filter(isIPv4),
    change
  };
}

/** Ob gerade eine Änderung läuft, die erst übernommen oder bestätigt werden muss. */
export function isEthernetChangeOpen(change: EthernetInfo["change"]): boolean {
  return change?.phase === "requested" || change?.phase === "pending";
}

export async function requestEthernet(setting: EthernetSetting): Promise<string> {
  const id = randomUUID();
  await writeFile(files().request, JSON.stringify({ id, ...setting }) + "\n");
  return id;
}

export async function confirmEthernet(id: string): Promise<void> {
  await writeFile(files().confirm, JSON.stringify({ id }) + "\n");
}
