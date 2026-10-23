import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Das eigene WLAN (AP) und die hinterlegten WLANs, wie install.sh und diese Datei sie anlegen. */
export const AP_PROFILE = "dmc-ap";
const SAVED_PREFIX = "dmc-wlan-";
/** Hinterlegte WLANs vor dem AP: NetworkManager nimmt beim Verbinden die höchste Priorität. */
const SAVED_PRIORITY = "10";

/** Ruft nmcli ohne Shell auf, mit englischer Ausgabe. */
async function nmcli(...args: string[]): Promise<string> {
  const { nmcliPath } = useRuntimeConfig();
  const { stdout } = await run(nmcliPath, args, { env: { ...process.env, LC_ALL: "C" }, timeout: 20_000 });
  return stdout;
}

/** Startet nmcli, ohne zu warten: Verbinden dauert, und die Seite folgt über den Status. */
function nmcliInBackground(...args: string[]): void {
  nmcli(...args).catch((error) => console.error(`nmcli ${args.join(" ")} fehlgeschlagen:`, error));
}

/** Zerlegt eine Zeile von `nmcli -t`: Felder durch „:“ getrennt, „\:“ und „\\“ sind maskiert. */
export function splitTerse(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === "\\" && i + 1 < line.length) current += line[++i];
    else if (char === ":") {
      fields.push(current);
      current = "";
    } else current += char;
  }
  fields.push(current);
  return fields;
}

const lines = (text: string) => text.split("\n").filter((line) => line.length > 0);

interface Profile {
  name: string;
  device: string;
}

async function profiles(): Promise<Profile[]> {
  return lines(await nmcli("-t", "-f", "NAME,DEVICE", "connection", "show")).map((line) => {
    const [name = "", device = ""] = splitTerse(line);
    return { name, device };
  });
}

/** Nummer eines hinterlegten WLANs aus dem Profilnamen, sonst null. */
function savedId(name: string): number | null {
  const match = name.match(/^dmc-wlan-(\d+)$/);
  return match ? Number(match[1]) : null;
}

/** Zahl der Geräte am eigenen WLAN, `null` wenn iw nicht antwortet. */
async function apDevices(): Promise<number | null> {
  const { iwPath, wifiDevice } = useRuntimeConfig();
  try {
    const { stdout } = await run(iwPath, ["dev", wifiDevice, "station", "dump"], { timeout: 5000 });
    return (stdout.match(/^Station /gm) ?? []).length;
  } catch {
    return null;
  }
}

/**
 * Ob das WLAN eingeschaltet sein soll. Liest der Wächter deep-mine-wifi-check (root), schreibt Deep Mine
 * Control. Fehlt die Datei, ist das WLAN an.
 */
async function readEnabled(): Promise<boolean> {
  try {
    return JSON.parse(await readFile(useRuntimeConfig().wifiSettingsFile, "utf8")).enabled !== false;
  } catch {
    return true;
  }
}

/** Schaltet das WLAN ein oder aus und merkt sich das. Aus bleibt aus, bis auf den Rettungsmodus. */
export async function setWifiEnabled(enabled: boolean): Promise<void> {
  await writeFile(useRuntimeConfig().wifiSettingsFile, JSON.stringify({ enabled }) + "\n");
  // Gleich wirksam; der Wächter hält es danach jede Minute so.
  nmcliInBackground("radio", "wifi", enabled ? "on" : "off");
}

