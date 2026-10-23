/** VPN des Servers (WireGuard über NetworkManager, System → Netzwerk). Schlüssel gibt die API nie heraus. */
export interface VpnInfo {
  /** Eine Konfiguration ist hochgeladen */
  configured: boolean;
  /** Die Verbindung steht gerade */
  active: boolean;
  /** Beim Start des Rechners von selbst verbinden */
  autoconnect: boolean;
  /** VPN-Adresse(n) aus der Konfiguration */
  address: string[];
  /** Gegenstelle(n), z. B. vpn.example.org:51820 */
  endpoints: string[];
  dns: string[];
  /** Die Konfiguration erlaubt allen Verkehr durchs VPN (AllowedIPs 0.0.0.0/0 oder ::/0) */
  allowsAll: boolean;
  /**
   * Der gesamte Internetverkehr läuft tatsächlich durchs VPN. Standard aus: dann geht nur das Netz hinter dem
   * VPN (z. B. das Heimnetz) durch, das Internet direkt.
   */
  routeAll: boolean;
}
