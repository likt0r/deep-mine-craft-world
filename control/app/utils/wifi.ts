/** Anzeige rund ums WLAN. */

/** Inhalt eines WLAN-QR-Codes, den Handys und Tablets zum Verbinden scannen. */
export function wifiQrText(ssid: string, password: string): string {
  // Sonderzeichen werden laut Format mit „\“ maskiert.
  const escape = (value: string) => value.replace(/([\\;,:"])/g, "\\$1");
  return `WIFI:T:WPA;S:${escape(ssid)};P:${escape(password)};;`;
}

/** Symbol für die Signalstärke in Prozent. */
export function signalIcon(signal: number | null): string {
  if (signal === null) return "i-lucide-wifi";
  if (signal >= 67) return "i-lucide-wifi";
  if (signal >= 34) return "i-lucide-wifi-high";
  return "i-lucide-wifi-low";
}