export async function readWifi(): Promise<WifiInfo> {
  const { wifiDevice, wifiRescueFile } = useRuntimeConfig();
  const [all, enabled, radioText] = await Promise.all([
    profiles(),
    readEnabled(),
    nmcli("-t", "radio", "wifi")
  ]);
  const radio = radioText.trim() === "enabled";
  const activeName = all.find((p) => p.device === wifiDevice)?.name ?? null;

  const [apLines, ipText, scanText] = await Promise.all([
    nmcli("-s", "-g", "802-11-wireless.ssid,802-11-wireless-security.psk", "connection", "show", AP_PROFILE),
    nmcli("-g", "IP4.ADDRESS", "device", "show", wifiDevice).catch(() => ""),
    nmcli("-t", "-f", "IN-USE,SSID,SIGNAL,SECURITY", "device", "wifi", "list", "ifname", wifiDevice).catch(
      () => ""
    )
  ]);
  const [apSsid = "", apPassword = ""] = apLines.split("\n");
  const ip = ipText.split("\n")[0]?.split("/")[0] || null;

  const saved = await Promise.all(
    all
      .filter((p) => savedId(p.name) !== null)
      .map(async (p) => ({
        id: savedId(p.name)!,
        ssid: (await nmcli("-g", "802-11-wireless.ssid", "connection", "show", p.name)).trim(),
        active: p.name === activeName
      }))
  );
  saved.sort((a, b) => a.id - b.id);

  // Sichtbare WLANs: das eigene raus, je SSID nur der stärkste Eintrag.
  const seen = new Map<string, WifiInfo["available"][number]>();
  let clientSignal: number | null = null;
  for (const line of lines(scanText)) {
    const [inUse = "", ssid = "", signal = "0", security = ""] = splitTerse(line);
    if (!ssid || ssid === apSsid) continue;
    if (inUse === "*") clientSignal = Number(signal);
    const entry = {
      ssid,
      signal: Number(signal),
      secured: security.trim() !== "" && security.trim() !== "--",
      saved: saved.some((s) => s.ssid === ssid)
    };
    if ((seen.get(ssid)?.signal ?? -1) < entry.signal) seen.set(ssid, entry);
  }

  const apActive = activeName === AP_PROFILE;
  const activeSaved = saved.find((s) => s.active);
  return {
    enabled,
    radio,
    rescue: !enabled && radio && existsSync(wifiRescueFile),
    mode: !radio ? "off" : apActive ? "ap" : activeSaved ? "client" : "off",
    client: activeSaved ? { ssid: activeSaved.ssid, signal: clientSignal, ip } : null,
    ap: {
      ssid: apSsid,
      password: apPassword,
      active: apActive,
      devices: apActive ? await apDevices() : null,
      ip: apActive ? ip : null
    },
    saved,
    available: [...seen.values()].sort((a, b) => b.signal - a.signal),
    availableStale: apActive
  };
}

/** Legt ein hinterlegtes WLAN an und verbindet sich damit (im Hintergrund). */
export async function addSavedNetwork(ssid: string, password: string): Promise<number> {
  const all = await profiles();
  const ids = new Set(all.map((p) => savedId(p.name)).filter((id) => id !== null));
  let id = 1;
  while (ids.has(id)) id++;
  const name = `${SAVED_PREFIX}${id}`;

  const security = password ? ["wifi-sec.key-mgmt", "wpa-psk", "wifi-sec.psk", password] : [];
  await nmcli(
    "connection",
    "add",
    "type",
    "wifi",
    "ifname",
    useRuntimeConfig().wifiDevice,
    "con-name",
    name,
    "ssid",
    ssid,
    ...security,
    "connection.autoconnect",
    "yes",
    "connection.autoconnect-priority",
    SAVED_PRIORITY
  );
  nmcliInBackground("connection", "up", name);
  return id;
}

/** Name des Profils eines hinterlegten WLANs, `null` wenn es das nicht gibt. */
export async function savedProfile(id: number): Promise<string | null> {
  const name = `${SAVED_PREFIX}${id}`;
  return (await profiles()).some((p) => p.name === name) ? name : null;
}

export async function deleteSavedNetwork(name: string): Promise<void> {
  await nmcli("connection", "delete", name);
}

export function connectSavedNetwork(name: string): void {
  nmcliInBackground("connection", "up", name);
}

/** Ändert Name und Passwort des eigenen WLANs. Läuft es gerade, startet es mit den neuen Werten neu. */
export async function updateAccessPoint(ssid: string, password: string): Promise<void> {
  await nmcli("connection", "modify", AP_PROFILE, "802-11-wireless.ssid", ssid, "wifi-sec.psk", password);
  const active = (await profiles()).some((p) => p.name === AP_PROFILE && p.device);
  if (active) nmcliInBackground("connection", "up", AP_PROFILE);
}
