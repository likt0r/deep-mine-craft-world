/** Beispielschlüssel aus der WireGuard-Dokumentation, keine echten. */
export const PRIVATE_KEY = "yAnz5TF+lXXJte14tji3zlMNq+hd2rYUIgJBgB3fBmk=";
export const PUBLIC_KEY = "xTIBA5rboUvnH4htodjb6e697QjLERt1NAB4mZqp8Dg=";

/** Eine gültige WireGuard-Konfiguration; `allowedIps` steuert Voll- oder Teil-Tunnel. */
export function wireguardConfig(allowedIps = "10.8.0.0/24") {
  return [
    "[Interface]",
    `PrivateKey = ${PRIVATE_KEY}`,
    "Address = 10.8.0.2/24",
    "DNS = 10.8.0.1",
    "",
    "# Der VPN-Server",
    "[Peer]",
    `PublicKey = ${PUBLIC_KEY}`,
    `AllowedIPs = ${allowedIps}`,
    "Endpoint = vpn.example.org:51820",
    "PersistentKeepalive = 25",
    ""
  ].join("\n");
}
