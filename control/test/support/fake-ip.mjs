#!/usr/bin/env node
// Nachgebautes `ip` (und `resolvectl --json=short dns`) für Tests, mit derselben Ausgabe wie iproute2 und
// systemd. Liest den Zustand des Fake-nmcli: Kabel steckt → Route über enp1s0; mit einem WLAN verbunden →
// über wlp3s0; Adresse und DNS von enp1s0 aus `ethernet`.
import { existsSync, readFileSync } from "node:fs";

import { initialState } from "./fake-nmcli-state.mjs";

const file = process.env.FAKE_NMCLI_STATE;
const state = file && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : initialState();
const joined = process.argv.slice(2).join(" ");
const eth = state.ethernet;
const json = (value) => {
  process.stdout.write(JSON.stringify(value) + "\n");
  process.exit(0);
};

if (joined === "--json=short dns enp1s0")
  json([
    { ifname: "enp1s0", ifindex: 2, servers: eth.dns.map((d) => ({ addressString: d, family: 2, port: 53 })) }
  ]);

if (joined === "-j addr show dev enp1s0" || joined === "-j -4 addr show dev enp1s0")
  json([
    {
      ifindex: 2,
      ifname: "enp1s0",
      flags: state.wired
        ? ["BROADCAST", "MULTICAST", "UP", "LOWER_UP"]
        : ["NO-CARRIER", "BROADCAST", "MULTICAST", "UP"],
      operstate: state.wired ? "UP" : "DOWN",
      address: eth.mac,
      addr_info: state.wired
        ? [
            {
              family: "inet",
              local: eth.address,
              prefixlen: eth.prefix,
              scope: "global",
              ...(eth.dynamic ? { dynamic: true } : {})
            }
          ]
        : []
    }
  ]);

if (joined === "-j -4 route show default")
  json(
    state.wired
      ? [{ dst: "default", gateway: eth.gateway, dev: "enp1s0", protocol: eth.dynamic ? "dhcp" : "static" }]
      : []
  );

if (joined !== "-4 route show default") {
  process.stderr.write(`Fake-ip kennt diesen Aufruf nicht: ${joined}\n`);
  process.exit(2);
}
const lines = [];
if (state.wired) lines.push("default via 192.168.0.1 dev enp1s0 proto dhcp src 192.168.0.110 metric 100");
if (state.active && state.active !== "dmc-ap")
  lines.push("default via 192.168.178.1 dev wlp3s0 proto dhcp src 192.168.178.57 metric 600");
if (lines.length) process.stdout.write(lines.join("\n") + "\n");
