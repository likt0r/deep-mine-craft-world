#!/usr/bin/env node
// Nachgebautes `ip -4 route show default` für den WLAN-Wächter (server/wifi-check.sh).
// Liest den Zustand des Fake-nmcli: Kabel steckt → Route über enp1s0; mit einem WLAN verbunden → über wlp3s0.
import { existsSync, readFileSync } from "node:fs";

import { initialState } from "./fake-nmcli-state.mjs";

const file = process.env.FAKE_NMCLI_STATE;
const state = file && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : initialState();
if (process.argv.slice(2).join(" ") !== "-4 route show default") {
  process.stderr.write("Fake-ip kennt nur: ip -4 route show default\n");
  process.exit(2);
}
const lines = [];
if (state.wired) lines.push("default via 192.168.0.1 dev enp1s0 proto dhcp src 192.168.0.110 metric 100");
if (state.active && state.active !== "dmc-ap")
  lines.push("default via 192.168.178.1 dev wlp3s0 proto dhcp src 192.168.178.57 metric 600");
if (lines.length) process.stdout.write(lines.join("\n") + "\n");
