/** Das WLAN des Servers: entweder mit einem hinterlegten WLAN verbunden oder eigenes WLAN (AP). */
export interface WifiInfo {
  mode: "client" | "ap" | "off";
  /** Verbundenes WLAN, wenn `mode` client ist */
  client: { ssid: string; signal: number | null; ip: string | null } | null;
  /** Das eigene WLAN. Das Passwort ist zum Weitergeben gedacht, deshalb steht es hier. */
  ap: { ssid: string; password: string; active: boolean; devices: number | null; ip: string | null };
  /** Hinterlegte WLANs. Ihre Passwörter gibt die API nie heraus. */
  saved: { id: number; ssid: string; active: boolean }[];
  /** Sichtbare WLANs, stärkstes zuerst, ohne das eigene */
  available: { ssid: string; signal: number; secured: boolean; saved: boolean }[];
  /** Im AP-Modus kann die Karte nicht suchen: `available` ist dann der zuletzt gesehene Stand. */
  availableStale: boolean;
}
