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
  /** Aller Verkehr läuft durchs VPN (AllowedIPs 0.0.0.0/0 oder ::/0) */
  fullTunnel: boolean;
}
