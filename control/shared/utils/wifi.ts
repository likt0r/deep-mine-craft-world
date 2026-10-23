/** Grenzen für WLAN-Namen und -Passwörter (WPA2-PSK). */

/** Eine SSID ist 1–32 Bytes lang und enthält keine Steuerzeichen. */
export function isValidSsid(ssid: string): boolean {
  const bytes = new TextEncoder().encode(ssid).length;
  // eslint-disable-next-line no-control-regex -- genau die sollen raus
  return bytes >= 1 && bytes <= 32 && !/[\u0000-\u001f\u007f]/.test(ssid);
}

/** Ein WPA2-Passwort hat 8–63 druckbare ASCII-Zeichen. */
export function isValidWifiPassword(password: string): boolean {
  return /^[ -~]{8,63}$/.test(password);
}
