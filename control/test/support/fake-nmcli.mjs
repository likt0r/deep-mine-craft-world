#!/usr/bin/env node
// Nachgebautes nmcli (und iw) für Tests. Versteht nur die Aufrufe von server/utils/wifi.ts,
// mit derselben Ausgabe wie NetworkManager 1.5x. Der Zustand steht in $FAKE_NMCLI_STATE, jeder Aufruf
// als eine JSON-Zeile in $FAKE_NMCLI_STATE.calls. Die API ruft nmcli gleichzeitig auf: Lesen schreibt
// deshalb nichts, Ändern schreibt atomar (temporäre Datei, dann umbenennen).
import { appendFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

import { initialState } from "./fake-nmcli-state.mjs";

const file = process.env.FAKE_NMCLI_STATE;
const DEVICE = "wlp3s0";
const AP = "dmc-ap";

const state = file && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : initialState();
const args = process.argv.slice(2);
if (file) appendFileSync(`${file}.calls`, `${JSON.stringify(args)}\n`);
/** Nur nach Änderungen speichern. */
let changed = false;
const save = () => {
  if (!file || !changed) return;
  writeFileSync(`${file}.${process.pid}.tmp`, JSON.stringify(state, null, 2));
  renameSync(`${file}.${process.pid}.tmp`, file);
};
const fail = (code, message) => {
  save();
  process.stderr.write(`Error: ${message}\n`);
  process.exit(code);
};
const out = (text) => {
  save();
  if (text) process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
  process.exit(0);
};
const escape = (value) => String(value).replaceAll("\\", "\\\\").replaceAll(":", "\\:");
const find = (name) => state.connections.find((c) => c.name === name);
/** Schlüssel-Wert-Paare ab einer Stelle, z. B. `ssid X wifi-sec.psk Y`. */
const pairs = (from) => {
  const result = {};
  for (let i = from; i + 1 < args.length; i += 2) result[args[i]] = args[i + 1];
  return result;
};

if (state.broken) fail(8, "NetworkManager is not running.");

// --- iw dev wlp3s0 station dump ---
if (args[0] === "dev" && args[2] === "station") {
  const ap = state.active === AP;
  out(
    ap
      ? Array.from(
          { length: state.stations },
          (_, i) => `Station 02:00:00:00:00:0${i} (on ${DEVICE})\n\tsignal: -40 dBm`
        ).join("\n")
      : ""
  );
}

const joined = args.join(" ");

/** Wie NetworkManagers Autoconnect: das beste sichtbare hinterlegte WLAN, sonst das eigene. */
const autoconnect = () => {
  const visible = state.connections.find((c) => c.mode !== "ap" && state.scan.some((n) => n.ssid === c.ssid));
  state.active = visible ? visible.name : AP;
};

if (joined === "-t radio wifi") out(state.radio ? "enabled" : "disabled");

if (joined === "radio wifi on" || joined === "radio wifi off") {
  changed = true;
  state.radio = args[2] === "on";
  if (state.radio) autoconnect();
  else state.active = null;
  out("");
}

if (joined === `-g GENERAL.CONNECTION device show ${DEVICE}`) out(state.active ?? "");

if (joined === "-t -f NAME connection show") out(state.connections.map((c) => escape(c.name)).join("\n"));

if (args[0] === "connection" && args[1] === "down" && find(args[2])?.mode !== "wireguard") {
  changed = true;
  if (state.active === args[2]) state.active = null;
  out(`Connection '${args[2]}' successfully deactivated.`);
}

/** Gerät einer Verbindung: das WLAN für die aktive WLAN-Verbindung, eigenes Gerät für ein aktives VPN. */
const deviceOf = (c) =>
  c.mode === "wireguard" ? (c.up ? c.name : "") : state.active === c.name ? DEVICE : "";

if (joined === "-t -f NAME,DEVICE connection show")
  out(state.connections.map((c) => `${escape(c.name)}:${deviceOf(c)}`).join("\n"));

// --- WireGuard (VPN) ---
if (args[0] === "connection" && args[1] === "import" && args[3] === "wireguard" && args[4] === "file") {
  changed = true;
  const text = readFileSync(args[5], "utf8");
  const name = basename(args[5]).replace(/\.conf$/, "");
  if (!/PrivateKey/.test(text)) fail(1, "Error: failed to import: invalid secret 'PrivateKey'.");
  if (state.connections.some((c) => c.name === name)) fail(1, `Error: a connection '${name}' exists.`);
  state.connections.push({ name, mode: "wireguard", autoconnect: "yes", up: false, imported: text.length });
  out(`Connection '${name}' successfully added.`);
}

if (
  args[0] === "-g" &&
  args[1] === "connection.autoconnect" &&
  args[2] === "connection" &&
  args[3] === "show"
) {
  const c = find(args[4]);
  if (!c) fail(10, `${args[4]} - no such connection profile.`);
  out(c.autoconnect ?? "yes");
}

if (
  args[0] === "connection" &&
  (args[1] === "up" || args[1] === "down") &&
  find(args[2])?.mode === "wireguard"
) {
  changed = true;
  find(args[2]).up = args[1] === "up";
  out(
    args[1] === "up"
      ? "Connection successfully activated."
      : `Connection '${args[2]}' successfully deactivated.`
  );
}

if (joined.startsWith("-s -g 802-11-wireless.ssid,802-11-wireless-security.psk connection show ")) {
  const c = find(args.at(-1));
  if (!c) fail(10, `${args.at(-1)} - no such connection profile.`);
  out(`${c.ssid}\n${c.psk ?? ""}`);
}

if (joined.startsWith("-g 802-11-wireless.ssid connection show ")) {
  const c = find(args.at(-1));
  if (!c) fail(10, `${args.at(-1)} - no such connection profile.`);
  out(c.ssid);
}

if (joined === `-g IP4.ADDRESS device show ${DEVICE}`)
  out(state.active === AP ? "10.42.0.1/24" : state.active ? "192.168.178.57/24" : "");

if (joined === `-t -f IN-USE,SSID,SIGNAL,SECURITY device wifi list ifname ${DEVICE}`) {
  // Wie NetworkManager: „*“ nur am einen Zugangspunkt, der gerade benutzt wird (der erste, stärkste).
  const inUse = state.scan.find((n) => n.ssid === find(state.active)?.ssid);
  out(
    state.scan
      .map((n) => `${n === inUse ? "*" : " "}:${escape(n.ssid)}:${n.signal}:${escape(n.security)}`)
      .join("\n")
  );
}

if (args[0] === "connection" && args[1] === "add") {
  changed = true;
  const p = pairs(2);
  state.connections.push({
    name: p["con-name"],
    ssid: p.ssid,
    psk: p["wifi-sec.psk"],
    mode: "infrastructure",
    priority: p["connection.autoconnect-priority"]
  });
  out(`Connection '${p["con-name"]}' successfully added.`);
}

if (args[0] === "connection" && args[1] === "modify") {
  changed = true;
  const c = find(args[2]);
  if (!c) fail(10, `${args[2]} - no such connection profile.`);
  const p = pairs(3);
  if (p["802-11-wireless.ssid"]) c.ssid = p["802-11-wireless.ssid"];
  if (p["wifi-sec.psk"]) c.psk = p["wifi-sec.psk"];
  if (p["connection.autoconnect"]) c.autoconnect = p["connection.autoconnect"];
  out("");
}

if (args[0] === "connection" && args[1] === "up") {
  changed = true;
  const c = find(args[2]);
  if (!c) fail(10, `${args[2]} - no such connection profile.`);
  if (!state.radio) fail(4, "Connection activation failed: Wi-Fi is disabled.");
  // Ist das WLAN nicht in Reichweite, scheitert es, und NetworkManager nimmt wieder das eigene WLAN.
  if (c.mode !== "ap" && !state.scan.some((n) => n.ssid === c.ssid)) {
    state.active = AP;
    fail(4, `Connection activation failed: No network with SSID '${c.ssid}' found.`);
  }
  state.active = c.name;
  out("Connection successfully activated.");
}

if (args[0] === "connection" && args[1] === "delete") {
  changed = true;
  if (!find(args[2])) fail(10, `${args[2]} - no such connection profile.`);
  state.connections = state.connections.filter((c) => c.name !== args[2]);
  if (state.active === args[2]) state.active = AP;
  out(`Connection '${args[2]}' successfully deleted.`);
}

fail(2, `Fake-nmcli kennt diesen Aufruf nicht: ${joined}`);
