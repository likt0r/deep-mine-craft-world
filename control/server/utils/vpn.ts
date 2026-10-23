import { execFile } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** NetworkManager benennt die Verbindung nach dem Dateinamen der importierten Konfiguration. */
export const VPN_PROFILE = "dmc-vpn";

/** Was die Seite anzeigt, ohne Schlüssel. Wird beim Hochladen aus der Konfiguration gelesen. */
type VpnMeta = Pick<VpnInfo, "address" | "endpoints" | "dns" | "fullTunnel">;

const KEY = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw480]=$/;
const INTERFACE_KEYS = ["PrivateKey", "Address", "DNS", "ListenPort", "MTU"];
const PEER_KEYS = ["PublicKey", "PresharedKey", "AllowedIPs", "Endpoint", "PersistentKeepalive"];

/**
 * Prüft eine WireGuard-Konfiguration und liest die Angaben für die Anzeige. Wirft mit einer verständlichen
 * Meldung, wenn etwas nicht stimmt. PreUp/PostUp & Co. führt NetworkManager nicht aus: abgelehnt, damit
 * niemand sich darauf verlässt.
 */
export function parseWireguard(text: string): VpnMeta {
  if (text.length > 16_384) throw new Error("Die Datei ist zu groß");
  const sections: { name: string; values: Record<string, string> }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const section = line.match(/^\[(Interface|Peer)\]$/i);
    if (section) {
      sections.push({ name: section[1]!.toLowerCase(), values: {} });
      continue;
    }
    const pair = line.match(/^([A-Za-z]+)\s*=\s*(.+)$/);
    const current = sections.at(-1);
    if (!pair || !current) throw new Error(`Unbekannte Zeile: ${line.slice(0, 40)}`);
    const allowed = current.name === "interface" ? INTERFACE_KEYS : PEER_KEYS;
    const key = allowed.find((k) => k.toLowerCase() === pair[1]!.toLowerCase());
    if (!key) throw new Error(`„${pair[1]}“ wird nicht unterstützt`);
    current.values[key] = pair[2]!.trim();
  }

  const interfaces = sections.filter((s) => s.name === "interface");
  const peers = sections.filter((s) => s.name === "peer");
  if (interfaces.length !== 1) throw new Error("Es braucht genau einen Abschnitt [Interface]");
  if (peers.length === 0) throw new Error("Es fehlt ein Abschnitt [Peer]");
  const iface = interfaces[0]!.values;
  if (!KEY.test(iface.PrivateKey ?? "")) throw new Error("PrivateKey fehlt oder ist ungültig");
  if (!iface.Address) throw new Error("Address fehlt");
  for (const peer of peers) {
    if (!KEY.test(peer.values.PublicKey ?? ""))
      throw new Error("PublicKey eines Peers fehlt oder ist ungültig");
    if (!peer.values.Endpoint) throw new Error("Endpoint eines Peers fehlt");
    if (!peer.values.AllowedIPs) throw new Error("AllowedIPs eines Peers fehlt");
  }

  const list = (value?: string) =>
    (value ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  const allowedIps = peers.flatMap((p) => list(p.values.AllowedIPs));
  return {
    address: list(iface.Address),
    endpoints: peers.map((p) => p.values.Endpoint!),
    dns: list(iface.DNS),
    fullTunnel: allowedIps.some((ip) => ip === "0.0.0.0/0" || ip === "::/0")
  };
}

async function nmcli(...args: string[]): Promise<string> {
  const { stdout } = await run(useRuntimeConfig().nmcliPath, args, {
    env: { ...process.env, LC_ALL: "C" },
    timeout: 20_000
  });
  return stdout;
}

function metaFile() {
  return join(useRuntimeConfig().dataDir, "vpn.json");
}

async function profileDevice(): Promise<string | null | undefined> {
  for (const line of (await nmcli("-t", "-f", "NAME,DEVICE", "connection", "show")).split("\n")) {
    const [name, device] = splitTerse(line);
    if (name === VPN_PROFILE) return device || null;
  }
  return undefined;
}

export async function readVpn(): Promise<VpnInfo> {
  const device = await profileDevice();
  if (device === undefined)
    return {
      configured: false,
      active: false,
      autoconnect: false,
      address: [],
      endpoints: [],
      dns: [],
      fullTunnel: false
    };
  const [autoconnect, meta] = await Promise.all([
    nmcli("-g", "connection.autoconnect", "connection", "show", VPN_PROFILE),
    readFile(metaFile(), "utf8")
      .then((t) => JSON.parse(t) as VpnMeta)
      .catch(() => null)
  ]);
  return {
    configured: true,
    active: device !== null,
    autoconnect: autoconnect.trim() === "yes",
    address: meta?.address ?? [],
    endpoints: meta?.endpoints ?? [],
    dns: meta?.dns ?? [],
    fullTunnel: meta?.fullTunnel ?? false
  };
}

/**
 * Importiert eine geprüfte Konfiguration als `dmc-vpn` (ersetzt eine alte) und verbindet im Hintergrund. Die
 * Datei mit dem privaten Schlüssel liegt nur für den Import im Datenordner und wird gleich wieder gelöscht.
 */
export async function importVpn(text: string, autoconnect: boolean): Promise<void> {
  const meta = parseWireguard(text);
  const file = join(useRuntimeConfig().dataDir, `${VPN_PROFILE}.conf`);
  if ((await profileDevice()) !== undefined) await nmcli("connection", "delete", VPN_PROFILE);
  try {
    await writeFile(file, text, { mode: 0o600 });
    await nmcli("connection", "import", "type", "wireguard", "file", file);
  } finally {
    await rm(file, { force: true });
  }
  await nmcli("connection", "modify", VPN_PROFILE, "connection.autoconnect", autoconnect ? "yes" : "no");
  await writeFile(metaFile(), JSON.stringify(meta) + "\n");
  connectVpn(true);
}

/** Verbinden oder trennen, im Hintergrund: Die Seite folgt über den Status. */
export function connectVpn(active: boolean): void {
  nmcli("connection", active ? "up" : "down", VPN_PROFILE).catch((error) =>
    console.error(`VPN ${active ? "verbinden" : "trennen"} fehlgeschlagen:`, error)
  );
}

export async function setVpnAutoconnect(enabled: boolean): Promise<void> {
  await nmcli("connection", "modify", VPN_PROFILE, "connection.autoconnect", enabled ? "yes" : "no");
}

export async function deleteVpn(): Promise<void> {
  await nmcli("connection", "delete", VPN_PROFILE);
  await rm(metaFile(), { force: true });
}

export async function vpnConfigured(): Promise<boolean> {
  return (await profileDevice()) !== undefined;
}
