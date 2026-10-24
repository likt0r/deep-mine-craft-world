// Ausgangslage des Fake-nmcli (test/support/fake-nmcli.mjs), auch für Tests zum Vergleichen.
const AP = "dmc-ap";

/** Ausgangslage wie nach der Paketinstallation: kein hinterlegtes WLAN, eigenes WLAN aktiv. */
export function initialState() {
  return {
    connections: [{ name: AP, ssid: "MINECRAFT-World", psk: "deep-mine-craft", mode: "ap" }],
    active: AP,
    scan: [
      { ssid: "Zuhause", signal: 72, security: "WPA2" },
      { ssid: "Zuhause", signal: 40, security: "WPA2" },
      { ssid: "Nachbar:in", signal: 31, security: "WPA2 WPA3" },
      { ssid: "Café offen", signal: 25, security: "" },
      { ssid: "MINECRAFT-World", signal: 0, security: "WPA2" }
    ],
    stations: 2,
    /** WLAN-Funk an (`nmcli radio wifi`) */
    radio: true,
    /** Kabel steckt: Standardroute über enp1s0 (für das Fake-ip) */
    wired: true,
    /** Ethernet enp1s0 wie auf dem echten Server (für Fake-ip und Fake-resolvectl) */
    ethernet: {
      address: "192.168.0.110",
      prefix: 24,
      gateway: "192.168.0.1",
      dns: ["192.168.0.5"],
      dynamic: true,
      mac: "40:62:31:00:42:8c"
    },
    /** NetworkManager läuft nicht: jeder Aufruf scheitert. */
    broken: false
  };
}
