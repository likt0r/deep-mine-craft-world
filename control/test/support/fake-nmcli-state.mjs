// Ausgangslage des Fake-nmcli (test/support/fake-nmcli.mjs), auch für Tests zum Vergleichen.
const AP = "dmc-ap";

/** Ausgangslage wie nach install.sh: kein hinterlegtes WLAN, eigenes WLAN aktiv. */
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
    /** NetworkManager läuft nicht: jeder Aufruf scheitert. */
    broken: false
  };
}
